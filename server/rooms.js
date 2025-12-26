// Room management for DrawIt multiplayer

// In-memory store for rooms
const rooms = new Map();

// Generate a random room code
export const generateRoomCode = () => {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
};

// Create a new room
export const createRoom = (roomName, isPrivate = false, password = null, hostId = null) => {
  const roomCode = generateRoomCode();
  
  const room = {
    id: roomCode,
    name: roomName,
    isPrivate,
    password,
    hostId,
    players: [],
    maxPlayers: 8,
    status: 'WAITING', // WAITING, PLAYING
    createdAt: Date.now()
  };
  
  rooms.set(roomCode, room);
  return room;
};

// Get a room by code
export const getRoom = (roomCode) => {
  return rooms.get(roomCode) || null;
};

// Get all public rooms (for lobby browser)
export const getPublicRooms = () => {
  const publicRooms = [];
  rooms.forEach((room) => {
    if (!room.isPrivate) {
      publicRooms.push({
        id: room.id,
        name: room.name,
        isPrivate: room.isPrivate,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        status: room.status
      });
    }
  });
  return publicRooms;
};

// Add player to a room
export const addPlayerToRoom = (roomCode, player) => {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: 'Room not found' };
  if (room.players.length >= room.maxPlayers) return { success: false, error: 'Room is full' };
  if (room.status === 'PLAYING') return { success: false, error: 'Game already in progress' };
  
  // Check if player already in room
  const existingPlayer = room.players.find(p => p.id === player.id);
  if (existingPlayer) {
    return { success: true, room }; // Already in room
  }
  
  room.players.push(player);
  
  // First player becomes host
  if (room.players.length === 1) {
    room.hostId = player.id;
  }
  
  return { success: true, room };
};

// Remove player from a room
export const removePlayerFromRoom = (roomCode, playerId) => {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: 'Room not found' };
  
  room.players = room.players.filter(p => p.id !== playerId);
  
  // If room is empty, delete it
  if (room.players.length === 0) {
    rooms.delete(roomCode);
    return { success: true, room: null, deleted: true };
  }
  
  // If host left, assign new host
  if (room.hostId === playerId && room.players.length > 0) {
    room.hostId = room.players[0].id;
  }
  
  return { success: true, room, deleted: false };
};

// Update room status
export const updateRoomStatus = (roomCode, status) => {
  const room = rooms.get(roomCode);
  if (!room) return null;
  room.status = status;
  return room;
};

// Check room password
export const verifyRoomPassword = (roomCode, password) => {
  const room = rooms.get(roomCode);
  if (!room) return { valid: false, error: 'Room not found' };
  if (!room.isPrivate || !room.password) return { valid: true };
  return { valid: room.password === password };
};

// Delete a room
export const deleteRoom = (roomCode) => {
  return rooms.delete(roomCode);
};

// Get player's current room
export const getPlayerRoom = (playerId) => {
  for (const [code, room] of rooms) {
    if (room.players.some(p => p.id === playerId)) {
      return room;
    }
  }
  return null;
};

export default {
  createRoom,
  getRoom,
  getPublicRooms,
  addPlayerToRoom,
  removePlayerFromRoom,
  updateRoomStatus,
  verifyRoomPassword,
  deleteRoom,
  getPlayerRoom,
  generateRoomCode
};

