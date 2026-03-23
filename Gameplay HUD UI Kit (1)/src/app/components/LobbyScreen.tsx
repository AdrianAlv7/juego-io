import { ArrowLeft, Check, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayerListItem } from './PlayerListItem';

interface Player {
  id: string;
  name: string;
  isReady: boolean;
}

interface LobbyScreenProps {
  players: Player[];
  currentPlayerId: string;
  isReady: boolean;
  countdown: number | null;
  onToggleReady: () => void;
  onLeaveLobby: () => void;
}

export function LobbyScreen({
  players,
  currentPlayerId,
  isReady,
  countdown,
  onToggleReady,
  onLeaveLobby
}: LobbyScreenProps) {
  const allReady = players.length >= 2 && players.every((p) => p.isReady);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: 'linear-gradient(135deg, #0F141D 0%, #1A2332 100%)'
        }}
      >
        {/* Asphalt texture overlay */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(255, 255, 255, 0.03) 10px,
                rgba(255, 255, 255, 0.03) 20px
              )
            `
          }}
        />
        {/* Road reflection effect */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(ellipse at bottom, rgba(100, 150, 200, 0.15) 0%, transparent 60%)'
          }}
        />
      </div>

      {/* Lobby Content */}
      <div className="relative z-10 w-full max-w-4xl px-6">
        {/* Logo */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8"
        >
          <h1
            className="text-6xl tracking-tight italic"
            style={{
              fontWeight: 800,
              color: '#FFFFFF',
              textShadow: `
                3px 3px 0px #FF6B35,
                6px 6px 0px rgba(0, 0, 0, 0.3),
                0 0 20px rgba(255, 107, 53, 0.4)
              `,
              letterSpacing: '-0.02em'
            }}
          >
            Deliver<span style={{ color: '#FFB800' }}>.io</span>
          </h1>
        </motion.div>

        {/* Countdown Timer */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div
              initial={{ y: -50, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -50, opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              className="mx-auto mb-8"
              style={{
                maxWidth: '400px'
              }}
            >
              <div
                className="relative rounded-xl p-6"
                style={{
                  background: 'linear-gradient(135deg, #FFB800 0%, #FF6B35 100%)',
                  border: '4px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 0 32px rgba(255, 184, 0, 0.6), 0 8px 24px rgba(0, 0, 0, 0.4)'
                }}
              >
                <div className="flex items-center justify-center gap-4">
                  <Clock
                    className="w-8 h-8"
                    style={{
                      color: '#FFFFFF',
                      filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
                    }}
                  />
                  <div>
                    <div
                      className="text-sm uppercase tracking-widest mb-1"
                      style={{
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontWeight: 700
                      }}
                    >
                      Race Starting In
                    </div>
                    <motion.div
                      key={countdown}
                      initial={{ scale: 1.3 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 10 }}
                      className="text-5xl tracking-tight"
                      style={{
                        fontWeight: 900,
                        color: '#FFFFFF',
                        textShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {countdown}
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Lobby Panel */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.1 }}
          className="relative"
          style={{
            background: 'linear-gradient(135deg, #1C2533 0%, #0F141D 100%)',
            border: '6px solid #2A3444',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8), inset 0 2px 0 rgba(255, 255, 255, 0.1)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2
                className="text-3xl tracking-tight mb-2"
                style={{
                  fontWeight: 800,
                  color: '#FFFFFF',
                  textShadow: '0 2px 8px rgba(255, 107, 53, 0.3)'
                }}
              >
                Race Lobby
              </h2>
              <div
                className="text-sm uppercase tracking-wider"
                style={{
                  color: '#8A9BA8',
                  fontWeight: 700
                }}
              >
                {players.length} / 6 Players
              </div>
            </div>

            {/* Ready Status Badge */}
            {allReady && countdown === null && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="px-4 py-2 rounded-lg"
                style={{
                  background: 'linear-gradient(135deg, #00D084 0%, #00A86B 100%)',
                  border: '3px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 0 20px rgba(0, 208, 132, 0.5)'
                }}
              >
                <div
                  className="text-sm uppercase tracking-wider"
                  style={{
                    fontWeight: 800,
                    color: '#FFFFFF'
                  }}
                >
                  All Players Ready!
                </div>
              </motion.div>
            )}
          </div>

          {/* Divider */}
          <div
            className="h-px mb-6"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, #2A3444 50%, transparent 100%)'
            }}
          />

          {/* Player List */}
          <div className="mb-6">
            <div
              className="text-xs uppercase tracking-widest mb-4"
              style={{
                color: '#8A9BA8',
                fontWeight: 700
              }}
            >
              Players
            </div>
            <div>
              {players.map((player) => (
                <PlayerListItem
                  key={player.id}
                  playerName={player.name}
                  isReady={player.isReady}
                  isCurrentPlayer={player.id === currentPlayerId}
                />
              ))}

              {/* Empty slots */}
              {[...Array(Math.max(0, 6 - players.length))].map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="relative"
                  style={{
                    background: 'rgba(26, 35, 50, 0.3)',
                    border: '3px dashed #2A3444',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '12px'
                  }}
                >
                  <div
                    className="text-center text-sm uppercase tracking-wider"
                    style={{
                      color: '#4A5668',
                      fontWeight: 700
                    }}
                  >
                    Waiting for player...
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            {/* Ready Button */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onToggleReady}
              className="flex-1 relative group"
              style={{
                background: isReady
                  ? 'linear-gradient(135deg, #00D084 0%, #00A86B 100%)'
                  : 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
                border: '4px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: isReady
                  ? '0 0 24px rgba(0, 208, 132, 0.5), 0 8px 16px rgba(0, 0, 0, 0.4)'
                  : '0 0 24px rgba(255, 107, 53, 0.5), 0 8px 16px rgba(0, 0, 0, 0.4)',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              <div className="flex items-center justify-center gap-3">
                {isReady ? (
                  <>
                    <X className="w-6 h-6" style={{ color: '#FFFFFF' }} strokeWidth={3} />
                    <div
                      className="text-xl uppercase tracking-wider"
                      style={{
                        fontWeight: 800,
                        color: '#FFFFFF',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      Not Ready
                    </div>
                  </>
                ) : (
                  <>
                    <Check className="w-6 h-6" style={{ color: '#FFFFFF' }} strokeWidth={3} />
                    <div
                      className="text-xl uppercase tracking-wider"
                      style={{
                        fontWeight: 800,
                        color: '#FFFFFF',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      Ready Up
                    </div>
                  </>
                )}
              </div>
            </motion.button>

            {/* Leave Button */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onLeaveLobby}
              style={{
                background: 'linear-gradient(135deg, #4A5668 0%, #2A3444 100%)',
                border: '4px solid #2A3444',
                borderRadius: '16px',
                padding: '20px 32px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              <div className="flex items-center gap-3">
                <ArrowLeft className="w-6 h-6" style={{ color: '#8A9BA8' }} />
                <div
                  className="text-xl uppercase tracking-wider"
                  style={{
                    fontWeight: 800,
                    color: '#8A9BA8'
                  }}
                >
                  Leave
                </div>
              </div>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
