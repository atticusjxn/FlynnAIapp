const jwt = require('jsonwebtoken');

const FALLBACK_HEADER_KEYS = ['x-user-id', 'x-flynn-user-id', 'flynn-user-id'];

const extractBearerToken = (headerValue) => {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  const matches = headerValue.match(/^Bearer\s+(.+)$/i);
  return matches ? matches[1].trim() : null;
};

const authenticateJwt = (req, res, next) => {
  const authHeader = req.get('authorization');
  const token = extractBearerToken(authHeader);
  const isDev = (process.env.NODE_ENV || '').toLowerCase() === 'development';

  if (!token) {
    if (isDev) {
      for (const headerKey of FALLBACK_HEADER_KEYS) {
        const candidate = req.get(headerKey);
        if (candidate && candidate.trim()) {
          req.user = { id: candidate.trim(), source: headerKey };
          return next();
        }
      }
    }

    return res.status(401).json({ error: 'Unauthorized' });
  }

  const secret = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_ANON_JWT_SECRET;

  if (!secret) {
    console.error('[Auth] SUPABASE_JWT_SECRET is not configured.');
    return res.status(500).json({ error: 'Authentication not configured' });
  }

  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    const userId = payload?.sub || payload?.user_id || payload?.uid;

    if (!userId) {
      console.warn('[Auth] JWT verified but no subject claim present.');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = {
      id: userId,
      token: payload,
      source: 'jwt',
    };

    return next();
  } catch (error) {
    console.warn('[Auth] Failed to verify JWT.', { error: error?.message });
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

module.exports = authenticateJwt;
