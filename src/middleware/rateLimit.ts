import { Request, Response, NextFunction } from 'express';
import { rateLimiter, RATE_LIMITS } from '../utils/rateLimiter';

function getClientIdentifier(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return forwardedStr.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return req.ip || 'unknown';
}

export function checkRateLimit(
  req: Request,
  endpoint: 'CREATE_ROOM' | 'JOIN_ROOM',
  res: Response
): boolean {
  const identifier = getClientIdentifier(req);
  const config = RATE_LIMITS[endpoint];

  const isAllowed = rateLimiter.check(
    `${endpoint}:${identifier}`,
    config.maxRequests,
    config.windowMs
  );

  if (!isAllowed) {
    const resetTime = rateLimiter.getResetTime(`${endpoint}:${identifier}`);
    res.setHeader('Retry-After', resetTime.toString());
    return false;
  }

  return true;
}

export const globalRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const identifier = getClientIdentifier(req);
  const isAllowed = rateLimiter.check(
    `global:${identifier}`,
    RATE_LIMITS.GLOBAL.maxRequests,
    RATE_LIMITS.GLOBAL.windowMs
  );

  if (!isAllowed) {
    const resetTime = rateLimiter.getResetTime(`global:${identifier}`);
    res.status(429).json({
      status: false,
      error: 'Too Many Requests',
      message: `Terlalu banyak request. Coba lagi dalam ${resetTime} detik.`,
      retryAfter: resetTime
    });
    return;
  }

  next();
};