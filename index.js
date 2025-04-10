const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "https://renung.in",
    methods: ["GET", "POST"]
  }
});

const rooms = {};

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

app.post('/api/room/join', (req, res) => {
  const { code: originalCode } = req.body;
  const CODE = originalCode.toUpperCase();
  console.log('req.body', req.body);
  const roomExist = rooms[CODE];
  
  if (!roomExist) {
    return res.status(404).json({
      status: false,
      message: "Ruangan tidak ditemukan"
    });
  }
  
  if (roomExist.playerCount >= 2) {
    return res.status(404).json({
      status: false,
      message: "Ruangan tidak ditemukan"
    });
  }
  
  roomExist.playerCount += 1;
  
  res.json({
    code: CODE,
    theme: roomExist.theme
  });
});

app.post('/api/room/create', (req, res) => {
  const { theme } = req.body;
  let roomCode = generateRoomCode();
  
  // Ensure the room code is unique
  while (rooms[roomCode]) {
    roomCode = generateRoomCode();
  }
  
  rooms[roomCode] = {
    theme,
    players: {},
    playerCount: 0,
    currentTurn: null,
    currentCard: null,
    drawnCardIds: [] // Add tracking for drawn cards
  };
  
  res.json({ code: roomCode, theme });
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on('join_room', ({ roomCode, playerId }) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: {},
        playerCount: 0,
        currentTurn: null,
        currentCard: null,
        drawnCardIds: [] // Initialize empty array for drawn cards
      };
    }
    
    socket.join(roomCode);
    rooms[roomCode].players[playerId] = socket.id;
    rooms[roomCode].playerCount++;
    
    console.log(`Player ${playerId} joined room ${roomCode}`);
    console.log(`Room ${roomCode} now has ${rooms[roomCode].playerCount} players`);
    
    io.to(roomCode).emit('room_status', {
      players: rooms[roomCode].playerCount,
      theme: rooms[roomCode].theme
    });
    
    if (rooms[roomCode].playerCount === 2) {
      const players = Object.keys(rooms[roomCode].players);
      rooms[roomCode].currentTurn = players[0];
      
      io.to(roomCode).emit('game_state', {
        players: rooms[roomCode].playerCount,
        currentTurn: rooms[roomCode].currentTurn,
        currentCard: rooms[roomCode].currentCard,
        drawnCardIds: rooms[roomCode].drawnCardIds, // Include drawn cards in state
        theme: rooms[roomCode].theme
      });
    }
  });
  
  socket.on('init_game', ({ roomCode }) => {
    if (rooms[roomCode] && rooms[roomCode].playerCount === 2) {
      const players = Object.keys(rooms[roomCode].players);
      rooms[roomCode].currentTurn = players[0];
      
      io.to(roomCode).emit('game_state', {
        players: rooms[roomCode].playerCount,
        currentTurn: rooms[roomCode].currentTurn,
        currentCard: null,
        drawnCardIds: rooms[roomCode].drawnCardIds || [] // Include drawn cards list
      });
    }
  });
  
  socket.on('draw_card', ({ roomCode, playerId, card, drawnCardIds }) => {
    if (!rooms[roomCode]) return;
    
    if (rooms[roomCode].currentTurn !== playerId) {
      console.log(`Not ${playerId}'s turn!`);
      return;
    }
    
    rooms[roomCode].currentCard = card;
    
    // Update drawn cards list - use the client's list if provided, otherwise update server's list
    if (drawnCardIds) {
      rooms[roomCode].drawnCardIds = drawnCardIds;
    } else if (card && card.id) {
      // Add card ID to drawn cards if it's not already there
      if (!rooms[roomCode].drawnCardIds.includes(card.id)) {
        rooms[roomCode].drawnCardIds.push(card.id);
      }
    }
    
    const players = Object.keys(rooms[roomCode].players);
    const currentPlayerIndex = players.indexOf(playerId);
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    rooms[roomCode].currentTurn = players[nextPlayerIndex];
    
    io.to(roomCode).emit('game_state', {
      players: rooms[roomCode].playerCount,
      currentTurn: rooms[roomCode].currentTurn,
      currentCard: rooms[roomCode].currentCard,
      drawnCardIds: rooms[roomCode].drawnCardIds // Include drawn cards in state update
    });
  });
  
  socket.on('leave_room', ({ roomCode, playerId }) => {
    if (!rooms[roomCode]) return;
    
    console.log(`Player ${playerId} left room ${roomCode}`);
    socket.leave(roomCode);
    
    if (rooms[roomCode].players[playerId]) {
      delete rooms[roomCode].players[playerId];
      rooms[roomCode].playerCount--;
      
      io.to(roomCode).emit('room_status', {
        players: rooms[roomCode].playerCount,
        theme: rooms[roomCode].theme
      });
      
      if (rooms[roomCode].playerCount > 0) {
        const remainingPlayers = Object.keys(rooms[roomCode].players);
        rooms[roomCode].currentTurn = remainingPlayers[0];
        
        io.to(roomCode).emit('game_state', {
          players: rooms[roomCode].playerCount,
          currentTurn: rooms[roomCode].currentTurn,
          currentCard: null,
          drawnCardIds: rooms[roomCode].drawnCardIds // Keep drawn cards history
        });
      }
      
      if (rooms[roomCode].playerCount === 0) {
        delete rooms[roomCode];
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    for (const roomCode in rooms) {
      const playerIds = Object.keys(rooms[roomCode].players);
      for (const playerId of playerIds) {
        if (rooms[roomCode].players[playerId] === socket.id) {
          console.log(`Removing player ${playerId} from room ${roomCode} due to disconnect`);
          delete rooms[roomCode].players[playerId];
          rooms[roomCode].playerCount--;
          
          io.to(roomCode).emit('room_status', {
            players: rooms[roomCode].playerCount,
            theme: rooms[roomCode].theme
          });
          
          if (rooms[roomCode].playerCount > 0) {
            const remainingPlayers = Object.keys(rooms[roomCode].players);
            rooms[roomCode].currentTurn = remainingPlayers[0];
            
            io.to(roomCode).emit('game_state', {
              players: rooms[roomCode].playerCount,
              currentTurn: rooms[roomCode].currentTurn,
              currentCard: null,
              drawnCardIds: rooms[roomCode].drawnCardIds // Keep drawn cards history
            });
          }
          
          if (rooms[roomCode].playerCount === 0) {
            delete rooms[roomCode];
          }
          
          break;
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3910;
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});