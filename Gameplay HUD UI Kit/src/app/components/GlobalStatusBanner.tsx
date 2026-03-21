import { Zap, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GlobalStatusBannerProps {
  message: string | null;
  type?: 'info' | 'warning' | 'turbo';
}

export function GlobalStatusBanner({ message, type = 'info' }: GlobalStatusBannerProps) {
  const getIcon = () => {
    switch (type) {
      case 'turbo':
        return <Zap className="w-5 h-5" style={{ color: '#FFFFFF' }} />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" style={{ color: '#FFFFFF' }} />;
      default:
        return <Info className="w-5 h-5" style={{ color: '#FFFFFF' }} />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'turbo':
        return {
          bg: 'linear-gradient(135deg, #FFB800 0%, #FF6B35 100%)',
          shadow: '0 0 24px rgba(255, 184, 0, 0.6)'
        };
      case 'warning':
        return {
          bg: 'linear-gradient(135deg, #FF3E3E 0%, #C91F1F 100%)',
          shadow: '0 0 24px rgba(255, 62, 62, 0.6)'
        };
      default:
        return {
          bg: 'linear-gradient(135deg, #00A8FF 0%, #0077CC 100%)',
          shadow: '0 0 24px rgba(0, 168, 255, 0.6)'
        };
    }
  };

  const colors = getColors();

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="absolute top-24 left-1/2 -translate-x-1/2 z-50"
        >
          <div
            className="flex items-center gap-3 px-6 py-3 rounded-lg"
            style={{
              background: colors.bg,
              border: '3px solid rgba(255, 255, 255, 0.3)',
              boxShadow: `${colors.shadow}, 0 8px 16px rgba(0, 0, 0, 0.4)`,
              minWidth: '300px'
            }}
          >
            <div className="flex-shrink-0">{getIcon()}</div>
            <div
              className="text-lg tracking-tight uppercase"
              style={{
                fontWeight: 800,
                color: '#FFFFFF',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                letterSpacing: '0.05em'
              }}
            >
              {message}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
