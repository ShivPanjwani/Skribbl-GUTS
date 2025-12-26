export const TOTAL_ROUNDS = 3;
export const TURN_DURATION_SECONDS = 80;
export const POINTS_DRAWER_ALL_GUESSED = 300;
export const POINTS_GUESS_BASE = 500; // First guesser gets 500
export const POINTS_GUESS_DECAY = 100; // Decreases by 100 for subsequent guessers

export const MOCK_ROOMS = [
  { id: '101', name: "Picasso's Playground", isPrivate: false, playerCount: 3, maxPlayers: 8, status: 'WAITING' },
  { id: '102', name: "Doodlers Only", isPrivate: true, playerCount: 5, maxPlayers: 8, status: 'PLAYING' },
  { id: '103', name: "Chill Draw", isPrivate: false, playerCount: 1, maxPlayers: 6, status: 'WAITING' },
] as const;