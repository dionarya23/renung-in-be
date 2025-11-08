import { Request, Response } from 'express';
import { roomService } from '../services/roomService';
import { generateRoomCode } from '../utils/roomGenerator';
import { checkRateLimit } from '../middleware/rateLimit';

interface CreateRoomBody {
  theme: string;
}

interface JoinRoomBody {
  code: string;
}

export const createRoom = (req: Request<{}, {}, CreateRoomBody>, res: Response) => {
  if (!checkRateLimit(req, 'CREATE_ROOM', res)) {
    return res.status(429).json({
      status: false,
      message: 'Kamu udah bikin terlalu banyak ruangan. Tunggu sebentar ya!'
    });
  }

  const { theme } = req.body;
  let roomCode = generateRoomCode();

  while (roomService.roomExists(roomCode)) {
    roomCode = generateRoomCode();
  }

  roomService.createRoom(roomCode, theme);

  return res.json({
    code: roomCode,
    theme
  });
};

export const joinRoom = (req: Request<{}, {}, JoinRoomBody>, res: Response) => {
  if (!checkRateLimit(req, 'JOIN_ROOM', res)) {
    return res.status(429).json({
      status: false,
      message: 'Terlalu banyak percobaan join. Tunggu sebentar ya!'
    });
  }

  const { code: originalCode } = req.body;
  const CODE = originalCode.toUpperCase();

  console.log('Join room request:', req.body);

  const room = roomService.getRoom(CODE);

  if (!room) {
    return res.json({
      status: false,
      message: "Ruangan tidak ditemukan"
    });
  }

  if (roomService.isRoomFull(CODE)) {
    return res.json({
      status: false,
      message: "Ruangan sudah penuh"
    });
  }

  room.playerCount += 1;

  return res.json({
    code: CODE,
    theme: room.theme
  });
};