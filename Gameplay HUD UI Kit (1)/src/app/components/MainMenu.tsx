import { Users, Lock, Settings, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface MainMenuProps {
  onPublicMatch: () => void;
  onPrivateMatch: () => void;
  onSettings: () => void;
  onExtra: () => void;
}

export function MainMenu({ onPublicMatch, onPrivateMatch, onSettings, onExtra }: MainMenuProps) {
  const menuButtons = [
    {
      id: 'public',
      icon: Users,
      label: 'Public Match',
      color: '#FF6B35',
      gradient: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
      onClick: onPublicMatch
    },
    {
      id: 'private',
      icon: Lock,
      label: 'Private Match',
      color: '#00A8FF',
      gradient: 'linear-gradient(135deg, #00A8FF 0%, #0077CC 100%)',
      onClick: onPrivateMatch
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Settings',
      color: '#6B7CFF',
      gradient: 'linear-gradient(135deg, #6B7CFF 0%, #4A5CDD 100%)',
      onClick: onSettings
    },
    {
      id: 'extra',
      icon: Zap,
      label: 'Tournaments',
      color: '#FFB800',
      gradient: 'linear-gradient(135deg, #FFB800 0%, #FF9500 100%)',
      onClick: onExtra
    }
  ];

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

      {/* Main Menu Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="mb-16"
        >
          <h1
            className="text-8xl tracking-tight italic"
            style={{
              fontWeight: 800,
              color: '#FFFFFF',
              textShadow: `
                4px 4px 0px #FF6B35,
                8px 8px 0px rgba(0, 0, 0, 0.3),
                0 0 30px rgba(255, 107, 53, 0.5)
              `,
              letterSpacing: '-0.02em'
            }}
          >
            Deliver<span style={{ color: '#FFB800' }}>.io</span>
          </h1>
          <div
            className="text-center mt-4 text-xl uppercase tracking-widest"
            style={{
              color: '#8A9BA8',
              fontWeight: 700
            }}
          >
            Fast Delivery • Fast Racing
          </div>
        </motion.div>

        {/* Menu Buttons */}
        <div className="grid grid-cols-2 gap-6">
          {menuButtons.map((button, index) => (
            <motion.button
              key={button.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 200,
                delay: 0.1 + index * 0.1
              }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={button.onClick}
              className="relative group"
              style={{
                width: '280px',
                height: '140px',
                background: button.gradient,
                border: '4px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '16px',
                boxShadow: `0 8px 24px ${button.color}60, 0 4px 12px rgba(0, 0, 0, 0.4)`,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              {/* Shine effect on hover */}
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, transparent 50%)'
                }}
              />

              {/* Content */}
              <div className="relative flex flex-col items-center justify-center h-full gap-3 px-6">
                <button.icon
                  className="w-12 h-12"
                  style={{
                    color: '#FFFFFF',
                    filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))'
                  }}
                />
                <div
                  className="text-2xl uppercase tracking-wider"
                  style={{
                    fontWeight: 800,
                    color: '#FFFFFF',
                    textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                    letterSpacing: '0.05em'
                  }}
                >
                  {button.label}
                </div>
              </div>

              {/* Bottom accent line */}
              <div
                className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.3)'
                }}
              />
            </motion.button>
          ))}
        </div>

        {/* Version info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="absolute bottom-8 text-center"
          style={{
            color: '#4A5668',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          v1.0.0 Alpha • Arcade Racing Edition
        </motion.div>
      </div>
    </div>
  );
}
