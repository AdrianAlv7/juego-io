import { Package } from 'lucide-react';

interface PackageStatusPanelProps {
  packageIntegrity: number;
  averageQuality: number;
}

export function PackageStatusPanel({ packageIntegrity, averageQuality }: PackageStatusPanelProps) {
  const getIntegrityColor = () => {
    if (packageIntegrity >= 80) return '#00D084';
    if (packageIntegrity >= 50) return '#FFB800';
    return '#FF3E3E';
  };

  const getQualityColor = () => {
    if (averageQuality >= 80) return '#00D084';
    if (averageQuality >= 50) return '#FFB800';
    return '#FF3E3E';
  };

  return (
    <div className="absolute bottom-6 left-6 z-40">
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
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="p-2 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #00A8FF 0%, #0077CC 100%)',
              boxShadow: '0 0 16px rgba(0, 168, 255, 0.4)'
            }}
          >
            <Package className="w-5 h-5" style={{ color: '#FFFFFF' }} />
          </div>
          <div
            className="text-base uppercase tracking-wider"
            style={{ color: '#E8EAED', fontWeight: 700 }}
          >
            Package Status
          </div>
        </div>

        {/* Package Integrity */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider" style={{ color: '#8A9BA8' }}>
              Package Integrity
            </div>
            <div
              className="text-lg tracking-tight"
              style={{
                fontWeight: 800,
                color: getIntegrityColor(),
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {packageIntegrity}%
            </div>
          </div>
          <div
            className="relative h-3 rounded-full overflow-hidden"
            style={{
              background: '#0F141D',
              border: '2px solid #2A3444'
            }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${packageIntegrity}%`,
                background: `linear-gradient(90deg, ${getIntegrityColor()} 0%, ${getIntegrityColor()}dd 100%)`,
                boxShadow: `0 0 12px ${getIntegrityColor()}80`
              }}
            />
          </div>
        </div>

        {/* Divider */}
        <div
          className="h-px mb-3"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #2A3444 50%, transparent 100%)'
          }}
        />

        {/* Average Quality */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider" style={{ color: '#8A9BA8' }}>
              Average Delivery Quality
            </div>
            <div
              className="text-lg tracking-tight"
              style={{
                fontWeight: 800,
                color: getQualityColor(),
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {averageQuality}%
            </div>
          </div>
          <div
            className="relative h-3 rounded-full overflow-hidden"
            style={{
              background: '#0F141D',
              border: '2px solid #2A3444'
            }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${averageQuality}%`,
                background: `linear-gradient(90deg, ${getQualityColor()} 0%, ${getQualityColor()}dd 100%)`,
                boxShadow: `0 0 12px ${getQualityColor()}80`
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
