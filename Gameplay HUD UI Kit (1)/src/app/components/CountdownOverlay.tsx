import { motion, AnimatePresence } from 'motion/react';

interface CountdownOverlayProps {
  count: number | null;
}

export function CountdownOverlay({ count }: CountdownOverlayProps) {
  return (
    <AnimatePresence>
      {count !== null && (
        <motion.div
          key={count}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
        >
          <div
            className="text-center"
            style={{
              fontSize: count === 0 ? '120px' : '200px',
              fontWeight: 900,
              color: '#FFFFFF',
              textShadow: `
                0 0 40px rgba(255, 184, 0, 0.8),
                0 0 80px rgba(255, 107, 53, 0.6),
                8px 8px 0px #FF6B35,
                12px 12px 0px rgba(0, 0, 0, 0.5)
              `,
              letterSpacing: '-0.02em',
              lineHeight: 1
            }}
          >
            {count === 0 ? 'GO!' : count}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
