import { Cloud, CloudRain, Moon, Wind, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WeatherEventNotificationProps {
  eventName: string | null;
  eventStatus: string;
  remainingTime?: number;
}

export function WeatherEventNotification({
  eventName,
  eventStatus,
  remainingTime
}: WeatherEventNotificationProps) {
  const getIcon = () => {
    if (!eventName) return null;
    
    const name = eventName.toLowerCase();
    if (name.includes('rain')) return <CloudRain className="w-5 h-5" style={{ color: '#FFFFFF' }} />;
    if (name.includes('night')) return <Moon className="w-5 h-5" style={{ color: '#FFFFFF' }} />;
    if (name.includes('sunny') || name.includes('sun')) return <Sun className="w-5 h-5" style={{ color: '#FFFFFF' }} />;
    if (name.includes('wind')) return <Wind className="w-5 h-5" style={{ color: '#FFFFFF' }} />;
    return <Cloud className="w-5 h-5" style={{ color: '#FFFFFF' }} />;
  };

  const getBorderColor = () => {
    if (!eventName) return '#00A8FF';
    
    const name = eventName.toLowerCase();
    if (name.includes('rain')) return '#00A8FF';
    if (name.includes('night')) return '#6B7CFF';
    if (name.includes('sunny') || name.includes('sun')) return '#FFB800';
    return '#00A8FF';
  };

  const borderColor = getBorderColor();

  return (
    <AnimatePresence>
      {eventName && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="absolute top-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #1C2533 0%, #0F141D 100%)',
              border: `3px solid ${borderColor}`,
              boxShadow: `0 0 24px ${borderColor}66, 0 8px 16px rgba(0, 0, 0, 0.4)`
            }}
          >
            {getIcon()}
            <div>
              <div
                className="text-sm uppercase tracking-wider"
                style={{
                  fontWeight: 800,
                  color: borderColor,
                  letterSpacing: '0.05em'
                }}
              >
                {eventName}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className="text-xs uppercase"
                  style={{ color: '#8A9BA8', fontWeight: 600 }}
                >
                  {eventStatus}
                </div>
                {remainingTime !== undefined && (
                  <>
                    <div style={{ color: '#4A5668' }}>•</div>
                    <div
                      className="text-xs"
                      style={{
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {remainingTime}s
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}