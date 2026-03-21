import { MapPin, Circle, Package } from 'lucide-react';

interface MinimapProps {
  playerPosition: { x: number; y: number };
  otherPlayers: Array<{ id: string; x: number; y: number }>;
  targetPosition: { x: number; y: number };
}

export function Minimap({ playerPosition, otherPlayers, targetPosition }: MinimapProps) {
  return (
    <div className="absolute top-6 right-6 z-40">
      <div
        className="relative"
        style={{
          background: 'linear-gradient(135deg, #1C2533 0%, #0F141D 100%)',
          border: '4px solid #2A3444',
          borderRadius: '12px',
          padding: '12px',
          width: '200px',
          height: '200px',
          boxShadow: `
            0 8px 24px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `
        }}
      >
        {/* Map Title */}
        <div
          className="text-xs uppercase tracking-wider mb-2 text-center"
          style={{ color: '#8A9BA8', fontWeight: 700 }}
        >
          Navigation
        </div>

        {/* Map Area */}
        <div
          className="relative rounded-lg overflow-hidden"
          style={{
            width: '100%',
            height: '150px',
            background: 'linear-gradient(135deg, #0F141D 0%, #1A2332 100%)',
            border: '2px solid #2A3444'
          }}
        >
          {/* Grid Pattern */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(#2A3444 1px, transparent 1px),
                linear-gradient(90deg, #2A3444 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />

          {/* Target Marker */}
          <div
            className="absolute"
            style={{
              left: `${targetPosition.x}%`,
              top: `${targetPosition.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="relative">
              <MapPin
                className="w-6 h-6"
                style={{
                  color: '#FFB800',
                  filter: 'drop-shadow(0 0 8px rgba(255, 184, 0, 0.8))'
                }}
                fill="#FFB800"
              />
              <div
                className="absolute inset-0 rounded-full animate-ping"
                style={{
                  background: 'rgba(255, 184, 0, 0.4)',
                  width: '24px',
                  height: '24px'
                }}
              />
            </div>
          </div>

          {/* Other Players */}
          {otherPlayers.map((player) => (
            <div
              key={player.id}
              className="absolute"
              style={{
                left: `${player.x}%`,
                top: `${player.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <Circle
                className="w-3 h-3"
                style={{
                  color: '#00A8FF',
                  filter: 'drop-shadow(0 0 4px rgba(0, 168, 255, 0.6))'
                }}
                fill="#00A8FF"
              />
            </div>
          ))}

          {/* Player Position */}
          <div
            className="absolute"
            style={{
              left: `${playerPosition.x}%`,
              top: `${playerPosition.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div
              className="rounded-full"
              style={{
                width: '12px',
                height: '12px',
                background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
                border: '2px solid #FFFFFF',
                boxShadow: '0 0 12px rgba(255, 107, 53, 0.8)'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
