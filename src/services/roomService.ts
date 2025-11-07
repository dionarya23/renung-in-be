export interface Room {
  theme: string;
  players: Record<string, string>;
  playerCount: number;
  currentTurn: string | null;
  currentCard: Card | null;
  drawnCardIds: number[];
}

export interface Card {
  id: number;
  text: string;
  [key: string]: any; 
}

export interface RoomSearchResult {
  roomCode: string;
  playerId: string;
}

const rooms: Record<string, Room> = {};

export const roomService = {
  getRoom(code: string): Room | undefined {
    return rooms[code];
  },

  roomExists(code: string): boolean {
    return !!rooms[code];
  },

  createRoom(code: string, theme: string): Room {
    rooms[code] = {
      theme,
      players: {},
      playerCount: 0,
      currentTurn: null,
      currentCard: null,
      drawnCardIds: []
    };
    return rooms[code];
  },

  isRoomFull(code: string): boolean {
    const room = rooms[code];
    return room && room.playerCount >= 2;
  },

  addPlayer(code: string, playerId: string, socketId: string): Room {
    if (!rooms[code]) {
      this.createRoom(code, '');
    }
    
    rooms[code].players[playerId] = socketId;
    rooms[code].playerCount++;
    
    return rooms[code];
  },

  removePlayer(code: string, playerId: string): Room | null {
    if (!rooms[code]) return null;
    
    if (rooms[code].players[playerId]) {
      delete rooms[code].players[playerId];
      rooms[code].playerCount--;
    }
    
    return rooms[code];
  },

  setCurrentTurn(code: string, playerId: string): void {
    if (rooms[code]) {
      rooms[code].currentTurn = playerId;
    }
  },

  setCurrentCard(code: string, card: Card): void {
    if (rooms[code]) {
      rooms[code].currentCard = card;
    }
  },

  addDrawnCard(code: string, cardId: number): void {
    if (rooms[code] && cardId && !rooms[code].drawnCardIds.includes(cardId)) {
      rooms[code].drawnCardIds.push(cardId);
    }
  },

  setDrawnCards(code: string, drawnCardIds: number[]): void {
    if (rooms[code]) {
      rooms[code].drawnCardIds = drawnCardIds;
    }
  },

  getNextPlayer(code: string, currentPlayerId: string): string | null {
    if (!rooms[code]) return null;
    
    const players = Object.keys(rooms[code].players);
    const currentIndex = players.indexOf(currentPlayerId);
    const nextIndex = (currentIndex + 1) % players.length;
    
    return players[nextIndex];
  },

  deleteRoom(code: string): void {
    delete rooms[code];
  },

  findRoomBySocketId(socketId: string): RoomSearchResult | null {
    for (const [roomCode, room] of Object.entries(rooms)) {
      for (const [playerId, playerSocketId] of Object.entries(room.players)) {
        if (playerSocketId === socketId) {
          return { roomCode, playerId };
        }
      }
    }
    return null;
  },

  getAllRooms(): Record<string, Room> {
    return rooms;
  }
};