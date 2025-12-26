import { WordOption } from '../types';

// Simple word lists for the game
const EASY_WORDS: WordOption[] = [
  { word: 'Cat', category: 'THING' },
  { word: 'Dog', category: 'THING' },
  { word: 'Sun', category: 'THING' },
  { word: 'Moon', category: 'THING' },
  { word: 'Tree', category: 'THING' },
  { word: 'House', category: 'THING' },
  { word: 'Car', category: 'THING' },
  { word: 'Bird', category: 'THING' },
  { word: 'Fish', category: 'THING' },
  { word: 'Apple', category: 'THING' },
  { word: 'Run', category: 'ACTION' },
  { word: 'Jump', category: 'ACTION' },
  { word: 'Dance', category: 'ACTION' },
  { word: 'Sing', category: 'ACTION' },
  { word: 'Sleep', category: 'ACTION' },
  { word: 'Eat', category: 'ACTION' },
  { word: 'Drink', category: 'ACTION' },
  { word: 'Walk', category: 'ACTION' },
  { word: 'Swim', category: 'ACTION' },
  { word: 'Fly', category: 'ACTION' },
  { word: 'Park', category: 'PLACE' },
  { word: 'Beach', category: 'PLACE' },
  { word: 'School', category: 'PLACE' },
  { word: 'Store', category: 'PLACE' },
  { word: 'Kitchen', category: 'PLACE' },
  { word: 'Bedroom', category: 'PLACE' },
  { word: 'Garden', category: 'PLACE' },
  { word: 'Library', category: 'PLACE' },
  { word: 'Hospital', category: 'PLACE' },
  { word: 'Restaurant', category: 'PLACE' },
];

const MEDIUM_WORDS: WordOption[] = [
  { word: 'Airplane', category: 'THING' },
  { word: 'Computer', category: 'THING' },
  { word: 'Guitar', category: 'THING' },
  { word: 'Camera', category: 'THING' },
  { word: 'Bicycle', category: 'THING' },
  { word: 'Telescope', category: 'THING' },
  { word: 'Volcano', category: 'THING' },
  { word: 'Dinosaur', category: 'THING' },
  { word: 'Robot', category: 'THING' },
  { word: 'Submarine', category: 'THING' },
  { word: 'Climbing', category: 'ACTION' },
  { word: 'Skydiving', category: 'ACTION' },
  { word: 'Surfing', category: 'ACTION' },
  { word: 'Cooking', category: 'ACTION' },
  { word: 'Reading', category: 'ACTION' },
  { word: 'Painting', category: 'ACTION' },
  { word: 'Fishing', category: 'ACTION' },
  { word: 'Shopping', category: 'ACTION' },
  { word: 'Driving', category: 'ACTION' },
  { word: 'Swimming', category: 'ACTION' },
  { word: 'Mountain', category: 'PLACE' },
  { word: 'Ocean', category: 'PLACE' },
  { word: 'Desert', category: 'PLACE' },
  { word: 'Forest', category: 'PLACE' },
  { word: 'City', category: 'PLACE' },
  { word: 'Island', category: 'PLACE' },
  { word: 'Castle', category: 'PLACE' },
  { word: 'Museum', category: 'PLACE' },
  { word: 'Stadium', category: 'PLACE' },
  { word: 'Airport', category: 'PLACE' },
];

const HARD_WORDS: WordOption[] = [
  { word: 'Telescope', category: 'THING' },
  { word: 'Microscope', category: 'THING' },
  { word: 'Helicopter', category: 'THING' },
  { word: 'Submarine', category: 'THING' },
  { word: 'Skyscraper', category: 'THING' },
  { word: 'Lighthouse', category: 'THING' },
  { word: 'Windmill', category: 'THING' },
  { word: 'Waterfall', category: 'THING' },
  { word: 'Rainbow', category: 'THING' },
  { word: 'Thunderstorm', category: 'THING' },
  { word: 'Photography', category: 'ACTION' },
  { word: 'Meditation', category: 'ACTION' },
  { word: 'Exercising', category: 'ACTION' },
  { word: 'Gardening', category: 'ACTION' },
  { word: 'Exploring', category: 'ACTION' },
  { word: 'Inventing', category: 'ACTION' },
  { word: 'Discovering', category: 'ACTION' },
  { word: 'Celebrating', category: 'ACTION' },
  { word: 'Traveling', category: 'ACTION' },
  { word: 'Learning', category: 'ACTION' },
  { word: 'Pyramid', category: 'PLACE' },
  { word: 'Rainforest', category: 'PLACE' },
  { word: 'Waterfall', category: 'PLACE' },
  { word: 'Volcano', category: 'PLACE' },
  { word: 'Glacier', category: 'PLACE' },
  { word: 'Canyon', category: 'PLACE' },
  { word: 'Observatory', category: 'PLACE' },
  { word: 'Laboratory', category: 'PLACE' },
  { word: 'Observatory', category: 'PLACE' },
  { word: 'Planetarium', category: 'PLACE' },
];

export const generateWordOptions = async (round: number = 1, excludeWords: string[] = []): Promise<WordOption[]> => {
  // Select word list based on round difficulty
  let wordPool: WordOption[] = [];
  if (round === 1) {
    wordPool = [...EASY_WORDS];
  } else if (round === 2) {
    wordPool = [...MEDIUM_WORDS];
  } else {
    wordPool = [...HARD_WORDS];
  }

  // Filter out used words
  const availableWords = wordPool.filter(w => !excludeWords.includes(w.word));

  // Ensure we have at least one word from each category
  const actionWords = availableWords.filter(w => w.category === 'ACTION');
  const thingWords = availableWords.filter(w => w.category === 'THING');
  const placeWords = availableWords.filter(w => w.category === 'PLACE');

  const selected: WordOption[] = [];
  
  // Pick one from each category if available
  if (actionWords.length > 0) {
    selected.push(actionWords[Math.floor(Math.random() * actionWords.length)]);
  }
  if (thingWords.length > 0) {
    selected.push(thingWords[Math.floor(Math.random() * thingWords.length)]);
  }
  if (placeWords.length > 0) {
    selected.push(placeWords[Math.floor(Math.random() * placeWords.length)]);
  }

  // If we don't have 3 words, fill from remaining pool
  while (selected.length < 3 && availableWords.length > 0) {
    const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    if (!selected.find(w => w.word === randomWord.word)) {
      selected.push(randomWord);
    }
  }

  // Shuffle and return up to 3 words
  return selected.slice(0, 3).sort(() => Math.random() - 0.5);
};

