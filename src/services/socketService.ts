import { Server, Socket } from 'socket.io';
import { roomService, Card } from './roomService';
import { socketRateLimitMiddleware, socketRateLimiter, SOCKET_RATE_LIMITS } from '../utils/socketRateLimiter';

interface JoinRoomData {
  roomCode: string;
  playerId: string;
}

interface InitGameData {
  roomCode: string;
}

interface DrawCardData {
  roomCode: string;
  playerId: string;
  card: Card;
  drawnCardIds?: number[];
}

interface LeaveRoomData {
  roomCode: string;
  playerId: string;
}

export const setupSocketIO = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);
    
    if (socketRateLimiter.isBlacklisted(socket.id)) {
      console.warn(`Blacklisted socket attempted connection: ${socket.id}`);
      socket.disconnect(true);
      return;
    }
    
    socket.on('join_room', ({ roomCode, playerId }: JoinRoomData) => {
      if (!socketRateLimitMiddleware(socket, 'join_room', SOCKET_RATE_LIMITS.JOIN_ROOM)) {
        return;
      }
      
      const room = roomService.addPlayer(roomCode, playerId, socket.id);
      socket.join(roomCode);
      
      console.log(`Player ${playerId} joined room ${roomCode}`);
      console.log(`Room ${roomCode} now has ${room.playerCount} players`);
      
      io.to(roomCode).emit('room_status', {
        players: room.playerCount,
        theme: room.theme
      });
      
      if (room.playerCount === 2) {
        const players = Object.keys(room.players);
        roomService.setCurrentTurn(roomCode, players[0]);
        
        io.to(roomCode).emit('game_state', {
          players: room.playerCount,
          currentTurn: room.currentTurn,
          currentCard: room.currentCard,
          drawnCardIds: room.drawnCardIds,
          theme: room.theme
        });
      }
    });
    
    socket.on('init_game', ({ roomCode }: InitGameData) => {
      const room = roomService.getRoom(roomCode);
      
      if (room && room.playerCount === 2) {
        const players = Object.keys(room.players);
        roomService.setCurrentTurn(roomCode, players[0]);
        
        io.to(roomCode).emit('game_state', {
          players: room.playerCount,
          currentTurn: room.currentTurn,
          currentCard: null,
          drawnCardIds: room.drawnCardIds || []
        });
      }
    });
    
    socket.on('draw_card', ({ roomCode, playerId, card, drawnCardIds }: DrawCardData) => {
      if (!socketRateLimitMiddleware(socket, 'draw_card', SOCKET_RATE_LIMITS.DRAW_CARD)) {
        return;
      }
      
      const room = roomService.getRoom(roomCode);
      
      if (!room) return;
      
      if (room.currentTurn !== playerId) {
        console.log(`Not ${playerId}'s turn!`);
        return;
      }
      
      roomService.setCurrentCard(roomCode, card);
      
      if (drawnCardIds) {
        roomService.setDrawnCards(roomCode, drawnCardIds);
      } else if (card && card.id) {
        roomService.addDrawnCard(roomCode, card.id);
      }
      
      const nextPlayer = roomService.getNextPlayer(roomCode, playerId);
      if (nextPlayer) {
        roomService.setCurrentTurn(roomCode, nextPlayer);
      }
      
      const updatedRoom = roomService.getRoom(roomCode);
      if (updatedRoom) {
        io.to(roomCode).emit('game_state', {
          players: updatedRoom.playerCount,
          currentTurn: updatedRoom.currentTurn,
          currentCard: updatedRoom.currentCard,
          drawnCardIds: updatedRoom.drawnCardIds
        });
      }
    });
    
    socket.on('leave_room', ({ roomCode, playerId }: LeaveRoomData) => {
      const room = roomService.getRoom(roomCode);
      if (!room) return;
      
      console.log(`Player ${playerId} left room ${roomCode}`);
      socket.leave(roomCode);
      
      roomService.removePlayer(roomCode, playerId);
      const updatedRoom = roomService.getRoom(roomCode);
      
      if (!updatedRoom) return;
      
      io.to(roomCode).emit('room_status', {
        players: updatedRoom.playerCount,
        theme: updatedRoom.theme
      });
      
      if (updatedRoom.playerCount > 0) {
        const remainingPlayers = Object.keys(updatedRoom.players);
        roomService.setCurrentTurn(roomCode, remainingPlayers[0]);
        
        io.to(roomCode).emit('game_state', {
          players: updatedRoom.playerCount,
          currentTurn: updatedRoom.currentTurn,
          currentCard: null,
          drawnCardIds: updatedRoom.drawnCardIds
        });
      }
      
      if (updatedRoom.playerCount === 0) {
        roomService.deleteRoom(roomCode);
      }
    });
    
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      
      socketRateLimiter.remove(socket.id);
      
      const result = roomService.findRoomBySocketId(socket.id);
      
      if (result) {
        const { roomCode, playerId } = result;
        console.log(`Removing player ${playerId} from room ${roomCode} due to disconnect`);
        
        roomService.removePlayer(roomCode, playerId);
        const room = roomService.getRoom(roomCode);
        
        if (!room) return;
        
        io.to(roomCode).emit('room_status', {
          players: room.playerCount,
          theme: room.theme
        });
        
        if (room.playerCount > 0) {
          const remainingPlayers = Object.keys(room.players);
          roomService.setCurrentTurn(roomCode, remainingPlayers[0]);
          
          io.to(roomCode).emit('game_state', {
            players: room.playerCount,
            currentTurn: room.currentTurn,
            currentCard: null,
            drawnCardIds: room.drawnCardIds
          });
        }
        
        if (room.playerCount === 0) {
          roomService.deleteRoom(roomCode);
        }
      }
    });
  });
};