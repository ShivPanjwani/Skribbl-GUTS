import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from './hooks/useSocket';
import { GamePhase, COLORS, AVATAR_ACCESSORIES, AVATAR_SHAPES, AvatarConfig, PlayerType, Player, Room } from './types';
import { TURN_DURATION_SECONDS } from './constants';
import { DrawingCanvas } from './components/DrawingCanvas';
import { Avatar } from './components/Avatar';
import { Clock, Trophy, Send, Pencil, Lock, Users, ChevronLeft, MessageSquare, Shield, Play, Home, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

// Generate a unique player ID (persisted in sessionStorage)
const getOrCreatePlayerId = (): string => {
  const existing = sessionStorage.getItem('drawit_player_id');
  if (existing) return existing;
  const newId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('drawit_player_id', newId);
  return newId;
};

const App: React.FC = () => {
  const {
    socket,
    isConnected,
    currentRoom,
    players,
    gameState,
    wordOptions,
    playerId,
    createRoom: socketCreateRoom,
    joinRoom: socketJoinRoom,
    leaveRoom,
    getPublicRooms,
    startGame: socketStartGame,
    selectWord: socketSelectWord,
    updateDrawing,
    submitGuess,
    sendChatMessage,
    restartGame: socketRestartGame
  } = useSocket();
  
  // Local UI state
  const [phase, setPhase] = useState<GamePhase>(GamePhase.MENU);
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomPass, setRoomPass] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [pendingRoom, setPendingRoom] = useState<Room | null>(null);
  
  // Avatar Customizer State
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({
    color: COLORS[6],
    shape: 'rounded',
    accessory: 'None'
  });

  // Game State
  const [guessInput, setGuessInput] = useState('');
  const [brushColor, setBrushColor] = useState(COLORS[0]);
  const myPlayerId = useRef(getOrCreatePlayerId());

  // Sync phase with server game state
  useEffect(() => {
    if (gameState?.phase) {
      setPhase(gameState.phase);
      
      // Trigger confetti on game over
      if (gameState.phase === GamePhase.GAME_OVER) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  }, [gameState?.phase]);

  // Load public rooms on lobby browser
  useEffect(() => {
    if (phase === GamePhase.LOBBY_BROWSER) {
      loadRooms();
    }
  }, [phase]);

  const loadRooms = async () => {
    const rooms = await getPublicRooms();
    setAvailableRooms(rooms);
  };

  // --- Navigation Actions ---
  const goToMainMenu = () => {
    leaveRoom();
    setPendingRoom(null);
    setPhase(GamePhase.MENU);
  };

  const enterLobbyBrowser = () => {
    setPhase(GamePhase.LOBBY_BROWSER);
  };

  const enterHostSetup = () => {
    setPhase(GamePhase.HOST_SETUP);
  };

  // --- Room Actions ---
  const handleCreateRoom = async (name: string, isPrivate: boolean, password?: string) => {
    const room = await socketCreateRoom(name, isPrivate, password);
    if (room) {
      setPendingRoom(room);
      setPhase(GamePhase.LOBBY_WAITING);
    }
  };

  const handleJoinRoom = async (roomCode: string, password?: string) => {
    // First check if room exists
    setPendingRoom({ id: roomCode, name: 'Loading...', isPrivate: false, playerCount: 0, maxPlayers: 8, status: 'WAITING' });
    setPhase(GamePhase.LOBBY_WAITING);
  };

  const handleEnterRoom = async () => {
    if (!playerName || !pendingRoom) return;
    
    const player: Player = {
      id: myPlayerId.current,
      name: playerName,
      type: PlayerType.HUMAN,
      score: 0,
      avatar: avatarConfig,
      hasGuessedCorrectly: false
    };
    
    const success = await socketJoinRoom(pendingRoom.id, roomPass || null, player);
    if (success) {
      setPhase(GamePhase.ROOM_LOBBY);
    } else {
      setPendingRoom(null);
      setPhase(GamePhase.MENU);
    }
  };

  const handleStartGame = async () => {
    await socketStartGame();
  };

  const handleWordSelection = async (word: { word: string; category: 'ACTION' | 'THING' | 'PLACE' }) => {
    await socketSelectWord(word);
  };

  const handleSubmitGuess = async () => {
    if (!guessInput) return;
    await submitGuess(guessInput);
    setGuessInput('');
  };

  const handleRestartGame = () => {
    socketRestartGame();
  };

  // --- Helpers ---
  const getMaskedWord = (word: string) => {
    if (!word || !gameState) return '';
    const elapsed = TURN_DURATION_SECONDS - gameState.timeLeft;
    const indicesToReveal: number[] = [];
    const len = word.length;

    if (elapsed >= 30) indicesToReveal.push(0);
    if (elapsed >= 60 && len >= 4) {
      indicesToReveal.push(Math.floor(len / 2));
    }

    return word.split('').map((char, i) => {
      if (!/[a-zA-Z0-9]/.test(char)) return char;
      if (indicesToReveal.includes(i)) return char;
      return '_';
    }).join(' ');
  };

  // Check if current user is the drawer
  const isMyTurn = gameState && players.length > 0 && 
    players[gameState.currentPlayerIndex]?.id === myPlayerId.current;

  // Check if current user has guessed
  const myPlayer = players.find(p => p.id === myPlayerId.current);
  const hasGuessed = myPlayer?.hasGuessedCorrectly || false;

  // --- Connection Status ---
  const renderConnectionStatus = () => (
    <div className={`fixed top-2 right-2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
      isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
      {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  );

  // --- Render Helpers ---

  const renderMainMenu = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center space-y-8 animate-fade-in bg-gradient-to-br from-violet-900 via-indigo-900 to-purple-900 overflow-hidden">
      {renderConnectionStatus()}
      <div className="space-y-4 mb-4">
        <h1 className="text-5xl md:text-7xl font-bold text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] tracking-tight">DrawIt</h1>
        <p className="text-violet-200 text-xl md:text-2xl font-light">Online Multiplayer Drawing Game</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-sm px-4">
        <button 
          onClick={enterLobbyBrowser}
          disabled={!isConnected}
          className="py-4 px-8 bg-white hover:bg-violet-50 text-violet-900 rounded-2xl font-bold text-xl shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
        >
          <Users size={24} className="text-violet-600"/> Find a Game
        </button>
        
        <button 
          onClick={enterHostSetup}
          disabled={!isConnected}
          className="py-4 px-8 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-bold text-xl shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2 border-2 border-violet-400 disabled:opacity-50 disabled:scale-100"
        >
          <Shield size={24} /> Host Private Game
        </button>

        {/* Direct Join with Room Code */}
        <div className="mt-4 p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
          <p className="text-violet-200 text-sm mb-2">Have a room code?</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              className="flex-1 px-4 py-2 rounded-xl bg-white text-violet-900 font-mono font-bold text-center uppercase"
              maxLength={6}
            />
            <button
              onClick={() => roomCodeInput && handleJoinRoom(roomCodeInput)}
              disabled={!roomCodeInput || !isConnected}
              className="px-4 py-2 bg-violet-600 text-white rounded-xl font-bold disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHostSetup = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in">
      {renderConnectionStatus()}
      <div className="bg-white border-4 border-violet-200 p-8 rounded-3xl w-full max-w-md shadow-2xl space-y-6 text-violet-900">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={goToMainMenu} className="p-2 rounded-full hover:bg-violet-100 text-violet-600">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-3xl font-bold text-violet-800">Host Game</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-violet-600 mb-1">Room Name</label>
            <input 
              type="text" 
              value={roomName} 
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full bg-violet-50 border-2 border-violet-200 rounded-xl p-3 text-violet-900 focus:outline-none focus:border-violet-600 font-bold"
              placeholder="My Private Room"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-violet-600 mb-1">Password (Optional)</label>
            <input 
              type="text" 
              value={roomPass} 
              onChange={(e) => setRoomPass(e.target.value)}
              className="w-full bg-violet-50 border-2 border-violet-200 rounded-xl p-3 text-violet-900 focus:outline-none focus:border-violet-600 font-bold"
              placeholder="Optional Password"
            />
          </div>

          <button 
            onClick={() => roomName && handleCreateRoom(roomName, true, roomPass)}
            disabled={!roomName || !isConnected}
            className="w-full py-4 bg-violet-600 text-white font-bold rounded-xl mt-4 disabled:opacity-50 text-lg shadow-lg hover:bg-violet-700 transition-colors"
          >
            Create Room
          </button>
        </div>
      </div>
    </div>
  );

  const renderLobbyBrowser = () => (
    <div className="flex flex-col h-screen p-4 md:p-8 animate-fade-in max-w-6xl mx-auto overflow-hidden">
      {renderConnectionStatus()}
      <div className="flex items-center gap-4 mb-4 md:mb-8 flex-shrink-0">
        <button onClick={goToMainMenu} className="p-2 rounded-full hover:bg-white/10 text-white">
          <ChevronLeft size={32} />
        </button>
        <h2 className="text-3xl md:text-4xl font-bold text-white">Game Lobby</h2>
        <button onClick={loadRooms} className="p-2 rounded-full hover:bg-white/10 text-white">
          <RefreshCw size={24} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 h-full overflow-hidden pb-4">
        {/* Create Room Panel */}
        <div className="bg-white p-6 rounded-3xl border-4 border-violet-300 h-fit md:h-auto overflow-y-auto shadow-xl">
          <h3 className="text-2xl font-bold text-violet-800 mb-6">Create Public Room</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-violet-600 mb-1">Room Name</label>
              <input 
                type="text" 
                value={roomName} 
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-violet-50 border-2 border-violet-200 rounded-xl p-3 text-violet-900 focus:outline-none focus:border-violet-600 font-bold"
                placeholder="My Epic Party"
              />
            </div>
            <button 
              onClick={() => roomName && handleCreateRoom(roomName, false)}
              disabled={!roomName || !isConnected}
              className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl mt-4 disabled:opacity-50 hover:bg-violet-700 transition-colors"
            >
              Create Public Game
            </button>
          </div>
        </div>

        {/* Room List */}
        <div className="md:col-span-2 bg-white/95 rounded-3xl border-4 border-violet-300 overflow-hidden flex flex-col h-full shadow-xl">
          <div className="p-4 bg-violet-100 border-b-2 border-violet-200 flex justify-between items-center flex-shrink-0">
            <span className="font-bold text-lg text-violet-900">Public Rooms</span>
            <span className="text-sm font-bold text-violet-500 bg-violet-200 px-2 py-1 rounded-full">{availableRooms.length} Active</span>
          </div>
          <div className="overflow-y-auto flex-1 p-4 space-y-3 bg-violet-50">
            {availableRooms.length === 0 ? (
              <div className="text-center text-violet-400 py-8">
                <p className="font-bold">No public rooms available</p>
                <p className="text-sm">Create one or join with a room code!</p>
              </div>
            ) : availableRooms.map(room => (
              <div key={room.id} className="bg-white hover:bg-violet-100 transition-colors p-4 rounded-xl flex items-center justify-between group border-2 border-violet-100 hover:border-violet-300 shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xl text-violet-900">{room.name}</span>
                    {room.isPrivate && <Lock size={16} className="text-violet-500" />}
                  </div>
                  <div className="text-sm text-violet-400 font-bold">Code: {room.id} • {room.status}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold font-mono text-violet-800">{room.playerCount}/{room.maxPlayers}</div>
                    <div className="text-[10px] uppercase tracking-wider text-violet-400 font-bold">Players</div>
                  </div>
                  <button 
                    onClick={() => handleJoinRoom(room.id)}
                    className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition-colors shadow-md"
                  >
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderLobbyWaiting = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in overflow-y-auto">
      {renderConnectionStatus()}
      <div className="bg-white border-4 border-violet-300 p-8 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col md:flex-row gap-12 my-auto text-violet-900">
        {/* Avatar Customizer */}
        <div className="flex-1 space-y-6">
          <h2 className="text-3xl font-bold text-violet-800">Customize Avatar</h2>
          <div className="flex justify-center py-8 bg-violet-50 rounded-2xl border-2 border-violet-100">
            <Avatar config={avatarConfig} size="xl" />
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {AVATAR_SHAPES.map(shape => (
                <button key={shape} onClick={() => setAvatarConfig({...avatarConfig, shape})} className={`py-2 rounded-lg border-2 font-bold capitalize transition-all ${avatarConfig.shape === shape ? 'border-violet-600 bg-violet-100 text-violet-900' : 'border-violet-100 text-violet-400 hover:border-violet-200'}`}>{shape}</button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              {COLORS.slice(0, 5).map(color => (
                <button key={color} onClick={() => setAvatarConfig({...avatarConfig, color})} className={`w-10 h-10 rounded-full border-4 transition-transform hover:scale-110 ${avatarConfig.color === color ? 'border-violet-900' : 'border-transparent'}`} style={{backgroundColor: color}}/>
              ))}
            </div>
          </div>
        </div>
        {/* Join Form */}
        <div className="flex-1 flex flex-col justify-center space-y-6 border-t md:border-t-0 md:border-l border-violet-100 pt-8 md:pt-0 md:pl-12">
          <div>
            <h3 className="text-2xl font-bold mb-2 text-violet-900">{pendingRoom?.name || 'Join Room'}</h3>
            <p className="text-violet-500 font-mono bg-violet-100 inline-block px-2 py-1 rounded">
              Room Code: {pendingRoom?.id}
            </p>
          </div>
          <div>
            <label className="block text-sm font-bold text-violet-600 mb-2">Display Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-4 py-3 bg-violet-50 border-2 border-violet-200 rounded-xl text-violet-900 focus:outline-none focus:border-violet-600 font-bold text-lg"
              maxLength={12}
            />
          </div>
          <button
            onClick={handleEnterRoom}
            disabled={!playerName || !isConnected}
            className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-xl shadow-lg transition-colors transform active:scale-95 disabled:opacity-50"
          >
            Enter Room
          </button>
          <button
            onClick={goToMainMenu}
            className="w-full py-2 text-violet-500 font-bold hover:text-violet-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const renderRoomLobby = () => (
    <div className="flex flex-col h-screen p-4 md:p-8 animate-fade-in max-w-4xl mx-auto overflow-hidden">
      {renderConnectionStatus()}
      <div className="flex-shrink-0 mb-4 text-center md:text-left">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{currentRoom?.name || 'Game Room'}</h2>
        <div className="inline-flex bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg items-center gap-4 flex-wrap border border-white/20">
          <span className="text-violet-200">Room Code: <span className="font-mono text-white font-bold tracking-wider select-all">{currentRoom?.id}</span></span>
          <span className="text-violet-300 text-sm">Share this code with friends!</span>
        </div>
      </div>

      <div className="w-full bg-white rounded-3xl border-4 border-violet-300 p-4 md:p-6 mb-4 flex flex-col flex-1 overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <h3 className="text-xl md:text-2xl font-bold text-violet-900">Players ({players.length}/8)</h3>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-2">
          {players.map(p => (
            <div key={p.id} className={`bg-violet-50 p-4 rounded-2xl flex flex-col items-center gap-3 animate-scale-in border-2 shadow-sm ${p.id === myPlayerId.current ? 'border-violet-400' : 'border-violet-100'}`}>
              <Avatar config={p.avatar} size="lg" />
              <span className="font-bold text-lg truncate w-full text-center text-violet-900">
                {p.name} {p.id === myPlayerId.current && '(You)'}
              </span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 8 - players.length) }).map((_, i) => (
            <div key={i} className="border-3 border-dashed border-violet-200 rounded-2xl flex items-center justify-center min-h-[120px]">
              <span className="text-violet-300 font-bold">Empty</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-col items-center w-full gap-2">
        <button 
          onClick={handleStartGame}
          className="w-full max-w-md py-4 bg-white text-violet-900 font-bold rounded-2xl text-2xl shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:scale-100"
          disabled={players.length < 2}
        >
          <Play size={28} fill="currentColor" className="text-violet-600"/> Start Game
        </button>
        {players.length < 2 && <p className="text-violet-200 text-sm font-medium bg-black/20 px-3 py-1 rounded-full">Need at least 2 players to start.</p>}
        <button
          onClick={goToMainMenu}
          className="mt-2 text-violet-200 hover:text-white font-bold"
        >
          Leave Room
        </button>
      </div>
    </div>
  );

  const renderHeader = () => {
    if (!gameState || players.length === 0) return null;
    const currentDrawerId = players[gameState.currentPlayerIndex]?.id;

    return (
      <div className="fixed top-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md border-b-4 border-violet-200 z-50 flex items-center justify-between px-2 lg:px-4 shadow-sm gap-2">
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={goToMainMenu}
            className="p-2 rounded-lg hover:bg-violet-100 text-violet-600 transition-colors"
            title="Leave Game"
          >
            <Home size={20} />
          </button>
          <div className="flex flex-col min-w-[60px]">
            <span className="font-bold text-violet-800 text-sm lg:text-lg whitespace-nowrap">Round {gameState.currentRound}/{gameState.totalRounds}</span>
            <span className="text-[10px] text-violet-400 hidden md:inline font-bold tracking-wide">{gameState.phase}</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-x-auto flex items-center gap-2 px-2 scrollbar-hide mask-fade-sides justify-center">
          {players.map(p => (
            <div 
              key={p.id} 
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl shrink-0 transition-all border-2 ${
                p.id === currentDrawerId 
                  ? 'bg-yellow-50 border-yellow-400 scale-105' 
                  : p.hasGuessedCorrectly && p.id !== currentDrawerId
                    ? 'bg-green-50 border-green-400'
                    : 'bg-violet-50 border-transparent'
              }`}
              style={{ minWidth: '50px' }}
            >
              <div className="relative">
                <Avatar config={p.avatar} size="sm" className="w-8 h-8 lg:w-10 lg:h-10 text-xs" />
                {p.id === currentDrawerId && (
                  <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-violet-900 rounded-full p-1 border-2 border-white shadow-sm" title="Drawing">
                    <Pencil size={10} />
                  </div>
                )}
              </div>
              <span className={`text-[10px] lg:text-xs font-bold truncate max-w-[60px] ${p.id === currentDrawerId ? 'text-yellow-700' : 'text-violet-700'}`}>
                {p.name}
              </span>
              <span className="text-[10px] font-mono leading-none text-violet-400 font-bold">{p.score}</span>
            </div>
          ))}
        </div>

        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 shrink-0 transition-colors ${gameState.timeLeft < 10 ? 'bg-red-100 border-red-400 text-red-600 animate-pulse' : 'bg-violet-100 border-violet-200 text-violet-800'}`}>
          <Clock size={18} className={gameState.timeLeft < 10 ? 'text-red-500' : 'text-violet-500'} />
          <span className="font-mono font-bold text-lg lg:text-xl">
            {gameState.timeLeft}s
          </span>
        </div>
      </div>
    );
  };

  const renderWordSelection = () => (
    <div className="flex flex-col items-center justify-center h-full p-4 space-y-6 animate-slide-up mt-16">
      <h2 className="text-3xl font-bold text-white mb-4 text-center drop-shadow-md">It's your turn to draw!</h2>
      <p className="text-violet-100 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">Choose a word to draw:</p>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl px-4">
        {wordOptions.map((opt) => (
          <button
            key={opt.word}
            onClick={() => handleWordSelection(opt)}
            className="group relative overflow-hidden bg-white p-8 rounded-3xl hover:bg-yellow-50 hover:scale-105 transition-all shadow-xl border-4 border-violet-200 hover:border-yellow-400 text-center"
          >
            <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded-full bg-violet-100 text-violet-600 uppercase tracking-wider">
              {opt.category}
            </span>
            <span className="text-3xl font-bold text-violet-900">{opt.word}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderTurnSummary = () => {
    if (!gameState || players.length === 0) return null;
    const drawer = players[gameState.currentPlayerIndex];
    const correctGuessers = players.filter(p => p.hasGuessedCorrectly && p.id !== drawer?.id);

    return (
      <div className="flex flex-col items-center justify-center min-h-screen animate-fade-in p-4 pt-20">
        <div className="bg-white text-violet-900 p-6 md:p-8 rounded-3xl shadow-2xl border-4 border-violet-300 max-w-2xl w-full text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl text-violet-500 font-bold uppercase tracking-widest">The word was</h2>
            <h1 className="text-4xl md:text-5xl font-black text-violet-900">{gameState.currentWord?.word}</h1>
          </div>

          <div className="w-full h-64 bg-white border-2 border-violet-100 rounded-xl overflow-hidden relative shadow-inner">
            {gameState.canvasData ? (
              <img src={gameState.canvasData} className="w-full h-full object-contain" alt="Drawing" />
            ) : (
              <div className="flex items-center justify-center h-full text-violet-300">No Drawing</div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-violet-700">Correct Guesses</h3>
            {correctGuessers.length > 0 ? (
              <div className="flex flex-wrap gap-3 justify-center">
                {correctGuessers.map(p => (
                  <div key={p.id} className="bg-green-100 text-green-800 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-3 border-2 border-green-200 shadow-sm">
                    <Avatar config={p.avatar} size="sm" className="w-8 h-8 text-[10px]" />
                    <div className="flex flex-col text-left">
                      <span className="leading-none">{p.name}</span>
                      <span className="text-[10px] text-green-600 font-black">Total: {p.score} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-violet-400 italic">No one guessed it!</p>
            )}
          </div>

          <div className="pt-4 border-t-2 border-violet-100">
            <p className="text-violet-500 font-bold animate-pulse">Next turn starting...</p>
          </div>
        </div>
      </div>
    );
  };

  const renderGameScreen = () => {
    if (!gameState || players.length === 0) return null;
    const currentPlayer = players[gameState.currentPlayerIndex];
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    return (
      <div className="pt-24 pb-4 px-2 lg:px-6 h-screen flex flex-col lg:flex-row gap-6 overflow-hidden max-w-[1920px] mx-auto">
        {/* Left: Scoreboard (Desktop) */}
        <div className="hidden lg:flex flex-col w-72 bg-white rounded-2xl shadow-xl overflow-hidden border-4 border-violet-200 shrink-0">
          <div className="p-4 bg-violet-100 border-b border-violet-200">
            <h3 className="font-bold text-violet-900 flex items-center gap-2">
              <Trophy size={20} className="text-yellow-500"/> Leaderboard
            </h3>
          </div>
          <div className="overflow-y-auto p-2 space-y-2 bg-violet-50 flex-1">
            {sortedPlayers.map((p, i) => (
              <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl transition-all border-2 ${
                p.id === myPlayerId.current ? 'bg-white border-violet-400 shadow-md' : 'bg-white border-transparent hover:border-violet-200'
              }`}>
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className={`text-sm font-black w-6 text-center ${i < 3 ? 'text-yellow-600' : 'text-violet-300'}`}>#{i+1}</span>
                  <div className="relative">
                    <Avatar config={p.avatar} size="sm" />
                    {p.hasGuessedCorrectly && p.id !== currentPlayer?.id && (
                      <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-white"></div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold truncate text-violet-900">{p.name}</span>
                    {p.id === currentPlayer?.id && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded w-fit font-bold">DRAWING</span>}
                  </div>
                </div>
                <span className="font-bold text-violet-700 tabular-nums">{p.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="mb-3 flex justify-between items-center bg-white p-3 rounded-2xl shadow-lg border-2 border-violet-200">
            <div className="flex items-center gap-3">
              {isMyTurn ? (
                <div className="flex items-center gap-2">
                  <span className="text-violet-500 font-bold">DRAW THIS:</span>
                  <span className="bg-yellow-100 text-violet-900 px-3 py-1 rounded-lg font-black text-xl border-2 border-yellow-200">{gameState.currentWord?.word}</span>
                </div>
              ) : currentPlayer && (
                <div className="flex items-center gap-3">
                  <Avatar config={currentPlayer.avatar} size="sm" />
                  <div className="flex flex-col">
                    <span className="text-xs text-violet-400 font-bold uppercase">Artist</span>
                    <span className="font-bold text-violet-900">{currentPlayer.name}</span>
                  </div>
                </div>
              )}
            </div>
            
            {!isMyTurn && gameState.currentWord && (
              <div className="flex flex-col items-end">
                <div className="font-mono text-xl md:text-2xl font-bold tracking-[0.3em] text-violet-800 bg-violet-100 px-3 rounded-lg">
                  {gameState.phase === GamePhase.TURN_END 
                    ? gameState.currentWord.word 
                    : getMaskedWord(gameState.currentWord.word)
                  }
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 relative rounded-2xl overflow-hidden shadow-xl bg-white border-4 border-violet-600 min-h-0">
            {isMyTurn ? (
              <DrawingCanvas 
                onUpdate={updateDrawing}
                disabled={gameState.phase !== GamePhase.DRAWING}
                currentColor={brushColor}
                onColorChange={setBrushColor}
                initialData={gameState.canvasData}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white relative">
                {gameState.canvasData ? (
                  <img src={gameState.canvasData} className="w-full h-full object-contain" alt="Live Drawing" />
                ) : (
                  <div className="text-violet-300 animate-pulse flex flex-col items-center">
                    <Pencil size={48} className="mb-2"/>
                    <p className="font-bold">Waiting for drawing...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat */}
        <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl shadow-xl border-4 border-violet-300 overflow-hidden shrink-0 h-[35vh] lg:h-auto relative z-20">
          <div className="p-3 bg-violet-100 border-b border-violet-200 flex justify-between items-center shadow-sm">
            <h3 className="font-bold text-violet-900 text-sm flex items-center gap-2 uppercase tracking-wider"><MessageSquare size={16} className="text-violet-600"/> Guess / Chat</h3>
            <span className="text-xs font-bold bg-violet-200 text-violet-700 px-2 py-1 rounded-full">{players.length} online</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-violet-50 scrollbar-thin">
            {gameState.messages.map((msg) => (
              <div key={msg.id} className={`text-sm p-2.5 rounded-xl break-words shadow-sm animate-fade-in border ${
                msg.isSystem ? 'bg-violet-200 text-violet-800 border-violet-300 text-center text-xs italic' :
                msg.isCorrectGuess ? 'bg-green-100 text-green-900 border-green-300 font-bold' :
                'bg-white text-gray-800 border-violet-100'
              }`}>
                {!msg.isSystem && (
                  <div className="flex items-baseline justify-between mb-1">
                    <span className={`font-bold text-xs ${msg.isCorrectGuess ? 'text-green-700' : 'text-violet-600'}`}>{msg.playerName}</span>
                    <span className="text-[10px] text-gray-400">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                )}
                <span className="leading-relaxed">{msg.text}</span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-white border-t border-violet-100">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSubmitGuess(); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                disabled={isMyTurn}
                placeholder={isMyTurn ? "It's your turn!" : hasGuessed ? "You guessed! Chat here..." : "Type your guess here..."}
                className={`flex-1 px-4 py-3 rounded-xl border-2 focus:outline-none text-base font-medium transition-all ${hasGuessed ? 'bg-blue-50 border-blue-200 text-blue-900 placeholder-blue-400' : 'bg-violet-50 border-violet-200 focus:border-violet-500 focus:bg-white text-violet-900 placeholder-violet-400'}`}
                autoComplete="off"
              />
              <button 
                type="submit" 
                disabled={!guessInput || isMyTurn}
                className={`p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 shadow-md text-white ${hasGuessed ? 'bg-blue-500 hover:bg-blue-600' : 'bg-violet-600 hover:bg-violet-700 active:bg-violet-800'}`}
              >
                {hasGuessed ? <MessageSquare size={20} /> : <Send size={20} />}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const renderRoundSummary = () => {
    if (!gameState || players.length === 0) return null;
    const sorted = [...players].sort((a,b) => b.score - a.score);
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen animate-fade-in p-4">
        <div className="bg-white text-violet-900 p-8 rounded-3xl shadow-2xl border-4 border-violet-300 max-w-2xl w-full text-center space-y-8">
          <div className="flex items-center justify-center gap-4">
            <Trophy size={48} className="text-yellow-500 drop-shadow-md" />
            <h1 className="text-4xl font-black text-violet-800">Round {gameState.currentRound} Complete!</h1>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-xl text-violet-600 font-bold mb-4 uppercase tracking-widest">Current Standings</h2>
            {sorted.map((p, i) => (
              <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 ${i === 0 ? 'bg-yellow-50 border-yellow-400' : 'bg-violet-50 border-violet-100'}`}>
                <div className="flex items-center gap-4">
                  <span className={`font-black text-xl ${i === 0 ? 'text-yellow-600' : 'text-violet-400'}`}>#{i+1}</span>
                  <Avatar config={p.avatar} size="md" />
                  <span className="font-bold text-lg">{p.name}</span>
                </div>
                <span className="font-black text-xl text-violet-700">{p.score} pts</span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t-2 border-violet-100">
            <p className="text-violet-500 animate-pulse font-bold">Next round starting soon...</p>
          </div>
        </div>
      </div>
    );
  };

  const renderGameOver = () => {
    if (!gameState || players.length === 0) return null;
    const sorted = [...players].sort((a,b) => b.score - a.score);
    const winner = sorted[0];

    return (
      <div className="flex flex-col items-center justify-center min-h-screen animate-fade-in p-4">
        <div className="bg-white text-violet-900 p-8 rounded-3xl shadow-2xl border-4 border-violet-300 max-w-2xl w-full text-center space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-red-500 to-purple-600"></div>

          <h1 className="text-5xl font-black text-violet-800 mb-8">Game Over!</h1>
          
          <div className="flex flex-col items-center p-8 bg-yellow-50 rounded-3xl border-4 border-yellow-400 shadow-inner">
            <Trophy size={80} className="text-yellow-500 mb-6 drop-shadow-lg" />
            <div className="mb-6 transform scale-125">
              <Avatar config={winner.avatar} size="xl" />
            </div>
            <h2 className="text-4xl font-black text-violet-900 mb-2">{winner.name}</h2>
            <p className="text-2xl text-yellow-700 font-bold">{winner.score} pts</p>
            <div className="mt-4 text-sm uppercase tracking-[0.5em] text-violet-400 font-bold">Champion</div>
          </div>

          <div className="space-y-2 mt-8">
            {sorted.slice(1).map((p, i) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-violet-50 rounded-xl border border-violet-100">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-violet-400 w-8">#{i+2}</span>
                  <Avatar config={p.avatar} size="sm" />
                  <span className="font-bold text-violet-800">{p.name}</span>
                </div>
                <span className="font-bold text-violet-600">{p.score} pts</span>
              </div>
            ))}
          </div>

          <button 
            onClick={handleRestartGame}
            className="w-full py-4 bg-violet-800 text-white rounded-2xl font-bold text-xl hover:bg-violet-700 transition-all shadow-xl hover:scale-[1.02] active:scale-95 mt-8"
          >
            Play Again
          </button>
          <button 
            onClick={goToMainMenu}
            className="w-full py-2 text-violet-500 font-bold hover:text-violet-700"
          >
            Leave Room
          </button>
        </div>
      </div>
    );
  };

  // --- Main Render Switch ---

  if (phase === GamePhase.MENU) return renderMainMenu();
  if (phase === GamePhase.HOST_SETUP) return renderHostSetup();
  if (phase === GamePhase.LOBBY_BROWSER) return renderLobbyBrowser();
  if (phase === GamePhase.LOBBY_WAITING) return renderLobbyWaiting();
  if (phase === GamePhase.ROOM_LOBBY) return renderRoomLobby();
  if (phase === GamePhase.TURN_END) return renderTurnSummary();
  if (phase === GamePhase.ROUND_END) return renderRoundSummary();
  if (phase === GamePhase.GAME_OVER) return renderGameOver();

  return (
    <div className="min-h-screen bg-violet-900 pattern-bg text-white font-fredoka overflow-hidden">
      {renderConnectionStatus()}
      {renderHeader()}
      
      {phase === GamePhase.WORD_SELECTION && wordOptions.length > 0 && renderWordSelection()}
      
      {(phase === GamePhase.DRAWING || 
        phase === GamePhase.TURN_START || 
        phase === GamePhase.ROUND_START) && renderGameScreen()}
    </div>
  );
};

export default App;
