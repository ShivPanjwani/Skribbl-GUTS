export enum GamePhase {
  MENU = 'MENU',
  HOST_SETUP = 'HOST_SETUP',
  LOBBY_BROWSER = 'LOBBY_BROWSER',
  LOBBY_WAITING = 'LOBBY_WAITING', // Inside a room, customizing avatar
  ROOM_LOBBY = 'ROOM_LOBBY', // Waiting for players to start
  ROUND_START = 'ROUND_START',
  TURN_START = 'TURN_START',
  WORD_SELECTION = 'WORD_SELECTION',
  DRAWING = 'DRAWING',
  TURN_END = 'TURN_END',
  ROUND_END = 'ROUND_END',
  GAME_OVER = 'GAME_OVER',
}

export enum PlayerType {
  HUMAN = 'HUMAN',
  BOT = 'BOT',
}

export interface AvatarConfig {
  color: string;
  shape: 'circle' | 'square' | 'rounded';
  accessory: string;
}

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  score: number;
  avatar: AvatarConfig;
  hasGuessedCorrectly: boolean;
}

export interface Room {
  id: string;
  name: string;
  isPrivate: boolean;
  password?: string; // In a real app, never store plain text
  playerCount: number;
  maxPlayers: number;
  status: 'WAITING' | 'PLAYING';
}

export interface WordOption {
  word: string;
  category: 'ACTION' | 'THING' | 'PLACE';
}

export interface GameState {
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  players: Player[];
  currentPlayerIndex: number;
  currentWord: WordOption | null;
  wordOptions: WordOption[];
  timeLeft: number;
  messages: ChatMessage[];
  canvasData: string | null;
  drawingImageUrl: string | null;
  winner: Player | null;
  currentRoom: Room | null;
  usedWords: string[];
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  isSystem?: boolean;
  isCorrectGuess?: boolean;
  timestamp: number;
}

export const AVATAR_ACCESSORIES = ['None', '🕶️', '🎩', '👑', '🎀', '🎧', '🧙', '🤠', '👽', '😷'];
export const AVATAR_SHAPES = ['circle', 'square', 'rounded'] as const;

export const COLORS = [
  '#000000', '#FFFFFF', '#EF4444', '#F97316', '#EAB308', 
  '#22C55E', '#3B82F6', '#A855F7', '#EC4899', '#78350F'
];