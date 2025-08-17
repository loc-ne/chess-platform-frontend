'use client';

import React from 'react';
import { useParams } from 'next/navigation';

import Board from '@/components/Board';
import Clock from '@/components/Clock';
import PlayerInfo from '@/components/PlayerInfo';
import GameResultDialog from '@/components/GameResult';
import ReplayControls from '@/components/ReplayControls';

import { useAuth } from '@/contexts/AuthContext';
import { ClientGameState, GameStateManager } from '@/game/GameState';
import { BitboardGame as LocalBitboardGame } from '@/game/Board';
import { Position } from '@/game/types';

// Types phù hợp với backend
interface PlayerData {
  userId: number;
  username: string;
  color: 'white' | 'black';
  rating?: number;
  isOnline: boolean;
}

interface CastlingRights {
  whiteKingSide: boolean;
  whiteQueenSide: boolean;
  blackKingSide: boolean;
  blackQueenSide: boolean;
}

interface WSPosition {
  row: number;
  col: number;
}

interface BitboardGame {
  white: any;
  black: any;
}

interface WSClientGameState {
  currentFen: string;
  bitboards: BitboardGame;
  activeColor: 'white' | 'black';
  castlingRights: CastlingRights;
  enPassantSquare: WSPosition | null;
}

interface WSStateUpdateMessage {
  type: string;
  roomId: string;
  gameState?: WSClientGameState;
  player1?: PlayerData;
  player2?: PlayerData;
  whiteTimeLeft?: number;
  blackTimeLeft?: number;
  error?: string;
  result?: string;
  reason?: string;
}

interface MoveHistoryItem {
  moveNumber: number;
  white: string;
  black?: string;
}

interface MoveHistoryProps {
  moves: MoveHistoryItem[];
  indexMoveHistory: number;
  setIndexMoveHistory: React.Dispatch<React.SetStateAction<number>>;
  bitboardStates: ClientGameState[];
  setGameState: (state: ClientGameState) => void;
}

// Convert functions
function convertBitboardsToBigInt(bitboards: BitboardGame): LocalBitboardGame {
  const keys = [
    'WhitePawns', 'WhiteRooks', 'WhiteKnights', 'WhiteBishops', 'WhiteQueens', 'WhiteKing',
    'BlackPawns', 'BlackRooks', 'BlackKnights', 'BlackBishops', 'BlackQueens', 'BlackKing'
  ];
  const result: LocalBitboardGame = {
    whitePawns: BigInt(0),
    whiteRooks: BigInt(0),
    whiteKnights: BigInt(0),
    whiteBishops: BigInt(0),
    whiteQueens: BigInt(0),
    whiteKing: BigInt(0),
    blackPawns: BigInt(0),
    blackRooks: BigInt(0),
    blackKnights: BigInt(0),
    blackBishops: BigInt(0),
    blackQueens: BigInt(0),
    blackKing: BigInt(0),
  };
  for (const key of keys) {
    const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
    result[camelKey as keyof LocalBitboardGame] =
  bitboards && typeof bitboards === 'object' && bitboards[key as keyof BitboardGame] !== undefined
    ? BigInt(bitboards[key as keyof BitboardGame])
    : BigInt(0);
  }
  return result;
}

function convertWSGameStateToClient(wsGameState: WSClientGameState): ClientGameState {
  return {
    currentFen: wsGameState.currentFen,
    bitboards: convertBitboardsToBigInt(wsGameState.bitboards),
    activeColor: wsGameState.activeColor,
    castlingRights: wsGameState.castlingRights,
    enPassantSquare: wsGameState.enPassantSquare ? {
      row: wsGameState.enPassantSquare.row,
      col: wsGameState.enPassantSquare.col
    } : null,
  };
}

const GameInfo: React.FC<{ gameType: string; timeControl: string }> = ({ gameType, timeControl }) => (
  <div className="bg-white-50 border border-blue-200 rounded-lg p-4 mb-4">
    <div className="text-lg font-bold text-blue-800 mb-2">{gameType} Game</div>
    <div className="text-sm text-blue-600 space-y-1">
      <div>Time Control: {timeControl}</div>
    </div>
  </div>
);

