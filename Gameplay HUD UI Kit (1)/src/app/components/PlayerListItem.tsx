import { Check, X, User } from 'lucide-react';
import { motion } from 'motion/react';

interface PlayerListItemProps {
  playerName: string;
  isReady: boolean;
  isCurrentPlayer?: boolean;
}

export function PlayerListItem({ playerName, isReady, isCurrentPlayer }: PlayerListItemProps) {
  return (
    <motion.div
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="relative"
      style={{
        background: isCurrentPlayer
          ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.15) 0%, rgba(15, 20, 29, 0.8) 100%)'
          : 'rgba(26, 35, 50, 0.5)',
        border: isCurrentPlayer
          ? '3px solid #FF6B35'
          : '3px solid #2A3444',
        borderRadius: '12px',
        padding: '16px 20px',
        boxShadow: isCurrentPlayer
          ? '0 0 16px rgba(255, 107, 53, 0.3)'
          : 'none',
        marginBottom: '12px'
      }}
    >
      <div className="flex items-center justify-between">
        {/* Player Info */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #2A3444 0%, #1C2533 100%)',
              border: '2px solid #3A4554'
            }}
          >
            <User className="w-6 h-6" style={{ color: '#8A9BA8' }} />
          </div>

          {/* Player Name */}
          <div>
            <div
              className="text-lg"
              style={{
                fontWeight: 700,
                color: '#E8EAED'
              }}
            >
              {playerName}
            </div>
            {isCurrentPlayer && (
              <div
                className="text-xs uppercase tracking-wider mt-1"
                style={{
                  color: '#FF6B35',
                  fontWeight: 600
                }}
              >
                You
              </div>
            )}
          </div>
        </div>

        {/* Status Indicator */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-lg"
          style={{
            background: isReady
              ? 'linear-gradient(135deg, #00D084 0%, #00A86B 100%)'
              : 'linear-gradient(135deg, #4A5668 0%, #2A3444 100%)',
            border: isReady
              ? '3px solid rgba(255, 255, 255, 0.3)'
              : '3px solid #1C2533',
            boxShadow: isReady
              ? '0 0 16px rgba(0, 208, 132, 0.4)'
              : 'none',
            minWidth: '120px',
            justifyContent: 'center'
          }}
        >
          {isReady ? (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10, stiffness: 300 }}
              >
                <Check
                  className="w-5 h-5"
                  style={{
                    color: '#FFFFFF',
                    strokeWidth: 3
                  }}
                />
              </motion.div>
              <div
                className="text-sm uppercase tracking-wider"
                style={{
                  fontWeight: 800,
                  color: '#FFFFFF',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                }}
              >
                Ready
              </div>
            </>
          ) : (
            <>
              <X
                className="w-5 h-5"
                style={{
                  color: '#8A9BA8',
                  strokeWidth: 3
                }}
              />
              <div
                className="text-sm uppercase tracking-wider"
                style={{
                  fontWeight: 800,
                  color: '#8A9BA8'
                }}
              >
                Not Ready
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
