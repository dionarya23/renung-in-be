import { Socket } from 'socket.io';

interface SocketRateLimitEntry {
  count: number;
  resetTime: number;
  violations: number;
}

class SocketRateLimiter {
  private limits: Map<string, SocketRateLimitEntry> = new Map();
  private blacklist: Set<string> = new Set();


  check(socketId: string, maxEvents: number, windowMs: number): boolean {
    // Check if blacklisted
    if (this.blacklist.has(socketId)) {
      return false;
    }

    const now = Date.now();
    const entry = this.limits.get(socketId);

    if (!entry || now > entry.resetTime) {
      this.limits.set(socketId, {
        count: 1,
        resetTime: now + windowMs,
        violations: 0
      });
      return true;
    }

    if (entry.count >= maxEvents) {
      entry.violations++;
      
      if (entry.violations >= 3) {
        this.blacklist.add(socketId);
        console.warn(`⚠️  Socket ${socketId} blacklisted for excessive violations`);
      }
      
      return false;
    }

    entry.count++;
    return true;
  }

  
  remove(socketId: string): void {
    this.limits.delete(socketId);
  }

  
  isBlacklisted(socketId: string): boolean {
    return this.blacklist.has(socketId);
  }

 
  unblacklist(socketId: string): void {
    this.blacklist.delete(socketId);
  }

 
  getStats() {
    return {
      tracked: this.limits.size,
      blacklisted: this.blacklist.size
    };
  }
}

export const socketRateLimiter = new SocketRateLimiter();

export const SOCKET_RATE_LIMITS = {
  DRAW_CARD: {
    maxEvents: 20,           
    windowMs: 60 * 1000    
  },
  JOIN_ROOM: {
    maxEvents: 5,          
    windowMs: 30 * 1000     
  },
  GENERAL: {
    maxEvents: 100,         
    windowMs: 60 * 1000      
  }
};


export function socketRateLimitMiddleware(
  socket: Socket,
  eventName: string,
  config: { maxEvents: number; windowMs: number }
): boolean {
  const identifier = `${socket.id}:${eventName}`;
  
  if (!socketRateLimiter.check(identifier, config.maxEvents, config.windowMs)) {
    socket.emit('error', {
      message: 'Terlalu banyak request. Pelan-pelan ya!',
      event: eventName
    });
    return false;
  }
  
  return true;
}