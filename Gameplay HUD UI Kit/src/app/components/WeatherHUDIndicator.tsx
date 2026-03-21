import { CloudRain, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WeatherHUDIndicatorProps {
  weather: 'rain' | 'sunny' | 'night' | null;
}

export function WeatherHUDIndicator({ weather }: WeatherHUDIndicatorProps) {
  const getWeatherConfig = () => {
    switch (weather) {
      case 'rain':
        return {
          icon: <CloudRain className="w-6 h-6" style={{ color: '#FFFFFF' }} />,
          label: 'RAIN',
          color: '#00A8FF',
          bgGradient: 'linear-gradient(135deg, #00A8FF 0%, #0077CC 100%)'
        };
      case 'sunny':
        return {
          icon: <Sun className="w-6 h-6" style={{ color: '#FFFFFF' }} />,
          label: 'SUNNY',
          color: '#FFB800',
          bgGradient: 'linear-gradient(135deg, #FFB800 0%, #FF6B35 100%)'
        };
      case 'night':
        return {
          icon: <Moon className="w-6 h-6" style={{ color: '#FFFFFF' }} />,
          label: 'NIGHT',
          color: '#6B7CFF',
          bgGradient: 'linear-gradient(135deg, #6B7CFF 0%, #4A5CDD 100%)'
        };
      default:
        return null;
    }
  };

  const config = getWeatherConfig();

  return (
    <AnimatePresence>
      {config && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 15, stiffness: 300 }}
          className="absolute top-[460px] right-6 z-40"
        >
          <div
            className="relative rounded-lg p-3"
            style={{
              background: config.bgGradient,
              border: '3px solid rgba(255, 255, 255, 0.3)',
              boxShadow: `0 0 20px ${config.color}60, 0 4px 12px rgba(0, 0, 0, 0.4)`,
              minWidth: '80px'
            }}
          >
            <div className="flex flex-col items-center gap-2">
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: weather === 'sunny' ? [0, 360] : 0
                }}
                transition={{
                  duration: weather === 'sunny' ? 20 : 2,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              >
                {config.icon}
              </motion.div>
              <div
                className="text-xs uppercase tracking-widest"
                style={{
                  fontWeight: 800,
                  color: '#FFFFFF',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                }}
              >
                {config.label}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
