const { DateTime } = require('luxon');
const {
  normalizePhoneNumber,
  getUserByTwilioNumber,
  getRoutingSettingsForUser,
  getCallerByPhone,
  upsertCaller,
  CALL_ROUTING_MODES,
} = require('../supabaseMcpClient');

const DEFAULT_MODE = 'smart_auto';
const FEATURE_VERSION = 'smart-routing-v1';

const normalizeMode = (mode) => {
  if (!mode || typeof mode !== 'string') {
    return DEFAULT_MODE;
  }

  const trimmed = mode.toLowerCase();
  return CALL_ROUTING_MODES.has(trimmed) ? trimmed : DEFAULT_MODE;
};

const resolveBusinessHours = (settings) => {
  if (!settings?.schedule) {
    return null;
  }

  try {
    const parsed = typeof settings.schedule === 'string'
      ? JSON.parse(settings.schedule)
      : settings.schedule;

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const timezone = parsed.timezone || settings.schedule_timezone || settings.scheduleTimezone;
    const windows = Array.isArray(parsed.windows) ? parsed.windows : [];
    if (!timezone || windows.length === 0) {
      return null;
    }

    return { timezone, windows };
  } catch (error) {
    console.warn('[Routing] Failed to parse schedule JSON', error);
    return null;
  }
};

const isWithinWindow = ({ dateTime, window }) => {
  if (!window || typeof window !== 'object') {
    return false;
  }

  const days = Array.isArray(window.days) ? window.days : [window.day].filter(Boolean);
  const normalizedDays = days.map((day) => String(day || '').slice(0, 3).toLowerCase());
  const weekday = dateTime.toFormat('ccc').toLowerCase();

  if (normalizedDays.length > 0 && !normalizedDays.includes(weekday)) {
    return false;
  }

  const start = window.start || window.startTime;
  const end = window.end || window.endTime;

  if (!start || !end) {
    return false;
  }

  const [startHour = '0', startMinute = '0'] = String(start).split(':');
  const [endHour = '0', endMinute = '0'] = String(end).split(':');

  const startMinutes = Number(startHour) * 60 + Number(startMinute);
  const endMinutes = Number(endHour) * 60 + Number(endMinute);
  const currentMinutes = dateTime.hour * 60 + dateTime.minute;

  if (endMinutes <= startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
};

const evaluateSchedule = (settings, nowUtc = DateTime.utc()) => {
  const businessHours = resolveBusinessHours(settings);
  if (!businessHours) {
    return { active: true, reason: 'no_schedule' };
  }

  const zone = businessHours.timezone || settings.schedule_timezone;
  const localized = nowUtc.setZone(zone, { keepCalendarTime: false });

  const hasActiveWindow = businessHours.windows.some((window) => isWithinWindow({ dateTime: localized, window }));
  return {
    active: hasActiveWindow,
    reason: hasActiveWindow ? 'within_business_hours' : 'after_hours',
    timezone: zone,
  };
};

const determineRouteForMode = ({
  mode,
  caller,
  scheduleInfo,
  manualOverride,
}) => {
  if (manualOverride === 'intake' || manualOverride === 'voicemail') {
    return {
      route: manualOverride,
      reason: `caller_override_${manualOverride}`,
      mode,
    };
  }

  if (mode === 'intake') {
    return { route: 'intake', reason: 'mode_intake', mode };
  }

  if (mode === 'voicemail') {
    return { route: 'voicemail', reason: 'mode_voicemail', mode };
  }

  const isKnown = Boolean(caller);
  if (caller?.label === 'spam') {
    return { route: 'voicemail', reason: 'caller_spam', mode };
  }

  if (mode === 'smart_auto') {
    if (!scheduleInfo?.active && scheduleInfo?.reason === 'after_hours') {
      return {
        route: 'voicemail',
        reason: 'after_hours_override',
        mode,
      };
    }

    return isKnown
      ? { route: 'voicemail', reason: 'smart_known', mode }
      : { route: 'intake', reason: 'smart_unknown', mode };
  }

  return { route: 'voicemail', reason: 'unhandled_mode', mode };
};

const determineInboundRoute = async ({
  toNumber,
  fromNumber,
  now = new Date(),
}) => {
  const normalizedTo = normalizePhoneNumber(toNumber);
  const normalizedFrom = normalizePhoneNumber(fromNumber);

  const evaluation = {
    route: 'voicemail',
    reason: 'fallback_default',
    mode: 'voicemail',
    user: null,
    caller: null,
    fallback: false,
    featureEnabled: true,
    settings: null,
  };

  if (!normalizedTo) {
    evaluation.reason = 'missing_to_number';
    evaluation.fallback = true;
    return evaluation;
  }

  const userRecord = await getUserByTwilioNumber(normalizedTo).catch((error) => {
    console.error('[Routing] Failed to look up user by destination number', { normalizedTo, error });
    return null;
  });

  if (!userRecord?.id) {
    evaluation.reason = 'user_not_found';
    evaluation.fallback = true;
    return evaluation;
  }

  evaluation.user = userRecord;

  const settings = await getRoutingSettingsForUser(userRecord.id).catch((error) => {
    console.error('[Routing] Failed to load routing settings', { userId: userRecord.id, error });
    return null;
  });
  evaluation.settings = settings;

  if (settings?.feature_enabled === false) {
    evaluation.featureEnabled = false;
    evaluation.mode = 'voicemail';
    evaluation.reason = 'feature_disabled';
    return evaluation;
  }

  const nowUtc = DateTime.fromJSDate(now).toUTC();
  const scheduleInfo = evaluateSchedule(settings, nowUtc);

  const mode = normalizeMode(settings?.mode);

  let callerRecord = null;
  if (normalizedFrom) {
    callerRecord = await getCallerByPhone({ userId: userRecord.id, phoneNumber: normalizedFrom }).catch((error) => {
      console.warn('[Routing] Failed to load caller record', { userId: userRecord.id, from: normalizedFrom, error });
      return null;
    });
  }

  const manualOverride = callerRecord?.routing_override && callerRecord.routing_override !== 'auto'
    ? callerRecord.routing_override
    : null;

  const routeInfo = determineRouteForMode({
    mode,
    caller: callerRecord,
    scheduleInfo,
    manualOverride,
  });

  evaluation.route = routeInfo.route;
  evaluation.reason = routeInfo.reason;
  evaluation.mode = routeInfo.mode;
  evaluation.caller = callerRecord;
  evaluation.schedule = scheduleInfo;

  if (normalizedFrom) {
    await upsertCaller({
      userId: userRecord.id,
      phoneNumber: normalizedFrom,
      seenAt: nowUtc.toISO(),
    }).catch((error) => {
      console.warn('[Routing] Failed to upsert caller memory', { userId: userRecord.id, from: normalizedFrom, error });
    });
  }

  return evaluation;
};

module.exports = {
  determineInboundRoute,
  evaluateSchedule,
  determineRouteForMode,
  FEATURE_VERSION,
};
