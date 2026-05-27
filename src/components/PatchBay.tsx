import React, { useEffect, useCallback } from 'react';
import { usePatchStore } from '../store/synthStore';

function PatchBayComponent() {
  const cables = usePatchStore((s) => s.cables);
  const jacks = usePatchStore((s) => s.jacks);
  const draggingFrom = usePatchStore((s) => s.draggingFrom);
  const mousePos = usePatchStore((s) => s.mousePos);
  const setMousePos = usePatchStore((s) => s.setMousePos);
  const cancelDrag = usePatchStore((s) => s.cancelDrag);
  const removeCable = usePatchStore((s) => s.removeCable);
  const lastMouseUpdateRef = React.useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Throttle to ~30fps (33ms)
      const now = performance.now();
      if (now - lastMouseUpdateRef.current < 33) return;
      lastMouseUpdateRef.current = now;
      setMousePos(e.clientX, e.clientY);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const currentDraggingFrom = usePatchStore.getState().draggingFrom;
        if (currentDraggingFrom) {
          e.preventDefault();
        }
        // Throttle to ~30fps for touch
        const now = performance.now();
        if (now - lastMouseUpdateRef.current < 33) return;
        lastMouseUpdateRef.current = now;
        setMousePos(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDrag();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setMousePos, cancelDrag]);

  const getCablePath = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const sag = Math.min(120, dist * 0.4);
    const cp1x = x1 + dx * 0.25;
    const cp1y = y1 + sag;
    const cp2x = x2 - dx * 0.25;
    const cp2y = y2 + sag;
    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  }, []);

  return (
    <svg
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1000, width: '100vw', height: '100vh' }}
    >
      <defs>
        {cables.map((cable) => (
          <filter key={`glow-${cable.id}`} id={`glow-${cable.id}`}>
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
        {draggingFrom && (
          <filter id="glow-drag">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* Existing cables */}
      {cables.map((cable) => {
        const fromJack = jacks[cable.fromJackId];
        const toJack = jacks[cable.toJackId];
        if (!fromJack?.x || !fromJack?.y || !toJack?.x || !toJack?.y) return null;

        const path = getCablePath(fromJack.x, fromJack.y, toJack.x, toJack.y);

        return (
          <g key={cable.id}>
            {/* Shadow */}
            <path
              d={path}
              fill="none"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth={5}
              strokeLinecap="round"
            />
            {/* Cable */}
            <path
              d={path}
              fill="none"
              stroke={cable.color}
              strokeWidth={3.5}
              strokeLinecap="round"
              filter={`url(#glow-${cable.id})`}
              style={{ pointerEvents: 'none' }}
            />
            {/* Clickable wider path for removal */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              strokeLinecap="round"
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                removeCable(cable.id);
              }}
            />
            {/* Connector caps */}
            <circle cx={fromJack.x} cy={fromJack.y} r={4} fill={cable.color} opacity={0.9} />
            <circle cx={toJack.x} cy={toJack.y} r={4} fill={cable.color} opacity={0.9} />
          </g>
        );
      })}

      {/* Dragging cable - calculate path once, reuse for both strokes */}
      {draggingFrom && jacks[draggingFrom]?.x && (() => {
        const dragPath = getCablePath(
          jacks[draggingFrom].x!,
          jacks[draggingFrom].y!,
          mousePos.x,
          mousePos.y
        );
        return (
          <g>
            <path
              d={dragPath}
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={5}
              strokeLinecap="round"
            />
            <path
              d={dragPath}
              fill="none"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="6 4"
              filter="url(#glow-drag)"
            />
            <circle cx={mousePos.x} cy={mousePos.y} r={5} fill="white" opacity={0.6} />
          </g>
        );
      })()}
    </svg>
  );
}
const PatchBay = React.memo(PatchBayComponent);
export default PatchBay;