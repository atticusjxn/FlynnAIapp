export const sanitizeDigits = (value: string): string => value.replace(/[^0-9]/g, '');

export const normalizeNumberForDetection = (value: string): string => {
  const digitsOnly = sanitizeDigits(value);

  if (!digitsOnly) {
    return '';
  }

  if (digitsOnly.startsWith('61')) {
    return digitsOnly;
  }

  if (digitsOnly.startsWith('0')) {
    return digitsOnly;
  }

  if (digitsOnly.length === 9 && digitsOnly.startsWith('4')) {
    return `0${digitsOnly}`;
  }

  if (digitsOnly.length === 10 && digitsOnly.startsWith('4')) {
    return `0${digitsOnly.substring(1)}`;
  }

  return digitsOnly;
};

export const carrierIdToIsoCountry = (carrierId?: string | null): string | null => {
  if (!carrierId) return null;
  const normalized = carrierId.toLowerCase();

  if (normalized.startsWith('au-')) return 'AU';
  if (normalized.startsWith('us-')) return 'US';
  if (normalized.startsWith('uk-') || normalized.startsWith('gb-')) return 'GB';
  if (normalized.startsWith('ie-')) return 'IE';
  if (normalized.startsWith('nz-')) return 'NZ';

  return null;
};

export const inferIsoCountryFromNumber = (value?: string | null): string | null => {
  if (!value) return null;

  const clean = value.replace(/[^0-9+]/g, '');
  if (!clean) {
    return null;
  }

  const withPlus = clean.startsWith('+') ? clean : `+${clean}`;

  if (withPlus.startsWith('+61') || clean.startsWith('61') || clean.startsWith('04')) {
    return 'AU';
  }

  if (withPlus.startsWith('+44') || clean.startsWith('44') || clean.startsWith('07')) {
    return 'GB';
  }

  if (withPlus.startsWith('+353') || clean.startsWith('353')) {
    return 'IE';
  }

  if (withPlus.startsWith('+64') || clean.startsWith('64') || clean.startsWith('02')) {
    return 'NZ';
  }

  if (withPlus.startsWith('+1') || clean.startsWith('1')) {
    return 'US';
  }

  return null;
};
