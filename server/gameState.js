// Game state management for DrawIt multiplayer

import { generateWordOptions } from './words.js';

// Game phases (matching frontend)
export const GamePhase = {
  MENU: 'MENU',
  HOST_SETUP: 'HOST_SETUP',
  LOBBY_BROWSER: 'LOBBY_BROWSER',
  LOBBY_WAITING: 'LOBBY_WAITING',
  ROOM_LOBBY: 'ROOM_LOBBY',
  ROUND_START: 'ROUND_START',
  TURN_START: 'TURN_START',
  WORD_SELECTION: 'WORD_SELECTION',
  DRAWING: 'DRAWING',
  TURN_END: 'TURN_END',
  ROUND_END: 'ROUND_END',
  GAME_OVER: 'GAME_OVER'
};

// Game constants
export const TOTAL_ROUNDS = 3;
export const TURN_DURATION_SECONDS = 80;
export const POINTS_DRAWER_ALL_GUESSED = 300;
export const POINTS_GUESS_BASE = 500;
export const POINTS_GUESS_DECAY = 100;

// In-memory game state store (keyed by room code)
const gameStates = new Map();

// Initialize game state for a room
export const initializeGameState = (roomCode) => {
  const state = {
    phase: GamePhase.ROOM_LOBBY,
    currentRound: 1,
    totalRounds: TOTAL_ROUNDS,
    currentPlayerIndex: 0,
    currentWord: null,
    wordOptions: [],
    timeLeft: 0,
    messages: [],
    canvasData: null,
    usedWords: [],
    timerInterval: null
  };
  
  gameStates.set(roomCode, state);
  return state;
};

// Get game state for a room
export const getGameState = (roomCode) => {
  return gameStates.get(roomCode) || null;
};

// Update game state
export const updateGameState = (roomCode, updates) => {
  const state = gameStates.get(roomCode);
  if (!state) return null;
  
  Object.assign(state, updates);
  return state;
};

// Delete game state (when room is deleted)
export const deleteGameState = (roomCode) => {
  const state = gameStates.get(roomCode);
  if (state && state.timerInterval) {
    clearInterval(state.timerInterval);
  }
  return gameStates.delete(roomCode);
};

// Start a new game
export const startGame = (roomCode, players) => {
  const state = gameStates.get(roomCode);
  if (!state) return null;
  
  state.phase = GamePhase.ROUND_START;
  state.currentRound = 1;
  state.currentPlayerIndex = 0;
  state.messages = [];
  state.canvasData = null;
  state.usedWords = [];
  
  // Reset player scores
  players.forEach(p => {
    p.score = 0;
    p.hasGuessedCorrectly = false;
  });
  
  return state;
};

// Start a round
export const startRound = (roomCode, roundNum) => {
  const state = gameStates.get(roomCode);
  if (!state) return null;
  
  state.currentRound = roundNum;
  state.phase = GamePhase.ROUND_START;
  state.messages = [];
  
  return state;
};

// Start a turn
export const startTurn = async (roomCode, playerIndex) => {
  const state = gameStates.get(roomCode);
  if (!state) return null;
  
  state.phase = GamePhase.TURN_START;
  state.currentPlayerIndex = playerIndex;
  state.currentWord = null;
  state.canvasData = null;
  state.messages = [];
  
  // Generate word options
  const words = await generateWordOptions(state.currentRound, state.usedWords);
  state.wordOptions = words;
  state.usedWords = [...state.usedWords, ...words.map(w => w.word)];
  state.phase = GamePhase.WORD_SELECTION;
  
  return state;
};

// Select a word
export const selectWord = (roomCode, word) => {
  const state = gameStates.get(roomCode);
  if (!state) return null;
  
  state.currentWord = word;
  state.phase = GamePhase.DRAWING;
  state.timeLeft = TURN_DURATION_SECONDS;
  state.wordOptions = [];
  
  return state;
};

// Update canvas data
export const updateCanvas = (roomCode, canvasData) => {
  const state = gameStates.get(roomCode);
  if (!state) return null;
  
  state.canvasData = canvasData;
  return state;
};

// Add a message
export const addMessage = (roomCode, message) => {
  const state = gameStates.get(roomCode);
  if (!state) return null;
  
  state.messages.push({
    id: Math.random().toString(36).substr(2, 9),
    ...message,
    timestamp: Date.now()
  });
  
  return state;
};

// Check if guess is correct
export const checkGuess = (roomCode, guess) => {
  const state = gameStates.get(roomCode);
  if (!state || !state.currentWord) return false;
  
  const normalizedGuess = guess.trim().toLowerCase();
  const normalizedTarget = state.currentWord.word.toLowerCase();
  
  return normalizedGuess === normalizedTarget;
};

// Handle correct guess
export const handleCorrectGuess = (roomCode, playerId, players) => {
  const state = gameStates.get(roomCode);
  if (!state) return null;
  
  const player = players.find(p => p.id === playerId);
  if (!player || player.hasGuessedCorrectly) return null;
  
  // Calculate points based on guess order
  const guessRank = players.filter(p => 
    p.hasGuessedCorrectly && p.id !== players[state.currentPlayerIndex].id
  ).length;
  const points = Math.max(POINTS_GUESS_BASE - (guessRank * POINTS_GUESS_DECAY), 200);
  
  player.score += points;
  player.hasGuessedCorrectly = true;
  
  // Check if all guessers have guessed
  const guessers = players.filter(p => p.id !== players[state.currentPlayerIndex].id);
  const allGuessed = guessers.every(p => p.hasGuessedCorrectly);
  
  if (allGuessed) {
    // Award drawer bonus
    const drawer = players[state.currentPlayerIndex];
    if (drawer) {
      drawer.score += POINTS_DRAWER_ALL_GUESSED;
    }
  }
  
  return { points, allGuessed, player };
};

// End turn
export const endTurn = (roomCode) => {
  const state = gameStates.get(roomCode);
  if (!state) return null;
  
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  
  state.phase = GamePhase.TURN_END;
  return state;
};

// End round
export const endRound = (roomCode) => {
  const state = gameStates.get(roomCode);
  if (!state) return null;
  
  if (state.currentRound >= state.totalRounds) {
    state.phase = GamePhase.GAME_OVER;
  } else {
    state.phase = GamePhase.ROUND_END;
  }
  
  return state;
};

// Reset players for new turn
export const resetPlayersForTurn = (players) => {
  players.forEach(p => {
    p.hasGuessedCorrectly = false;
  });
};

// Decrement timer
export const decrementTimer = (roomCode) => {
  const state = gameStates.get(roomCode);
  if (!state) return null;
  
  state.timeLeft = Math.max(0, state.timeLeft - 1);
  return state.timeLeft;
};

export default {
  GamePhase,
  TOTAL_ROUNDS,
  TURN_DURATION_SECONDS,
  POINTS_DRAWER_ALL_GUESSED,
  POINTS_GUESS_BASE,
  POINTS_GUESS_DECAY,
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
};

