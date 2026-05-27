import React from 'react';

interface ModulePanelProps {
  title: string;
  subtitle?: string;
  width?: number;
  children: React.ReactNode;
  accentColor?: string;
  badge?: string;
}

function ModulePanelComponent({
  title,
  subtitle,
  width = 180,
  children,
  accentColor = '#a78bfa',
  badge,
}: ModulePanelProps) {
  return (
    <div
      className="relative flex flex-col rounded-lg overflow-hidden select-none"
      style={{
        width,
        background: 'linear-gradient(160deg, #12122a 0%, #0d0d1f 60%, #0a0a18 100%)',
        border: '1px solid #2a2a4a',
        boxShadow:
          '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.3)',
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          opacity: 0.8,
        }}
      />

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: accentColor,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 8,
                color: '#555577',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {badge && (
          <div
            style={{
              fontSize: 7,
              padding: '1px 5px',
              borderRadius: 3,
              background: `${accentColor}22`,
              border: `1px solid ${accentColor}44`,
              color: accentColor,
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
            }}
          >
            {badge}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 p-3">{children}</div>

      {/* Bottom screws */}
      <div className="flex justify-between px-2 pb-1.5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: 7,
              height: 7,
              background: 'radial-gradient(circle at 35% 35%, #3a3a5c, #1a1a2e)',
              border: '1px solid #333355',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default React.memo(ModulePanelComponent);
