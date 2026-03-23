import { Zap } from 'lucide-react';

interface TurboResourcePanelProps {
  turboCount: number;
}

export function TurboResourcePanel({ turboCount }: TurboResourcePanelProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div
        className="relative"
        style={{
          background: 'linear-gradient(135deg, #1C2533 0%, #0F141D 100%)',
          border: '4px solid #2A3444',
          borderRadius: '12px',
          padding: '12px 24px',
          boxShadow: `
            0 8px 24px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `
        }}
      >
        <div className="flex items-center gap-4">
          {/* Turbo Icon */}
          <div
            className="p-3 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #FFB800 0%, #FF6B35 100%)',
              boxShadow: '0 0 20px rgba(255, 184, 0, 0.5)'
            }}
          >
            <Zap
              className="w-6 h-6"
              style={{ color: '#FFFFFF' }}
              fill="#FFFFFF"
            />
          </div>

          {/* Turbo Count */}
          <div>
            <div
              className="text-xs uppercase tracking-widest mb-1"
              style={{ color: '#8A9BA8', fontWeight: 700 }}
            >
              Turbo Boost
            </div>
            <div className="flex items-baseline gap-2">
              <div
                className="text-3xl tracking-tight"
                style={{
                  fontWeight: 900,
                  color: '#FFFFFF',
                  textShadow: '0 0 16px rgba(255, 184, 0, 0.4)',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {turboCount}
              </div>
              <div
                className="text-base uppercase"
                style={{ color: '#8A9BA8', fontWeight: 700 }}
              >
                Available
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
