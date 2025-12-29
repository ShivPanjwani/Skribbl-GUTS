import { useState, useEffect, useRef } from 'react';
import { GamePhase, GameState, Player, WordOption, PlayerType, Room, AvatarConfig } from '../types';
import { TOTAL_ROUNDS, TURN_DURATION_SECONDS, POINTS_GUESS_BASE, POINTS_GUESS_DECAY, POINTS_DRAWER_ALL_GUESSED, MOCK_ROOMS } from '../constants';
import { generateWordOptions } from '../services/words';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'drawit_gamestate_v1';

export const useGameLogic = () => {
  // Initialize state from localStorage if available
  const [gameState, setGameState] = useState<GameState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        console.error("Failed to load saved game state:", e);
      }
    }
    return {
      phase: GamePhase.MENU,
      currentRound: 1,
      totalRounds: TOTAL_ROUNDS,
      players: [],
      currentPlayerIndex: 0,
      currentWord: null,
      wordOptions: [],
      timeLeft: 0,
      messages: [],
      canvasData: null,
      drawingImageUrl: null,
      winner: null,
      currentRoom: null,
      usedWords: [],
    };
  });

  const [availableRooms, setAvailableRooms] = useState<Room[]>([...MOCK_ROOMS]);
  const timerRef = useRef<number | null>(null);

  // --- Persistence ---
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    } catch (e) {
      console.error("Failed to save game state:", e);
    }
  }, [gameState]);

  // --- Resume Logic ---
  useEffect(() => {
    // This effect runs once on mount to resume timers/logic if the game was reloaded
    if (gameState.phase === GamePhase.MENU || gameState.phase === GamePhase.GAME_OVER) return;

    console.log("Resuming game from phase:", gameState.phase);

    if (gameState.phase === GamePhase.DRAWING) {
       startTimer();
    }
    
    // Handle stuck transitions (if user reloaded during a timeout)
    if (gameState.phase === GamePhase.TURN_END) {
        const nextIdx = gameState.currentPlayerIndex + 1;
        setTimeout(() => {
             if (nextIdx >= gameState.players.length) endRound();
             else startTurn(nextIdx);
        }, 1000);
    }

    if (gameState.phase === GamePhase.ROUND_END) {
        setTimeout(() => {
            const nextRound = gameState.currentRound + 1;
            if (nextRound > gameState.totalRounds) {
                setGameState(prev => ({...prev, phase: GamePhase.GAME_OVER}));
            } else {
                startRound(nextRound, gameState.players);
            }
        }, 1000);
    }

    if (gameState.phase === GamePhase.ROUND_START) {
        setTimeout(() => startTurn(0), 1000);
    }

    // Cleanup intervals on unmount
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); 

  // --- Helpers ---
  const addMessage = (playerName: string, text: string, isSystem = false, isCorrectGuess = false) => {
    setGameState(prev => ({
      ...prev,
      messages: [...prev.messages, {
        id: Math.random().toString(36).substr(2, 9),
        playerId: isSystem ? 'system' : 'unknown',
        playerName,
        text,
        isSystem,
        isCorrectGuess,
        timestamp: Date.now()
      }]
    }));
  };

  // --- Lobby / Room Actions ---

  const enterLobbyBrowser = () => {
    setGameState(prev => ({ ...prev, phase: GamePhase.LOBBY_BROWSER }));
  };

  const enterHostSetup = () => {
    setGameState(prev => ({ ...prev, phase: GamePhase.HOST_SETUP }));
  };

  const createRoom = (name: string, isPrivate: boolean, password?: string) => {
    const newRoom: Room = {
      id: Math.random().toString(36).substr(2, 6).toUpperCase(),
      name,
      isPrivate,
      password,
      playerCount: 1,
      maxPlayers: 8,
      status: 'WAITING'
    };
    
    setGameState(prev => ({
      ...prev,
      currentRoom: newRoom,
      phase: GamePhase.LOBBY_WAITING,
      players: [], // Reset players
      messages: []
    }));
  };

  const joinRoom = (roomId: string, password?: string) => {
    const room = availableRooms.find(r => r.id === roomId);
    if (!room) {
      alert("Room not found!");
      return;
    }
    if (room.isPrivate && room.password && room.password !== password) {
      alert("Incorrect password!");
      return;
    }

    setGameState(prev => ({
      ...prev,
      currentRoom: room,
      phase: GamePhase.LOBBY_WAITING,
      players: [], 
      messages: []
    }));
  };

  const joinGame = (playerName: string, avatarConfig: AvatarConfig) => {
    const userPlayer: Player = {
      id: 'user',
      name: playerName,
      type: PlayerType.HUMAN,
      score: 0,
      avatar: avatarConfig,
      hasGuessedCorrectly: false,
    };
    
    setGameState(prev => ({
      ...prev,
      players: [userPlayer],
      phase: GamePhase.ROOM_LOBBY,
      messages: [],
    }));
  };

  const startGame = () => {
    setGameState(prev => ({
        ...prev,
        phase: GamePhase.ROUND_START,
        currentRound: 1,
        currentPlayerIndex: 0
    }));
    setTimeout(() => startRound(1, gameState.players), 1000);
  };

  // --- Game Flow Actions ---

  const startRound = (roundNum: number, players: Player[]) => {
    setGameState(prev => ({
      ...prev,
      currentRound: roundNum,
      phase: GamePhase.ROUND_START,
      messages: [],
      players: players.length > 0 ? players : prev.players
    }));
    
    addMessage('Host', `Round ${roundNum} begins!`, true);

    setTimeout(() => {
      startTurn(0); 
    }, 3000);
  };

  const startTurn = async (playerIndex: number) => {
    const players = gameState.players;
    const currentRound = gameState.currentRound;
    
    if (playerIndex >= players.length) {
        setTimeout(() => endRound(), 100);
        return;
    }

    const excludeWords = gameState.usedWords || [];

    setGameState(prev => ({
        ...prev,
        phase: GamePhase.TURN_START,
        currentPlayerIndex: playerIndex,
        players: prev.players.map(p => ({ ...p, hasGuessedCorrectly: false })),
        currentWord: null,
        drawingImageUrl: null,
        canvasData: null,
        messages: [],
    }));

    // Generate word options for the current player
    const words = await generateWordOptions(currentRound, excludeWords);
    setGameState(s => ({ 
        ...s, 
        wordOptions: words, 
        phase: GamePhase.WORD_SELECTION,
        usedWords: [...(s.usedWords || []), ...words.map(w => w.word)]
    }));
  };

  const handleWordSelection = (word: WordOption) => {
    setGameState(prev => ({
      ...prev,
      currentWord: word,
      phase: GamePhase.DRAWING,
      timeLeft: TURN_DURATION_SECONDS,
      wordOptions: [],
    }));

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    addMessage('Host', `${currentPlayer?.name || 'Player'} selected a word!`, true);

    startTimer();
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setGameState(prev => {
        if (prev.timeLeft <= 1) {
          endTurn();
          return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
  };

  const handleCorrectGuess = (playerId: string) => {
    setGameState(prev => {
      const player = prev.players.find(p => p.id === playerId);
      if (!player || player.hasGuessedCorrectly) return prev;

      const guessRank = prev.players.filter(p => p.hasGuessedCorrectly && p.id !== prev.players[prev.currentPlayerIndex].id).length;
      const points = Math.max(POINTS_GUESS_BASE - (guessRank * POINTS_GUESS_DECAY), 200);

      const newMessages = [...prev.messages, {
        id: Math.random().toString(),
        playerId,
        playerName: player.name,
        text: `Guessed the word! (+${points})`,
        isSystem: false,
        isCorrectGuess: true,
        timestamp: Date.now()
      }];

      const updatedPlayers = prev.players.map(p => {
        if (p.id === playerId) {
          return { ...p, score: p.score + points, hasGuessedCorrectly: true };
        }
        return p;
      });

      const guessers = updatedPlayers.filter(p => p.id !== updatedPlayers[prev.currentPlayerIndex].id);
      const allGuessed = guessers.every(p => p.hasGuessedCorrectly);

      if (allGuessed) {
         const drawerId = prev.players[prev.currentPlayerIndex].id;
         const finalPlayers = updatedPlayers.map(p => 
           p.id === drawerId ? { ...p, score: p.score + POINTS_DRAWER_ALL_GUESSED } : p
         );
         setTimeout(() => endTurn(), 2000);
         return { ...prev, players: finalPlayers, messages: newMessages };
      }

      return { ...prev, players: updatedPlayers, messages: newMessages };
    });
  };

  const submitHumanGuess = (text: string) => {
    if (gameState.phase !== GamePhase.DRAWING) {
        addMessage('You', text);
        return;
    }

    const myPlayer = gameState.players.find(p => p.id === 'user');
    const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === 'user';
    
    // Allow chatting if it's my turn OR if I have already guessed
    if (isMyTurn || myPlayer?.hasGuessedCorrectly) {
        addMessage('You', text);
        return;
    }
    
    // Simple string matching for guesses
    const targetWord = gameState.currentWord?.word || '';
    const normalizedGuess = text.trim().toLowerCase();
    const normalizedTarget = targetWord.toLowerCase();
    
    const isCorrect = normalizedGuess === normalizedTarget;
    
    if (isCorrect) {
      handleCorrectGuess('user');
    } else {
      addMessage('You', text);
    }
  };

  const endTurn = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    setGameState(prev => {
      // Avoid triggering end turn multiple times
      if (prev.phase === GamePhase.TURN_END) return prev;

      const msg = `Time's up! The word was: ${prev.currentWord?.word}`;
      const newMessages = [...prev.messages, {
         id: 'sys-end', playerId: 'system', playerName: 'Host', text: msg, isSystem: true, timestamp: Date.now()
      }];
      
      return { ...prev, phase: GamePhase.TURN_END, messages: newMessages };
    });

    // Increased timeout to show Summary Card (6 seconds)
    setTimeout(() => {
      setGameState(prev => {
        const nextIdx = prev.currentPlayerIndex + 1;
        // Check recursion end
        if (nextIdx >= prev.players.length) {
            // Trigger End Round
            setTimeout(() => endRound(), 100);
        } else {
            // Next Turn
            setTimeout(() => startTurn(nextIdx), 100);
        }
        return prev;
      });
    }, 6000);
  };

  const endRound = () => {
    setGameState(prev => {
       if (prev.currentRound >= prev.totalRounds) {
         return { ...prev, phase: GamePhase.GAME_OVER };
       }
       return { ...prev, phase: GamePhase.ROUND_END };
    });
  };

  // Handle Phase Transitions (Round End / Game Over)
  useEffect(() => {
    if (gameState.phase === GamePhase.GAME_OVER) {
       confetti({
         particleCount: 150,
         spread: 70,
         origin: { y: 0.6 }
       });
    } else if (gameState.phase === GamePhase.ROUND_END) {
       const timer = setTimeout(() => {
         const nextRound = gameState.currentRound + 1;
         startRound(nextRound, gameState.players);
       }, 8000);
       return () => clearTimeout(timer);
    }
  }, [gameState.phase, gameState.currentRound]);

  const updateCanvasData = (base64: string) => {
    setGameState(prev => ({ ...prev, canvasData: base64 }));
  };

  return {
    gameState,
    availableRooms,
    enterLobbyBrowser,
    enterHostSetup,
    createRoom,
    joinRoom,
    joinGame,
    startGame,
    handleWordSelection,
    submitHumanGuess,
    updateCanvasData,
    restartGame: () => {
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
    },
  };
};
