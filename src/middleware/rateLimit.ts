import { Elysia } from 'elysia';
import { rateLimiter, RATE_LIMITS } from '../utils/rateLimiter';


function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}


export function checkRateLimit(
  request: Request,
  endpoint: 'CREATE_ROOM' | 'JOIN_ROOM',
  set: any
): boolean {
  const identifier = getClientIdentifier(request);
  const config = RATE_LIMITS[endpoint];
  
  const isAllowed = rateLimiter.check(
    `${endpoint}:${identifier}`,
    config.maxRequests,
    config.windowMs
  );

  if (!isAllowed) {
    const resetTime = rateLimiter.getResetTime(`${endpoint}:${identifier}`);
    set.status = 429;
    set.headers = {
      'Retry-After': resetTime.toString()
    };
    
    return false;
  }

  return true;
}

export const globalRateLimit = new Elysia()
  .onBeforeHandle(({ request, set }) => {
    const identifier = getClientIdentifier(request);
    const isAllowed = rateLimiter.check(
      `global:${identifier}`,
      RATE_LIMITS.GLOBAL.maxRequests,
      RATE_LIMITS.GLOBAL.windowMs
    );

    if (!isAllowed) {
      const resetTime = rateLimiter.getResetTime(`global:${identifier}`);
      set.status = 429;
      return {
        status: false,
        error: 'Too Many Requests',
        message: `Terlalu banyak request. Coba lagi dalam ${resetTime} detik.`,
        retryAfter: resetTime
      };
    }
  });