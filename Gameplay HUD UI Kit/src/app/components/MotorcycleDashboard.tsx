import { Gauge, Heart, Wrench } from 'lucide-react';

interface MotorcycleDashboardProps {
  speed: number;
  rpm: number;
  health: number;
  repairStatus?: string;
}

export function MotorcycleDashboard({ speed, rpm, health, repairStatus }: MotorcycleDashboardProps) {
  const maxRPM = 10000;
  const rpmPercentage = (rpm / maxRPM) * 100;
  
  const getRPMColor = () => {
    if (rpmPercentage > 80) return '#FF3E3E';
    if (rpmPercentage > 60) return '#FFB800';
    return '#00D084';
  };

  const getHealthColor = () => {
    if (health >= 70) return '#00D084';
    if (health >= 30) return '#FFB800';
    return '#FF3E3E';
  };

  return (
    <div className="absolute bottom-6 right-6 z-40">
      <div
        className="relative"
        style={{
          background: 'linear-gradient(135deg, #1C2533 0%, #0F141D 100%)',
          border: '4px solid #2A3444',
          borderRadius: '12px',
          padding: '20px',
          minWidth: '320px',
          boxShadow: `
            0 8px 24px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `
        }}
      >
        {/* Speed Display */}
        <div className="text-center mb-4">
          <div
            className="text-7xl tracking-tighter mb-1"
            style={{
              fontWeight: 900,
              color: '#FFFFFF',
              textShadow: '0 0 20px rgba(255, 107, 53, 0.4)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1
            }}
          >
            {speed}
          </div>
          <div
            className="text-xl uppercase tracking-widest"
            style={{
              color: '#8A9BA8',
              fontWeight: 700
            }}
          >
            km/h
          </div>
        </div>

        {/* RPM Gauge */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4" style={{ color: getRPMColor() }} />
              <div className="text-xs uppercase tracking-wider" style={{ color: '#8A9BA8' }}>
                RPM
              </div>
            </div>
            <div
              className="text-base tracking-tight"
              style={{
                fontWeight: 800,
                color: getRPMColor(),
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {rpm.toLocaleString()}
            </div>
          </div>
          <div
            className="relative h-4 rounded-full overflow-hidden"
            style={{
              background: '#0F141D',
              border: '2px solid #2A3444'
            }}
          >
            <div
              className="h-full transition-all duration-150"
              style={{
                width: `${rpmPercentage}%`,
                background: `linear-gradient(90deg, ${getRPMColor()} 0%, ${getRPMColor()}dd 100%)`,
                boxShadow: `0 0 12px ${getRPMColor()}80`
              }}
            />
          </div>
        </div>

        {/* Divider */}
        <div
          className="h-px mb-4"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #2A3444 50%, transparent 100%)'
          }}
        />

        {/* Health */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Heart
                className="w-4 h-4"
                style={{ color: getHealthColor() }}
                fill={health > 0 ? getHealthColor() : 'none'}
              />
              <div className="text-xs uppercase tracking-wider" style={{ color: '#8A9BA8' }}>
                Motorcycle Health
              </div>
            </div>
            <div
              className="text-base tracking-tight"
              style={{
                fontWeight: 800,
                color: getHealthColor(),
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {health}%
            </div>
          </div>
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
                width: `${health}%`,
                background: `linear-gradient(90deg, ${getHealthColor()} 0%, ${getHealthColor()}dd 100%)`,
                boxShadow: `0 0 12px ${getHealthColor()}80`
              }}
            />
          </div>

          {/* Repair Status */}
          {repairStatus && (
            <div className="flex items-center gap-2 mt-2">
              <Wrench className="w-3 h-3" style={{ color: '#00A8FF' }} />
              <div
                className="text-xs uppercase tracking-wider"
                style={{ color: '#00A8FF', fontWeight: 600 }}
              >
                {repairStatus}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
