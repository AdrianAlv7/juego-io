import { motion, AnimatePresence } from 'motion/react';

interface WeatherOverlayProps {
  weather: 'rain' | 'sunny' | 'night' | null;
}

export function WeatherOverlay({ weather }: WeatherOverlayProps) {
  return (
    <>
      {/* Rain Event */}
      <AnimatePresence>
        {weather === 'rain' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="fixed inset-0 z-10 pointer-events-none"
          >
            {/* Cool blue tone overlay with desaturation */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(180deg, rgba(100, 150, 200, 0.15) 0%, rgba(50, 100, 150, 0.1) 100%)',
                mixBlendMode: 'normal'
              }}
            />

            {/* Desaturation filter */}
            <div
              className="absolute inset-0"
              style={{
                background: 'rgba(180, 200, 220, 0.08)',
                backdropFilter: 'saturate(0.7) brightness(0.9)'
              }}
            />

            {/* Rain particles - multiple layers for depth */}
            <div className="absolute inset-0 overflow-hidden">
              {/* Heavy rain drops */}
              {[...Array(40)].map((_, i) => (
                <div
                  key={`heavy-${i}`}
                  className="absolute"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: '-10%',
                    width: '2px',
                    height: `${30 + Math.random() * 50}px`,
                    background: 'linear-gradient(180deg, transparent, rgba(200, 220, 255, 0.5), transparent)',
                    animation: `rainDrop ${0.4 + Math.random() * 0.3}s linear infinite`,
                    animationDelay: `${Math.random() * 2}s`,
                    transform: 'skewX(-10deg)'
                  }}
                />
              ))}
              
              {/* Light rain drops */}
              {[...Array(30)].map((_, i) => (
                <div
                  key={`light-${i}`}
                  className="absolute"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: '-10%',
                    width: '1px',
                    height: `${15 + Math.random() * 30}px`,
                    background: 'linear-gradient(180deg, transparent, rgba(200, 220, 255, 0.3), transparent)',
                    animation: `rainDrop ${0.6 + Math.random() * 0.4}s linear infinite`,
                    animationDelay: `${Math.random() * 2}s`,
                    transform: 'skewX(-10deg)'
                  }}
                />
              ))}
            </div>

            {/* Water droplets on "screen" effect */}
            <div className="absolute inset-0">
              {[...Array(15)].map((_, i) => (
                <motion.div
                  key={`droplet-${i}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: [0, 1, 1],
                    opacity: [0, 0.6, 0],
                    y: [0, Math.random() * 100 + 50]
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    repeat: Infinity,
                    delay: Math.random() * 3,
                    ease: 'easeIn'
                  }}
                  className="absolute rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 30}%`,
                    width: `${8 + Math.random() * 12}px`,
                    height: `${12 + Math.random() * 18}px`,
                    background: 'radial-gradient(ellipse, rgba(200, 220, 255, 0.3) 0%, transparent 70%)',
                    border: '1px solid rgba(200, 220, 255, 0.2)',
                    filter: 'blur(1px)'
                  }}
                />
              ))}
            </div>

            {/* Wet asphalt reflections */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1/3"
              style={{
                background: 'linear-gradient(0deg, rgba(100, 150, 200, 0.15) 0%, transparent 100%)',
                opacity: 0.4
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sunny Event */}
      <AnimatePresence>
        {weather === 'sunny' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="fixed inset-0 z-10 pointer-events-none"
          >
            {/* Warm golden tone overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(180deg, rgba(255, 200, 100, 0.12) 0%, rgba(255, 180, 80, 0.08) 100%)',
                mixBlendMode: 'screen'
              }}
            />

            {/* Brightness boost */}
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: 'brightness(1.15) saturate(1.2)'
              }}
            />

            {/* Sun flare effects */}
            <div className="absolute top-20 right-32">
              <motion.div
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.1, 1]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="relative"
                style={{
                  width: '200px',
                  height: '200px'
                }}
              >
                {/* Main flare */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(255, 240, 180, 0.4) 0%, rgba(255, 200, 100, 0.2) 30%, transparent 70%)',
                    filter: 'blur(40px)'
                  }}
                />
                
                {/* Flare rays */}
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 left-1/2"
                    style={{
                      width: '150px',
                      height: '2px',
                      background: 'linear-gradient(90deg, rgba(255, 240, 180, 0.3), transparent)',
                      transform: `translate(-50%, -50%) rotate(${i * 45}deg)`,
                      transformOrigin: 'left center',
                      filter: 'blur(2px)'
                    }}
                  />
                ))}
              </motion.div>
            </div>

            {/* Additional glow accents */}
            <div className="absolute inset-0">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={`glow-${i}`}
                  animate={{
                    opacity: [0, 0.3, 0],
                    scale: [0.8, 1.2, 0.8]
                  }}
                  transition={{
                    duration: 4 + Math.random() * 2,
                    repeat: Infinity,
                    delay: Math.random() * 3
                  }}
                  className="absolute rounded-full"
                  style={{
                    left: `${20 + Math.random() * 60}%`,
                    top: `${10 + Math.random() * 40}%`,
                    width: `${100 + Math.random() * 150}px`,
                    height: `${100 + Math.random() * 150}px`,
                    background: 'radial-gradient(circle, rgba(255, 220, 120, 0.15) 0%, transparent 70%)',
                    filter: 'blur(30px)'
                  }}
                />
              ))}
            </div>

            {/* Warm light from bottom (road reflection) */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1/2"
              style={{
                background: 'linear-gradient(0deg, rgba(255, 200, 100, 0.1) 0%, transparent 100%)',
                opacity: 0.5
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Night Event */}
      <AnimatePresence>
        {weather === 'night' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="fixed inset-0 z-10 pointer-events-none"
          >
            {/* Dark blue tone overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(180deg, rgba(10, 15, 40, 0.5) 0%, rgba(0, 0, 20, 0.4) 100%)',
                mixBlendMode: 'multiply'
              }}
            />

            {/* Cool blue tint */}
            <div
              className="absolute inset-0"
              style={{
                background: 'rgba(80, 100, 160, 0.15)',
                backdropFilter: 'saturate(0.8) brightness(0.7)'
              }}
            />

            {/* Moon */}
            <div className="absolute top-24 left-32">
              <motion.div
                animate={{
                  opacity: [0.8, 1, 0.8]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              >
                {/* Moon glow */}
                <div
                  className="absolute -inset-8 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(200, 220, 255, 0.3) 0%, transparent 70%)',
                    filter: 'blur(20px)'
                  }}
                />
                {/* Moon body */}
                <div
                  className="relative rounded-full"
                  style={{
                    width: '80px',
                    height: '80px',
                    background: 'radial-gradient(circle at 30% 30%, rgba(240, 245, 255, 0.6) 0%, rgba(200, 210, 230, 0.4) 100%)',
                    boxShadow: '0 0 40px rgba(200, 220, 255, 0.4), inset -10px -10px 20px rgba(150, 170, 200, 0.2)'
                  }}
                />
              </motion.div>
            </div>

            {/* Stars */}
            <div className="absolute inset-0">
              {[...Array(50)].map((_, i) => (
                <motion.div
                  key={`star-${i}`}
                  animate={{
                    opacity: [0.3, 1, 0.3]
                  }}
                  transition={{
                    duration: 2 + Math.random() * 3,
                    repeat: Infinity,
                    delay: Math.random() * 5
                  }}
                  className="absolute rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 50}%`,
                    width: `${1 + Math.random() * 2}px`,
                    height: `${1 + Math.random() * 2}px`,
                    background: '#FFFFFF',
                    boxShadow: '0 0 4px rgba(255, 255, 255, 0.8)'
                  }}
                />
              ))}
            </div>

            {/* Street light reflections */}
            <div className="absolute inset-0">
              {[...Array(8)].map((_, i) => (
                <div
                  key={`light-${i}`}
                  className="absolute"
                  style={{
                    left: `${10 + i * 12}%`,
                    top: '20%',
                    width: '2px',
                    height: '60%',
                    background: 'linear-gradient(180deg, rgba(255, 240, 200, 0.1) 0%, transparent 100%)',
                    filter: 'blur(20px)',
                    opacity: 0.6
                  }}
                >
                  {/* Light source */}
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2"
                    style={{
                      width: '60px',
                      height: '60px',
                      background: 'radial-gradient(circle, rgba(255, 240, 200, 0.3) 0%, transparent 70%)',
                      filter: 'blur(15px)'
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Road reflections at night */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1/3"
              style={{
                background: 'linear-gradient(0deg, rgba(80, 100, 160, 0.2) 0%, transparent 100%)',
                opacity: 0.5
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
