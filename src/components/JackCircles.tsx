import React from 'react';
import { usePatchStore } from '../store/synthStore';

/**
 * Renders jack connection points as an overlay on top of cables and modules
 * This ensures jacks are always visible and clickable regardless of module stacking
 */
function JackCirclesComponent() {
  const jacks = usePatchStore((s) => s.jacks);
  const cables = usePatchStore((s) => s.cables);

  return (
    <svg
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9, width: '100vw', height: '100vh' }}
    >
      {/* Render all jacks as small circles with their connection colors */}
      {Object.values(jacks).map((jack) => {
        if (!jack.x || !jack.y) return null;

        // Find cables connected to this jack to get color
        const connectedCable = cables.find(
          (c) => c.fromJackId === jack.id || c.toJackId === jack.id
        );
        const color = connectedCable?.color || (jack.type === 'output' ? '#f97316' : '#38bdf8');

        return (
          <g key={jack.id}>
            {/* Glow effect for connected jacks */}
            {connectedCable && (
              <circle
                cx={jack.x}
                cy={jack.y}
                r={6}
                fill="none"
                stroke={color}
                strokeWidth={1}
                opacity={0.4}
              />
            )}
            {/* Main jack circle */}
            <circle
              cx={jack.x}
              cy={jack.y}
              r={4}
              fill={color}
              opacity={0.95}
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      })}
    </svg>
  );
}

const JackCircles = React.memo(JackCirclesComponent);
export default JackCircles;
