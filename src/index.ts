import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { roomRoutes } from './routes/roomRoutes';
import { setupSocketIO } from './services/socketService';
import { globalRateLimit } from './middleware/rateLimit';

const PORT = process.env.PORT || 4000;
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'];

const app = express();

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(globalRateLimit);

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Renung.in API is running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/room', roomRoutes);

// Create HTTP server and Socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

setupSocketIO(io);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});