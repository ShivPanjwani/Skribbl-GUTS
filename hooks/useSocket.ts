import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, Player, Room, WordOption, ChatMessage, AvatarConfig, GamePhase } from '../types';

// Server URL - use environment variable in production
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface RoomState {
  room: {
    id: string;
    name: string;
    isPrivate: boolean;
    playerCount: number;
    maxPlayers: number;
    status: 'WAITING' | 'PLAYING';
    hostId: string;
  };
  players: Player[];
  gameState: {
    phase: GamePhase;
    currentRound: number;
    totalRounds: number;
    currentPlayerIndex: number;
    currentWord: WordOption | null;
    wordOptions: WordOption[];
    timeLeft: number;
    messages: ChatMessage[];
    canvasData: string | null;
  } | null;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  currentRoom: Room | null;
  players: Player[];
  gameState: GameState | null;
  wordOptions: WordOption[];
  playerId: string | null;
  
  // Actions
  createRoom: (roomName: string, isPrivate: boolean, password?: string) => Promise<Room | null>;
  joinRoom: (roomCode: string, password: string | null, player: Player) => Promise<boolean>;
  leaveRoom: () => void;
  getPublicRooms: () => Promise<Room[]>;
  startGame: () => Promise<boolean>;
  selectWord: (word: WordOption) => Promise<boolean>;
  updateDrawing: (canvasData: string) => void;
  submitGuess: (text: string) => Promise<{ isCorrect: boolean; points?: number }>;
  sendChatMessage: (text: string) => void;
  restartGame: () => void;
}

export const useSocket = (): UseSocketReturn => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [wordOptions, setWordOptions] = useState<WordOption[]>([]);
  const [playerId, setPlayerId] = useState<string | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
    });

    // Room state updates
    socket.on('room-updated', (data: RoomState) => {
      console.log('Room updated:', data);
      
      if (data.room) {
        setCurrentRoom({
          id: data.room.id,
          name: data.room.name,
          isPrivate: data.room.isPrivate,
          password: undefined,
          playerCount: data.room.playerCount,
          maxPlayers: data.room.maxPlayers,
          status: data.room.status
        });
      }
      
      if (data.players) {
        setPlayers(data.players);
      }
      
      if (data.gameState) {
        setGameState({
          phase: data.gameState.phase,
          currentRound: data.gameState.currentRound,
          totalRounds: data.gameState.totalRounds,
          players: data.players || [],
          currentPlayerIndex: data.gameState.currentPlayerIndex,
          currentWord: data.gameState.currentWord,
          wordOptions: data.gameState.wordOptions || [],
          timeLeft: data.gameState.timeLeft,
          messages: data.gameState.messages || [],
          canvasData: data.gameState.canvasData,
          drawingImageUrl: null,
          winner: null,
          currentRoom: currentRoom,
          usedWords: []
        });
      }
    });

    // Word options (sent only to drawer)
    socket.on('word-options', (data: { words: WordOption[] }) => {
      console.log('Word options received:', data.words);
      setWordOptions(data.words);
    });

    // Drawing updates from other players
    socket.on('drawing-updated', (data: { canvasData: string }) => {
      setGameState(prev => prev ? { ...prev, canvasData: data.canvasData } : null);
    });

    // Timer updates
    socket.on('timer-update', (data: { timeLeft: number }) => {
      setGameState(prev => prev ? { ...prev, timeLeft: data.timeLeft } : null);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Create a room
  const createRoom = useCallback(async (roomName: string, isPrivate: boolean, password?: string): Promise<Room | null> => {
    const socket = socketRef.current;
    if (!socket) return null;

    return new Promise((resolve) => {
      socket.emit('create-room', { roomName, isPrivate, password }, (response: { success: boolean; room?: Room; error?: string }) => {
        if (response.success && response.room) {
          resolve(response.room);
        } else {
          console.error('Failed to create room:', response.error);
          resolve(null);
        }
      });
    });
  }, []);

  // Join a room
  const joinRoom = useCallback(async (roomCode: string, password: string | null, player: Player): Promise<boolean> => {
    const socket = socketRef.current;
    if (!socket) return false;

    setPlayerId(player.id);

    return new Promise((resolve) => {
      socket.emit('join-room', { roomCode, password, player }, (response: { success: boolean; error?: string }) => {
        if (response.success) {
          resolve(true);
        } else {
          console.error('Failed to join room:', response.error);
          alert(response.error || 'Failed to join room');
          resolve(false);
        }
      });
    });
  }, []);

  // Leave current room
  const leaveRoom = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('leave-room', () => {
      setCurrentRoom(null);
      setPlayers([]);
      setGameState(null);
      setWordOptions([]);
    });
  }, []);

  // Get public rooms
  const getPublicRooms = useCallback(async (): Promise<Room[]> => {
    const socket = socketRef.current;
    if (!socket) return [];

    return new Promise((resolve) => {
      socket.emit('get-rooms', (response: { rooms: Room[] }) => {
        resolve(response.rooms || []);
      });
    });
  }, []);

  // Start the game (host only)
  const startGame = useCallback(async (): Promise<boolean> => {
    const socket = socketRef.current;
    if (!socket) return false;

    return new Promise((resolve) => {
      socket.emit('start-game', (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          alert(response.error || 'Failed to start game');
        }
        resolve(response.success);
      });
    });
  }, []);

  // Select a word (drawer only)
  const selectWord = useCallback(async (word: WordOption): Promise<boolean> => {
    const socket = socketRef.current;
    if (!socket) return false;

    return new Promise((resolve) => {
      socket.emit('select-word', { word }, (response: { success: boolean; error?: string }) => {
        if (response.success) {
          setWordOptions([]); // Clear word options after selection
        }
        resolve(response.success);
      });
    });
  }, []);

  // Update drawing
  const updateDrawing = useCallback((canvasData: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('draw-update', { canvasData });
  }, []);

  // Submit a guess
  const submitGuess = useCallback(async (text: string): Promise<{ isCorrect: boolean; points?: number }> => {
    const socket = socketRef.current;
    if (!socket) return { isCorrect: false };

    return new Promise((resolve) => {
      socket.emit('submit-guess', { text }, (response: { success: boolean; isCorrect: boolean; points?: number }) => {
        resolve({ isCorrect: response.isCorrect, points: response.points });
      });
    });
  }, []);

  // Send chat message
  const sendChatMessage = useCallback((text: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('chat-message', { text });
  }, []);

  // Restart game
  const restartGame = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('restart-game', () => {
      setWordOptions([]);
    });
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    currentRoom,
    players,
    gameState,
    wordOptions,
    playerId,
    createRoom,
    joinRoom,
    leaveRoom,
    getPublicRooms,
    startGame,
    selectWord,
    updateDrawing,
    submitGuess,
    sendChatMessage,
    restartGame
  };
};

export default useSocket;

