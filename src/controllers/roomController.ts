import { roomService } from '../services/roomService';
import { generateRoomCode } from '../utils/roomGenerator';
import { checkRateLimit } from '../middleware/rateLimit';

interface CreateRoomBody {
  theme: string;
}

interface JoinRoomBody {
  code: string;
}

export const createRoom = ({ body, request, set }: { body: CreateRoomBody; request: Request; set: any }) => {
  if (!checkRateLimit(request, 'CREATE_ROOM', set)) {
    return {
      status: false,
      message: 'Kamu udah bikin terlalu banyak ruangan. Tunggu sebentar ya!'
    };
  }

  const { theme } = body;
  let roomCode = generateRoomCode();
  
  while (roomService.roomExists(roomCode)) {
    roomCode = generateRoomCode();
  }
  
  roomService.createRoom(roomCode, theme);
  
  return {
    code: roomCode,
    theme
  };
};

export const joinRoom = ({ body, request, set }: { body: JoinRoomBody; request: Request; set: any }) => {
  if (!checkRateLimit(request, 'JOIN_ROOM', set)) {
    return {
      status: false,
      message: 'Terlalu banyak percobaan join. Tunggu sebentar ya!'
    };
  }

  const { code: originalCode } = body;
  const CODE = originalCode.toUpperCase();
  
  console.log('Join room request:', body);
  
  const room = roomService.getRoom(CODE);
  
  if (!room) {
    return {
      status: false,
      message: "Ruangan tidak ditemukan"
    };
  }
  
  if (roomService.isRoomFull(CODE)) {
    return {
      status: false,
      message: "Ruangan sudah penuh"
    };
  }
  
  room.playerCount += 1;
  
  return {
    code: CODE,
    theme: room.theme
  };
};