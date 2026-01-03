// DrawIt Multiplayer Server
// Main entry point with Express and Socket.io

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import {
  createRoom,
  getRoom,
  getPublicRooms,
  addPlayerToRoom,
  removePlayerFromRoom,
  updateRoomStatus,
  verifyRoomPassword,
  getPlayerRoom
} from './rooms.js';

import {
  GamePhase,
  TURN_DURATION_SECONDS,
  initializeGameState,
  getGameState,
  updateGameState,
  deleteGameState,
  startGame,
  startRound,
  startTurn,
  selectWord,
  updateCanvas,
  addMessage,
  checkGuess,
  handleCorrectGuess,
  endTurn,
  endRound,
  resetPlayersForTurn,
  decrementTimer
} from './gameState.js';

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Configure CORS for both Express and Socket.io
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',')
  : [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ];

// In production, allow any origin if CORS_ORIGIN is set to '*'
const corsOptions = process.env.CORS_ORIGIN === '*' 
  ? { origin: true, credentials: true }
  : { origin: allowedOrigins, credentials: true };

app.use(cors(corsOptions));

app.use(express.json());

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    ...corsOptions,
    methods: ['GET', 'POST']
  }
});

// Store socket-to-player mapping
const socketToPlayer = new Map();
const socketToRoom = new Map();

// Helper: Broadcast room state to all players in a room
const broadcastRoomState = (roomCode) => {
  const room = getRoom(roomCode);
  const gameState = getGameState(roomCode);
  
  if (room) {
    io.to(roomCode).emit('room-updated', {
      room: {
        id: room.id,
        name: room.name,
        isPrivate: room.isPrivate,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        status: room.status,
        hostId: room.hostId
      },
      players: room.players,
      gameState: gameState ? {
        phase: gameState.phase,
        currentRound: gameState.currentRound,
        totalRounds: gameState.totalRounds,
        currentPlayerIndex: gameState.currentPlayerIndex,
        currentWord: gameState.currentWord,
        // wordOptions intentionally NOT included - sent only to drawer via 'word-options' event
        timeLeft: gameState.timeLeft,
        messages: gameState.messages,
        canvasData: gameState.canvasData
      } : null
    });
  }
};

// Helper: Start timer for a turn
const startTurnTimer = (roomCode) => {
  const gameState = getGameState(roomCode);
  if (!gameState) return;
  
  // Clear existing timer
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
  }
  
  gameState.timerInterval = setInterval(() => {
    const timeLeft = decrementTimer(roomCode);
    
    if (timeLeft !== null) {
      io.to(roomCode).emit('timer-update', { timeLeft });
      
      if (timeLeft <= 0) {
        handleTurnEnd(roomCode);
      }
    }
  }, 1000);
};

// Helper: Handle turn end
const handleTurnEnd = (roomCode) => {
  const room = getRoom(roomCode);
  const gameState = getGameState(roomCode);
  if (!room || !gameState) return;
  
  endTurn(roomCode);
  
  // Add system message
  addMessage(roomCode, {
    playerId: 'system',
    playerName: 'Host',
    text: `Time's up! The word was: ${gameState.currentWord?.word}`,
    isSystem: true
  });
  
  broadcastRoomState(roomCode);
  
  // After 6 seconds, move to next turn or end round
  setTimeout(() => {
    const nextIdx = gameState.currentPlayerIndex + 1;
    
    if (nextIdx >= room.players.length) {
      // End round
      handleRoundEnd(roomCode);
    } else {
      // Next turn
      handleNextTurn(roomCode, nextIdx);
    }
  }, 6000);
};

// Helper: Handle round end
const handleRoundEnd = (roomCode) => {
  const gameState = getGameState(roomCode);
  if (!gameState) return;
  
  endRound(roomCode);
  broadcastRoomState(roomCode);
  
  if (gameState.phase === GamePhase.GAME_OVER) {
    // Game is over
    return;
  }
  
  // After 8 seconds, start next round
  setTimeout(() => {
    const nextRound = gameState.currentRound + 1;
    handleStartRound(roomCode, nextRound);
  }, 8000);
};

// Helper: Start a round
const handleStartRound = (roomCode, roundNum) => {
  const room = getRoom(roomCode);
  if (!room) return;
  
  startRound(roomCode, roundNum);
  
  addMessage(roomCode, {
    playerId: 'system',
    playerName: 'Host',
    text: `Round ${roundNum} begins!`,
    isSystem: true
  });
  
  broadcastRoomState(roomCode);
  
  // After 3 seconds, start first turn
  setTimeout(() => {
    handleNextTurn(roomCode, 0);
  }, 3000);
};

