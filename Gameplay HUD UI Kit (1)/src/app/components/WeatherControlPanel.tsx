import { CloudRain, Sun, Moon, X } from 'lucide-react';
import { motion } from 'motion/react';

interface WeatherControlPanelProps {
  onWeatherChange: (weather: 'rain' | 'sunny' | 'night' | null) => void;
  currentWeather: 'rain' | 'sunny' | 'night' | null;
}

export function WeatherControlPanel({ onWeatherChange, currentWeather }: WeatherControlPanelProps) {
  const weatherButtons = [
    {
      type: 'rain' as const,
      icon: CloudRain,
      label: 'Rain',
      color: '#00A8FF',
      gradient: 'linear-gradient(135deg, #00A8FF 0%, #0077CC 100%)'
    },
    {
      type: 'sunny' as const,
      icon: Sun,
      label: 'Sunny',
      color: '#FFB800',
      gradient: 'linear-gradient(135deg, #FFB800 0%, #FF6B35 100%)'
    },
    {
      type: 'night' as const,
      icon: Moon,
      label: 'Night',
      color: '#6B7CFF',
      gradient: 'linear-gradient(135deg, #6B7CFF 0%, #4A5CDD 100%)'
    }
  ];

  return (
    <div className="fixed top-1/2 right-6 -translate-y-1/2 z-[100]">
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="relative"
        style={{
          background: 'linear-gradient(135deg, #1C2533 0%, #0F141D 100%)',
          border: '4px solid #2A3444',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: `
            0 12px 32px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `
        }}
      >
        {/* Header */}
        <div className="text-center mb-4">
          <div
            className="text-sm uppercase tracking-widest mb-1"
            style={{
              color: '#8A9BA8',
              fontWeight: 700
            }}
          >
            Weather Events
          </div>
          <div
            className="text-xs"
            style={{ color: '#4A5668' }}
          >
            Click to activate
          </div>
        </div>

        {/* Weather Buttons */}
        <div className="flex flex-col gap-3 mb-3">
          {weatherButtons.map(({ type, icon: Icon, label, color, gradient }) => {
            const isActive = currentWeather === type;
            
            return (
              <motion.button
                key={type}
                onClick={() => onWeatherChange(type)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative rounded-lg p-4 transition-all"
                style={{
                  background: isActive ? gradient : 'rgba(26, 35, 50, 0.5)',
                  border: `3px solid ${isActive ? color : '#2A3444'}`,
                  boxShadow: isActive
                    ? `0 0 20px ${color}60, 0 4px 12px rgba(0, 0, 0, 0.4)`
                    : 'none',
                  cursor: 'pointer',
                  minWidth: '140px'
                }}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={isActive ? {
                      scale: [1, 1.2, 1],
                      rotate: type === 'sunny' ? [0, 360] : 0
                    } : {}}
                    transition={{
                      duration: type === 'sunny' ? 20 : 2,
                      repeat: isActive ? Infinity : 0,
                      ease: 'linear'
                    }}
                  >
                    <Icon
                      className="w-6 h-6"
                      style={{
                        color: isActive ? '#FFFFFF' : color
                      }}
                    />
                  </motion.div>
                  <div>
                    <div
                      className="text-base uppercase tracking-wider"
                      style={{
                        fontWeight: 800,
                        color: isActive ? '#FFFFFF' : '#E8EAED',
                        textShadow: isActive ? '0 2px 4px rgba(0, 0, 0, 0.3)' : 'none'
                      }}
                    >
                      {label}
                    </div>
                    {isActive && (
                      <div
                        className="text-xs uppercase mt-1"
                        style={{
                          color: 'rgba(255, 255, 255, 0.8)',
                          fontWeight: 600
                        }}
                      >
                        Active
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Clear Weather Button */}
        <motion.button
          onClick={() => onWeatherChange(null)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-full rounded-lg p-3 transition-all"
          style={{
            background: currentWeather === null
              ? 'linear-gradient(135deg, #4A5668 0%, #2A3444 100%)'
              : 'rgba(26, 35, 50, 0.5)',
            border: '3px solid #2A3444',
            cursor: 'pointer'
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <X className="w-5 h-5" style={{ color: '#8A9BA8' }} />
            <div
              className="text-sm uppercase tracking-wider"
              style={{
                fontWeight: 700,
                color: '#8A9BA8'
              }}
            >
              Clear Weather
            </div>
          </div>
        </motion.button>
      </motion.div>
    </div>
  );
}
