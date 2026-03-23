import { Package, MapPin, Clock } from 'lucide-react';

interface RaceStatusPanelProps {
  currentOrder: number;
  totalOrders: number;
  destination: string;
  raceTimer: string;
  countdown?: number | null;
  raceClosingTimer?: number | null;
}

export function RaceStatusPanel({
  currentOrder,
  totalOrders,
  destination,
  raceTimer,
  countdown,
  raceClosingTimer
}: RaceStatusPanelProps) {
  return (
    <div className="absolute top-6 left-6 z-40">
      <div 
        className="relative"
        style={{
          background: 'linear-gradient(135deg, #1C2533 0%, #0F141D 100%)',
          border: '4px solid #2A3444',
          borderRadius: '12px',
          padding: '16px 20px',
          minWidth: '280px',
          boxShadow: `
            0 8px 24px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `
        }}
      >
        {/* Order Count */}
        <div className="flex items-center gap-3 mb-3">
          <div 
            className="p-2 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
              boxShadow: '0 0 16px rgba(255, 107, 53, 0.4)'
            }}
          >
            <Package className="w-5 h-5" style={{ color: '#FFFFFF' }} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider" style={{ color: '#8A9BA8' }}>
              Order Progress
            </div>
            <div 
              className="text-2xl tracking-tight"
              style={{ 
                fontWeight: 800,
                color: '#FFFFFF',
                textShadow: '0 2px 8px rgba(255, 107, 53, 0.3)'
              }}
            >
              {currentOrder} <span style={{ color: '#8A9BA8' }}>/</span> {totalOrders}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div 
          className="h-px mb-3"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #2A3444 50%, transparent 100%)'
          }}
        />

        {/* Destination */}
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4" style={{ color: '#FFB800' }} />
          <div className="text-xs uppercase tracking-wider" style={{ color: '#8A9BA8' }}>
            Destination
          </div>
        </div>
        <div 
          className="text-base mb-3"
          style={{ fontWeight: 700, color: '#E8EAED' }}
        >
          {destination}
        </div>

        {/* Timer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: '#00A8FF' }} />
            <div className="text-xs uppercase tracking-wider" style={{ color: '#8A9BA8' }}>
              Race Time
            </div>
          </div>
          <div 
            className="text-xl tracking-tight"
            style={{ 
              fontWeight: 800,
              color: '#FFFFFF',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {raceTimer}
          </div>
        </div>

        {/* Countdown or Race Closing */}
        {countdown !== null && countdown !== undefined && (
          <div 
            className="mt-3 pt-3 text-center"
            style={{
              borderTop: '2px solid #2A3444'
            }}
          >
            <div 
              className="text-4xl tracking-tight"
              style={{ 
                fontWeight: 900,
                color: '#FFB800',
                textShadow: '0 0 20px rgba(255, 184, 0, 0.6)',
                animation: 'pulse 0.5s ease-in-out infinite'
              }}
            >
              {countdown === 0 ? 'GO!' : countdown}
            </div>
          </div>
        )}

        {raceClosingTimer !== null && raceClosingTimer !== undefined && (
          <div 
            className="mt-3 pt-3"
            style={{
              borderTop: '2px solid #2A3444',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 62, 62, 0.1) 50%, transparent 100%)'
            }}
          >
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#FF3E3E' }}>
                Race Closing
              </div>
              <div 
                className="text-xl tracking-tight"
                style={{ 
                  fontWeight: 800,
                  color: '#FF3E3E',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {raceClosingTimer}s
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
