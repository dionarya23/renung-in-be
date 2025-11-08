interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }


  check(identifier: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    if (!entry || now > entry.resetTime) {
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      });
      return true;
    }

    if (entry.count >= maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

 
  getRemaining(identifier: string, maxRequests: number): number {
    const entry = this.limits.get(identifier);
    if (!entry || Date.now() > entry.resetTime) {
      return maxRequests;
    }
    return Math.max(0, maxRequests - entry.count);
  }

  getResetTime(identifier: string): number {
    const entry = this.limits.get(identifier);
    if (!entry || Date.now() > entry.resetTime) {
      return 0;
    }
    return Math.ceil((entry.resetTime - Date.now()) / 1000);
  }

 
  reset(identifier: string): void {
    this.limits.delete(identifier);
  }

  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }

  size(): number {
    return this.limits.size;
  }

 
  stop(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const rateLimiter = new RateLimiter();

export const RATE_LIMITS = {
  CREATE_ROOM: {
    maxRequests: 15,      
    windowMs: 15 * 60 * 1000  
  },
  JOIN_ROOM: {
    maxRequests: 15,       
    windowMs: 5 * 60 * 1000 
  },
  GLOBAL: {
    maxRequests: 50,      
    windowMs: 1 * 60 * 1000 
  }
};