import { Trophy, Clock, Package } from 'lucide-react';
import { motion } from 'motion/react';

interface PlayerResult {
  rank: number;
  name: string;
  totalTime: string;
  timeDifference: string;
  deliveryQuality: number;
}

interface ResultsPanelProps {
  results: PlayerResult[];
}

export function ResultsPanel({ results }: ResultsPanelProps) {
  const getMedalColor = (rank: number) => {
    if (rank === 1) return '#FFB800';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return '#4A5668';
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 200 }}
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div
        className="relative"
        style={{
          background: 'linear-gradient(135deg, #1C2533 0%, #0F141D 100%)',
          border: '6px solid #2A3444',
          borderRadius: '24px',
          padding: '40px',
          maxWidth: '700px',
          width: '100%',
          boxShadow: `
            0 24px 64px rgba(0, 0, 0, 0.8),
            inset 0 2px 0 rgba(255, 255, 255, 0.1)
          `
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy
              className="w-12 h-12"
              style={{
                color: '#FFB800',
                filter: 'drop-shadow(0 0 20px rgba(255, 184, 0, 0.6))'
              }}
            />
            <h2
              className="text-5xl tracking-tight"
              style={{
                fontWeight: 900,
                color: '#FFFFFF',
                textShadow: '0 4px 12px rgba(255, 107, 53, 0.4)'
              }}
            >
              Race Results
            </h2>
          </div>
          <div
            className="text-base uppercase tracking-widest"
            style={{ color: '#8A9BA8', fontWeight: 700 }}
          >
            Final Standings
          </div>
        </div>

        {/* Results List */}
        <div className="space-y-3 mb-6">
          {results.map((result, index) => (
            <motion.div
              key={result.name}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className="relative rounded-lg p-4"
              style={{
                background: result.rank <= 3 
                  ? `linear-gradient(135deg, rgba(${result.rank === 1 ? '255, 184, 0' : result.rank === 2 ? '192, 192, 192' : '205, 127, 50'}, 0.15) 0%, rgba(15, 20, 29, 0.8) 100%)`
                  : 'rgba(26, 35, 50, 0.5)',
                border: `3px solid ${result.rank <= 3 ? getMedalColor(result.rank) : '#2A3444'}`,
                boxShadow: result.rank <= 3 
                  ? `0 0 20px ${getMedalColor(result.rank)}40`
                  : 'none'
              }}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Rank & Name */}
                <div className="flex items-center gap-4 flex-1">
                  <div
                    className="flex items-center justify-center rounded-lg"
                    style={{
                      width: '48px',
                      height: '48px',
                      background: `linear-gradient(135deg, ${getMedalColor(result.rank)} 0%, ${getMedalColor(result.rank)}dd 100%)`,
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: `0 4px 12px ${getMedalColor(result.rank)}60`
                    }}
                  >
                    <div
                      className="text-2xl"
                      style={{
                        fontWeight: 900,
                        color: result.rank <= 3 ? '#0F141D' : '#FFFFFF'
                      }}
                    >
                      {result.rank}
                    </div>
                  </div>
                  <div
                    className="text-xl"
                    style={{
                      fontWeight: 700,
                      color: '#E8EAED'
                    }}
                  >
                    {result.name}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6">
                  {/* Time */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4" style={{ color: '#00A8FF' }} />
                      <div className="text-xs uppercase" style={{ color: '#8A9BA8' }}>
                        Time
                      </div>
                    </div>
                    <div
                      className="text-lg tracking-tight"
                      style={{
                        fontWeight: 800,
                        color: '#FFFFFF',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {result.totalTime}
                    </div>
                    {result.timeDifference && (
                      <div
                        className="text-xs"
                        style={{
                          color: '#FF6B35',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        +{result.timeDifference}
                      </div>
                    )}
                  </div>

                  {/* Quality */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-4 h-4" style={{ color: '#00D084' }} />
                      <div className="text-xs uppercase" style={{ color: '#8A9BA8' }}>
                        Quality
                      </div>
                    </div>
                    <div
                      className="text-lg tracking-tight"
                      style={{
                        fontWeight: 800,
                        color: '#00D084',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {result.deliveryQuality}%
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
