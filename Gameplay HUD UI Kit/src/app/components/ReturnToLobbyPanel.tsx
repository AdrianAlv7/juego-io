import { ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface ReturnToLobbyPanelProps {
  countdown: number;
  onReturn: () => void;
}

export function ReturnToLobbyPanel({ countdown, onReturn }: ReturnToLobbyPanelProps) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, type: 'spring', damping: 20, stiffness: 200 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
    >
      <div
        className="relative"
        style={{
          background: 'linear-gradient(135deg, #1C2533 0%, #0F141D 100%)',
          border: '4px solid #2A3444',
          borderRadius: '16px',
          padding: '20px 32px',
          boxShadow: `
            0 12px 32px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `
        }}
      >
        <div className="flex items-center gap-6">
          {/* Countdown */}
          <div>
            <div
              className="text-xs uppercase tracking-widest mb-2 text-center"
              style={{ color: '#8A9BA8', fontWeight: 700 }}
            >
              Returning in
            </div>
            <div
              className="text-4xl tracking-tight text-center"
              style={{
                fontWeight: 900,
                color: '#FFB800',
                textShadow: '0 0 16px rgba(255, 184, 0, 0.4)',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {countdown}s
            </div>
          </div>

          {/* Divider */}
          <div
            className="w-px h-16"
            style={{
              background: 'linear-gradient(180deg, transparent 0%, #2A3444 50%, transparent 100%)'
            }}
          />

          {/* Manual Return Button */}
          <button
            onClick={onReturn}
            className="group flex items-center gap-3 px-6 py-4 rounded-lg transition-all"
            style={{
              background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
              border: '3px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 4px 16px rgba(255, 107, 53, 0.4)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 107, 53, 0.4)';
            }}
          >
            <ArrowLeft className="w-5 h-5" style={{ color: '#FFFFFF' }} />
            <div
              className="text-lg uppercase tracking-wider"
              style={{
                fontWeight: 800,
                color: '#FFFFFF',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              }}
            >
              Return to Lobby
            </div>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
