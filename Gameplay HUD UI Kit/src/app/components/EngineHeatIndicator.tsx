import { Flame } from 'lucide-react';

interface EngineHeatIndicatorProps {
  heatPercentage: number;
  status: 'stable' | 'overheating' | 'cooling';
}

export function EngineHeatIndicator({ heatPercentage, status }: EngineHeatIndicatorProps) {
  const getStatusColor = () => {
    if (status === 'overheating') return '#FF3E3E';
    if (status === 'cooling') return '#00A8FF';
    return '#00D084';
  };

  const getStatusText = () => {
    if (status === 'overheating') return 'OVERHEATING';
    if (status === 'cooling') return 'COOLING';
    return 'STABLE';
  };

  const getHeatColor = () => {
    if (heatPercentage > 80) return '#FF3E3E';
    if (heatPercentage > 50) return '#FFB800';
    return '#00D084';
  };

  return (
    <div className="absolute top-[240px] right-6 z-40">
      <div
        className="relative"
        style={{
          background: 'linear-gradient(135deg, #1C2533 0%, #0F141D 100%)',
          border: '4px solid #2A3444',
          borderRadius: '12px',
          padding: '12px 16px',
          minWidth: '200px',
          boxShadow: `
            0 8px 24px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame
              className="w-5 h-5"
              style={{
                color: getHeatColor(),
                filter: `drop-shadow(0 0 8px ${getHeatColor()})`
              }}
            />
            <div
              className="text-xs uppercase tracking-wider"
              style={{ color: '#8A9BA8', fontWeight: 700 }}
            >
              Engine Heat
            </div>
          </div>
          <div
            className="text-lg tracking-tight"
            style={{
              fontWeight: 800,
              color: getHeatColor(),
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {heatPercentage}%
          </div>
        </div>

        {/* Heat Bar */}
        <div
          className="relative h-3 rounded-full overflow-hidden mb-2"
          style={{
            background: '#0F141D',
            border: '2px solid #2A3444'
          }}
        >
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${heatPercentage}%`,
              background: `linear-gradient(90deg, ${getHeatColor()} 0%, ${getHeatColor()}dd 100%)`,
              boxShadow: `0 0 12px ${getHeatColor()}80`
            }}
          />
        </div>

        {/* Status */}
        <div
          className="text-xs text-center uppercase tracking-widest"
          style={{
            color: getStatusColor(),
            fontWeight: 700
          }}
        >
          {getStatusText()}
        </div>
      </div>
    </div>
  );
}
