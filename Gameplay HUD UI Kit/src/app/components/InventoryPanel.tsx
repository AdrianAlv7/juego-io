import { Trash2, X } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  count: number;
}

interface InventoryPanelProps {
  slot1: InventoryItem | null;
  slot2: InventoryItem | null;
  dropKey: string;
}

export function InventoryPanel({ slot1, slot2, dropKey }: InventoryPanelProps) {
  const renderSlot = (item: InventoryItem | null, slotNumber: number) => {
    if (!item) {
      return (
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: '60px',
            height: '60px',
            background: '#0F141D',
            border: '3px dashed #2A3444'
          }}
        >
          <div className="text-xs" style={{ color: '#4A5668' }}>
            Empty
          </div>
        </div>
      );
    }

    return (
      <div
        className="relative rounded-lg"
        style={{
          width: '60px',
          height: '60px',
          background: 'linear-gradient(135deg, #FF3E3E 0%, #C91F1F 100%)',
          border: '3px solid #FF6B6B',
          boxShadow: '0 0 16px rgba(255, 62, 62, 0.4)'
        }}
      >
        <div className="flex items-center justify-center h-full">
          <Trash2 className="w-6 h-6" style={{ color: '#FFFFFF' }} />
        </div>
        {item.count > 1 && (
          <div
            className="absolute -top-2 -right-2 rounded-full flex items-center justify-center"
            style={{
              width: '24px',
              height: '24px',
              background: '#FFB800',
              border: '2px solid #FFFFFF',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div
              className="text-xs"
              style={{
                fontWeight: 800,
                color: '#0F141D'
              }}
            >
              {item.count}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute bottom-[160px] right-6 z-40">
      <div
        className="relative"
        style={{
          background: 'linear-gradient(135deg, #1C2533 0%, #0F141D 100%)',
          border: '4px solid #2A3444',
          borderRadius: '12px',
          padding: '12px',
          boxShadow: `
            0 8px 24px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `
        }}
      >
        {/* Header */}
        <div
          className="text-xs uppercase tracking-wider mb-3 text-center"
          style={{ color: '#8A9BA8', fontWeight: 700 }}
        >
          Negative Items
        </div>

        {/* Slots */}
        <div className="flex gap-3 mb-3">
          {renderSlot(slot1, 1)}
          {renderSlot(slot2, 2)}
        </div>

        {/* Drop Instruction */}
        <div className="flex items-center justify-center gap-2 pt-2 border-t-2" style={{ borderColor: '#2A3444' }}>
          <div
            className="px-2 py-1 rounded text-xs"
            style={{
              background: '#2A3444',
              color: '#FFFFFF',
              fontWeight: 700
            }}
          >
            {dropKey}
          </div>
          <div className="text-xs" style={{ color: '#8A9BA8' }}>
            to drop
          </div>
        </div>
      </div>
    </div>
  );
}