// Helper: Handle next turn
const handleNextTurn = async (roomCode, playerIndex) => {
  const room = getRoom(roomCode);
  const gameState = getGameState(roomCode);
  if (!room || !gameState) return;
  
  if (playerIndex >= room.players.length) {
    handleRoundEnd(roomCode);
    return;
  }
  
  // Reset players for new turn
  resetPlayersForTurn(room.players);
  
  await startTurn(roomCode, playerIndex);
  
  // Get the current drawer
  const drawer = room.players[playerIndex];
  
  // Send word options only to the drawer
  const drawerSocket = [...socketToPlayer.entries()].find(
    ([, playerId]) => playerId === drawer.id
  );
  
  if (drawerSocket) {
    io.to(drawerSocket[0]).emit('word-options', {
      words: gameState.wordOptions
    });
  }
  
  broadcastRoomState(roomCode);
};

// ==================== Socket Event Handlers ====================

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // --- Room Events ---
  
  // Create a new room
  socket.on('create-room', ({ roomName, isPrivate, password }, callback) => {
    const room = createRoom(roomName, isPrivate, password);
    initializeGameState(room.id);
    
    console.log(`Room created: ${room.id} - ${roomName}`);
    
    callback({ success: true, room });
  });
  
  // Join a room
  socket.on('join-room', ({ roomCode, password, player }, callback) => {
    const room = getRoom(roomCode);
    
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    
    // Verify password if private
    if (room.isPrivate && room.password) {
      const { valid } = verifyRoomPassword(roomCode, password);
      if (!valid) {
        callback({ success: false, error: 'Incorrect password' });
        return;
      }
    }
    
    // Add player to room
    const result = addPlayerToRoom(roomCode, player);
    
    if (!result.success) {
      callback({ success: false, error: result.error });
      return;
    }
    
    // Join socket room
    socket.join(roomCode);
    socketToPlayer.set(socket.id, player.id);
    socketToRoom.set(socket.id, roomCode);
    
    // Initialize game state if not exists
    if (!getGameState(roomCode)) {
      initializeGameState(roomCode);
    }
    
    console.log(`Player ${player.name} joined room ${roomCode}`);
    
    // Broadcast to all in room
    broadcastRoomState(roomCode);
    
    callback({ success: true, room: result.room });
  });
  
  // Leave a room
  socket.on('leave-room', (callback) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayer.get(socket.id);
    
    if (roomCode && playerId) {
      const result = removePlayerFromRoom(roomCode, playerId);
      
      socket.leave(roomCode);
      socketToPlayer.delete(socket.id);
      socketToRoom.delete(socket.id);
      
      if (result.deleted) {
        deleteGameState(roomCode);
        console.log(`Room ${roomCode} deleted (empty)`);
      } else if (result.room) {
        broadcastRoomState(roomCode);
      }
      
      console.log(`Player ${playerId} left room ${roomCode}`);
    }
    
    if (callback) callback({ success: true });
  });
  
  // Get public rooms
  socket.on('get-rooms', (callback) => {
    const rooms = getPublicRooms();
    callback({ rooms });
  });
  
  // --- Game Events ---
  
  // Start the game (host only)
  socket.on('start-game', (callback) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayer.get(socket.id);
    const room = getRoom(roomCode);
    
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    
    if (room.hostId !== playerId) {
      callback({ success: false, error: 'Only host can start the game' });
      return;
    }
    
    if (room.players.length < 2) {
      callback({ success: false, error: 'Need at least 2 players' });
      return;
    }
    
    // Update room status
    updateRoomStatus(roomCode, 'PLAYING');
    
    // Start the game
    startGame(roomCode, room.players);
    
    console.log(`Game started in room ${roomCode}`);
    
    broadcastRoomState(roomCode);
    
    // Start first round after 1 second
    setTimeout(() => {
      handleStartRound(roomCode, 1);
    }, 1000);
    
    callback({ success: true });
  });
  
  // Select a word (drawer only)
  socket.on('select-word', ({ word }, callback) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayer.get(socket.id);
    const room = getRoom(roomCode);
    const gameState = getGameState(roomCode);
    
    if (!room || !gameState) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    
    // Check if it's this player's turn
    const currentDrawer = room.players[gameState.currentPlayerIndex];
    if (!currentDrawer || currentDrawer.id !== playerId) {
      callback({ success: false, error: 'Not your turn' });
      return;
    }
    
    selectWord(roomCode, word);
    
    addMessage(roomCode, {
      playerId: 'system',
      playerName: 'Host',
      text: `${currentDrawer.name} selected a word!`,
      isSystem: true
    });
    
    // Start the timer
    startTurnTimer(roomCode);
    
    broadcastRoomState(roomCode);
    
    callback({ success: true });
  });
  
  // Drawing update
  socket.on('draw-update', ({ canvasData }) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayer.get(socket.id);
    const room = getRoom(roomCode);
    const gameState = getGameState(roomCode);
    
    if (!room || !gameState) return;
    
    // Check if it's this player's turn
    const currentDrawer = room.players[gameState.currentPlayerIndex];
    if (!currentDrawer || currentDrawer.id !== playerId) return;
    
    updateCanvas(roomCode, canvasData);
    
    // Broadcast to all OTHER players in room (not the drawer)
    socket.to(roomCode).emit('drawing-updated', { canvasData });
  });
  
  // Submit a guess
  socket.on('submit-guess', ({ text }, callback) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayer.get(socket.id);
    const room = getRoom(roomCode);
    const gameState = getGameState(roomCode);
    
    if (!room || !gameState) {
      callback({ success: false });
      return;
    }
    
    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      callback({ success: false });
      return;
    }
    
    // Check if it's the drawer (they can only chat, not guess)
    const currentDrawer = room.players[gameState.currentPlayerIndex];
    const isDrawer = currentDrawer && currentDrawer.id === playerId;
    
    // If already guessed, treat as chat
    if (player.hasGuessedCorrectly || isDrawer) {
      addMessage(roomCode, {
        playerId,
        playerName: player.name,
        text,
        isSystem: false,
        isCorrectGuess: false
      });
      
      broadcastRoomState(roomCode);
      callback({ success: true, isCorrect: false });
      return;
    }
    
    // Check if guess is correct
    const isCorrect = checkGuess(roomCode, text);
    
    if (isCorrect && gameState.phase === GamePhase.DRAWING) {
      const result = handleCorrectGuess(roomCode, playerId, room.players);
      
      if (result) {
        addMessage(roomCode, {
          playerId,
          playerName: player.name,
          text: `Guessed the word! (+${result.points})`,
          isSystem: false,
          isCorrectGuess: true
        });
        
        broadcastRoomState(roomCode);
        
        // If all guessed, end turn early
        if (result.allGuessed) {
          setTimeout(() => handleTurnEnd(roomCode), 2000);
        }
        
        callback({ success: true, isCorrect: true, points: result.points });
        return;
      }
    }
    
    // Wrong guess - show as regular message
    addMessage(roomCode, {
      playerId,
      playerName: player.name,
      text,
      isSystem: false,
      isCorrectGuess: false
    });
    
    broadcastRoomState(roomCode);
    callback({ success: true, isCorrect: false });
  });
  
  // Chat message (for non-guessing chat)
  socket.on('chat-message', ({ text }) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayer.get(socket.id);
    const room = getRoom(roomCode);
    
    if (!room) return;
    
    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    
    addMessage(roomCode, {
      playerId,
      playerName: player.name,
      text,
      isSystem: false,
      isCorrectGuess: false
    });
    
    broadcastRoomState(roomCode);
  });
  
  // Restart game (go back to lobby)
  socket.on('restart-game', (callback) => {
    const roomCode = socketToRoom.get(socket.id);
    const room = getRoom(roomCode);
    
    if (!room) {
      callback({ success: false });
      return;
    }
    
    // Reset room status
    updateRoomStatus(roomCode, 'WAITING');
    
    // Reset game state
    initializeGameState(roomCode);
    
    // Reset player scores
    room.players.forEach(p => {
      p.score = 0;
      p.hasGuessedCorrectly = false;
    });
    
    broadcastRoomState(roomCode);
    callback({ success: true });
  });
  
  // --- Disconnect ---
  
  socket.on('disconnect', () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayer.get(socket.id);
    
    if (roomCode && playerId) {
      const result = removePlayerFromRoom(roomCode, playerId);
      
      socketToPlayer.delete(socket.id);
      socketToRoom.delete(socket.id);
      
      if (result.deleted) {
        deleteGameState(roomCode);
        console.log(`Room ${roomCode} deleted (empty)`);
      } else if (result.room) {
        broadcastRoomState(roomCode);
      }
      
      console.log(`Player ${playerId} disconnected from room ${roomCode}`);
    }
    
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ==================== HTTP Routes ====================

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'DrawIt Server is running' });
});

// Get public rooms (HTTP fallback)
app.get('/rooms', (req, res) => {
  const rooms = getPublicRooms();
  res.json({ rooms });
});

// ==================== Start Server ====================

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`\n🎮 DrawIt Server running on port ${PORT}`);
  console.log(`   Local: http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/`);
  console.log('\n   Waiting for players to connect...\n');
});