const MoveHistory: React.FC<MoveHistoryProps> = ({
  moves,
  indexMoveHistory,
  setIndexMoveHistory,
  bitboardStates,
  setGameState
}) => {
  const handleReplayStart = () => {
    setIndexMoveHistory(0);
    if (bitboardStates.length > 0) {
      setGameState(bitboardStates[0]);
    }
  };

  const handleReplayPrevious = () => {
    setIndexMoveHistory(prev => {
      const newIndex = Math.max(prev - 1, 0);
      if (bitboardStates.length > newIndex) {
        setGameState(bitboardStates[newIndex]);
      }
      return newIndex;
    });
  };

  const handleReplayNext = () => {
    setIndexMoveHistory(prev => {
      const newIndex = Math.min(prev + 1, bitboardStates.length - 1);
      if (bitboardStates.length > newIndex) {
        setGameState(bitboardStates[newIndex]);
      }
      return newIndex;
    });
  };

  const handleReplayEnd = () => {
    const lastIndex = bitboardStates.length - 1;
    setIndexMoveHistory(lastIndex);
    if (bitboardStates.length > lastIndex) {
      setGameState(bitboardStates[lastIndex]);
    }
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg h-96 flex flex-col">
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 rounded-t-lg">
        <h3 className="font-semibold text-gray-800">Move History</h3>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-1">
          {(!moves || moves.length === 0) ? (
            <div className="text-gray-500 text-sm text-center py-4">
              No moves yet
            </div>
          ) : (
            moves.map((move, index) => {
              const whiteMoveIndex = index * 2 + 1;
              const blackMoveIndex = index * 2 + 2;
              return (
                <div
                  key={index}
                  className="grid grid-cols-3 text-sm p-1 rounded"
                >
                  <div className="text-gray-500 font-mono">{move.moveNumber}.</div>
                  <div
                    className={`font-mono text-gray-800 rounded mr-2 ${indexMoveHistory !== 0 && indexMoveHistory === whiteMoveIndex
                        ? 'bg-blue-400 font-bold shadow border border-yellow-600'
                        : ''
                      }`}
                  >
                    {move.white}
                  </div>
                  <div
                    className={`font-mono text-gray-800 rounded ${indexMoveHistory !== 0 && indexMoveHistory === blackMoveIndex
                        ? 'bg-blue-400 font-bold shadow border border-yellow-600'
                        : ''
                      }`}
                  >
                    {move.black || ''}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className="flex justify-center w-full">
        <div className="bg-white border border-gray-300 shadow px-4 py-2 mt-2 w-full flex justify-center">
          <ReplayControls
            onStart={handleReplayStart}
            onPrevious={handleReplayPrevious}
            onNext={handleReplayNext}
            onEnd={handleReplayEnd}
          />
        </div>
      </div>
    </div>
  );
};

const GamePage: React.FC = () => {
  const params = useParams();
  const gameId = params?.gameId as string;
  const { user } = useAuth();

  // States
  const [players, setPlayers] = React.useState<PlayerData[]>([]);
  const [moveHistory, setMoveHistory] = React.useState<MoveHistoryItem[]>([]);
  const [gameState, setGameState] = React.useState<ClientGameState | null>(null);
  const [gameResult, setGameResult] = React.useState<{ result: string; reason: string } | null>(null);
  const [showDialog, setShowDialog] = React.useState(false);
  const [gameStatus, setGameStatus] = React.useState<'loading' | 'playing' | 'end'>('loading');
  const [playerTimes, setPlayerTimes] = React.useState<{ white: number; black: number }>({ white: 0, black: 0 });
  const [error, setError] = React.useState<string | null>(null);
  const [bitboardStates, setBitboardStates] = React.useState<ClientGameState[]>([]);
  const [indexMoveHistory, setIndexMoveHistory] = React.useState<number>(0);
  const [wsConnected, setWsConnected] = React.useState(false);

  const ws = React.useRef<WebSocket | null>(null);

  // WebSocket connection
  React.useEffect(() => {
    if (!gameId || !user?.id) return;

    console.log(`🔌 Connecting to WebSocket for game: ${gameId}`);

    // Kết nối WebSocket theo backend mới
    ws.current = new WebSocket('ws://localhost:3005/ws');

    ws.current.onopen = () => {
      console.log('✅ WebSocket connected');
      setWsConnected(true);
      setError(null);

      // ✅ CHỈ GỬI MESSAGE KHI ĐÃ CONNECTED
      const joinMessage = {
        type: 'joinRoom',
        roomId: gameId,
        userId: user.id,
        username: user.username || `User${user.id}`
      };

      console.log('📤 Sending joinRoom:', joinMessage);
      // Đảm bảo WebSocket đã sẵn sàng trước khi gửi
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(joinMessage));
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WSStateUpdateMessage = JSON.parse(event.data);
        console.log('📥 Received message:', message);

        switch (message.type) {
          case 'gameState':
            console.log('🎮 Initial game state received');
            handleGameStateMessage(message);
            break;

          case 'gameUpdate':
            console.log('🔄 Game state updated');
            handleGameUpdateMessage(message);
            break;

          case 'error':
            console.error('❌ Game error:', message.error);
            setError(message.error || 'Unknown error');
            break;

          case 'gameEnd':
            console.log('🏁 Game ended');
            handleGameEndMessage(message);
            break;

          default:
            console.log('❓ Unknown message type:', message.type);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.current.onclose = (event) => {
      console.log('❌ WebSocket closed:', event.code, event.reason);
      setWsConnected(false);

      // Auto-reconnect sau 3 giây nếu không phải do lỗi server
      if (event.code !== 1000 && event.code !== 1001) {
        setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          // Trigger reconnect bằng cách re-run effect
        }, 3000);
      }
    };

    ws.current.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setError('Connection error. Please check your network.');
      setWsConnected(false);
    };

    return () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
  }, [gameId, user?.id]);

  // Handle different message types
  const handleGameStateMessage = (message: WSStateUpdateMessage) => {
    if (message.gameState) {
      const clientGameState = convertWSGameStateToClient(message.gameState);
      console.log("ser ne: ", message.gameState);
      console.log("client ne: ", clientGameState);
      setGameState(clientGameState);
      setBitboardStates([clientGameState]);
      setIndexMoveHistory(0);
    }

    if (message.player1 && message.player2) {
      setPlayers([message.player1, message.player2]);
    }

    if (message.whiteTimeLeft !== undefined && message.blackTimeLeft !== undefined) {
      setPlayerTimes({
        white: message.whiteTimeLeft * 1000,
        black: message.blackTimeLeft * 1000
      });
    }

    setGameStatus('playing');
  };

  const handleGameUpdateMessage = (message: WSStateUpdateMessage) => {
    if (message.gameState) {
      const clientGameState = convertWSGameStateToClient(message.gameState);
      setGameState(clientGameState);

      // Update bitboard states for replay
      setBitboardStates(prev => [...prev, clientGameState]);
      setIndexMoveHistory(prev => prev + 1);
    }

    if (message.whiteTimeLeft !== undefined && message.blackTimeLeft !== undefined) {
      setPlayerTimes({
        white: message.whiteTimeLeft * 1000,
        black: message.blackTimeLeft * 1000
      });
    }
  };

  const handleGameEndMessage = (message: WSStateUpdateMessage) => {
    if (message.result && message.reason) {
      setGameResult({
        result: message.result,
        reason: message.reason
      });
      setShowDialog(true);
      setGameStatus('end');
    }
  };

  // Handle move
  const handleMove = (from: Position, to: Position, promotion?: string) => {
    if (!wsConnected || !ws.current) {
      console.error('❌ Cannot send move: WebSocket not connected');
      return;
    }

    const moveMessage = {
      type: 'move',
      fromRow: from.row,
      fromCol: from.col,
      toRow: to.row,
      toCol: to.col,
      ...(promotion && { promotion })
    };

    console.log('📤 Sending move:', moveMessage);
    ws.current.send(JSON.stringify(moveMessage));
  };

  // Get player info
  const myPlayer = user && players.length > 0
    ? players.find((p: PlayerData) => p.userId === user.id)
    : null;
  const opponentPlayer = user && players.length > 0
    ? players.find((p: PlayerData) => p.userId !== user.id)
    : null;

  // Determine player's color
  const myColor = myPlayer?.color || 'white';

  // Helper format time for Clock
  const formatTimeForClock = (timeInMs: number) => {
    const minutes = Math.floor(timeInMs / 60000);
    const seconds = Math.floor((timeInMs % 60000) / 1000);
    return { minutes, seconds };
  };

  // Loading state
  if (gameStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading game...</div>
          {!wsConnected && (
            <div className="text-red-600 mt-2">Connecting to game server...</div>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <div className="text-red-600 text-xl mb-4">❌ Error</div>
          <div className="text-gray-700 mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Connection status */}
        <div className={`mb-4 p-2 rounded text-sm ${wsConnected
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
          }`}>
          {wsConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left sidebar */}
          <div className="col-span-3">
            <GameInfo
              gameType="RAPID"
              timeControl="10+0"
            />

            <div className="bg-white border border-gray-300 rounded-lg p-3 mt-4">
              {opponentPlayer && (
                <div className="mb-4">
                  <PlayerInfo
                    username={opponentPlayer.username}
                    elo={opponentPlayer.rating || 1200}
                    isConnected={opponentPlayer.isOnline}
                    isCurrentPlayer={gameState?.activeColor === opponentPlayer.color}
                  />
                </div>
              )}
              {myPlayer && (
                <div>
                  <PlayerInfo
                    username={myPlayer.username}
                    elo={myPlayer.rating || 1200}
                    isConnected={myPlayer.isOnline}
                    isCurrentPlayer={gameState?.activeColor === myPlayer.color}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Game board */}
          <div className="col-span-6">
            <div className="flex flex-col items-center justify-center min-h-[600px]">
              {gameResult && (
                <GameResultDialog
                  isOpen={showDialog}
                  gameResult={gameResult}
                  onRematch={() => window.location.reload()}
                  onNewGame={() => window.location.href = '/match'}
                  onClose={() => setShowDialog(false)}
                />
              )}

              <div className="relative">
                {gameState && (
                  <Board
                    playerColor={myColor}
                    gameState={gameState}
                    onMove={handleMove}

                  />
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="col-span-3 flex flex-col justify-center">
            <div className="space-y-4">
              {/* Opponent timer */}
              {opponentPlayer && (
                <div className="bg-white border border-gray-300 rounded-lg p-3">
                  <Clock
                    initialMinutes={formatTimeForClock(playerTimes[opponentPlayer.color as 'white' | 'black']).minutes}
                    initialSeconds={formatTimeForClock(playerTimes[opponentPlayer.color as 'white' | 'black']).seconds}
                    increment={0}
                    isActive={gameStatus === 'playing' && gameState?.activeColor === opponentPlayer.color}
                    onTimeUp={() => console.log(`${opponentPlayer.color} time up!`)}
                  />
                </div>
              )}

              {/* Move history */}
              <MoveHistory
                moves={moveHistory}
                indexMoveHistory={indexMoveHistory}
                setIndexMoveHistory={setIndexMoveHistory}
                bitboardStates={bitboardStates}
                setGameState={setGameState}
              />

              {/* My timer */}
              {myPlayer && (
                <div className="bg-white border border-gray-300 rounded-lg p-3">
                  <Clock
                    initialMinutes={formatTimeForClock(playerTimes[myPlayer.color as 'white' | 'black']).minutes}
                    initialSeconds={formatTimeForClock(playerTimes[myPlayer.color as 'white' | 'black']).seconds}
                    increment={0}
                    isActive={gameStatus === 'playing' && gameState?.activeColor === myPlayer.color}
                    onTimeUp={() => console.log(`${myPlayer.color} time up!`)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePage;