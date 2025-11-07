import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { Server } from 'socket.io';
import { roomRoutes } from './routes/roomRoutes';
import { setupSocketIO } from './services/socketService';
import { globalRateLimit } from './middleware/rateLimit';

const PORT = process.env.PORT || 4000;
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'];

const app = new Elysia()
  .use(cors())
  .use(globalRateLimit) 
  .get('/', () => ({ message: 'Renung.in API is running' }))
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .use(roomRoutes)
  .listen(PORT);

const io = new Server(app.server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

setupSocketIO(io);

console.log(`Server running on port ${PORT}`);