import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  label: string;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  logarithmic?: boolean;
}

// Extract helper functions outside to avoid recreation
const LERP = (a: number, b: number, t: number) => a + (b - a) * t;

const NORMALIZE = (value: number, min: number, max: number, log = false): number => {
  if (log) {
    const logMin = Math.log(Math.max(min, 0.0001));
    const logMax = Math.log(Math.max(max, 0.0001));
    const logVal = Math.log(Math.max(value, 0.0001));
    return (logVal - logMin) / (logMax - logMin);
  }
  return (value - min) / (max - min);
};

const DENORMALIZE = (t: number, min: number, max: number, log = false): number => {
  if (log) {
    const logMin = Math.log(Math.max(min, 0.0001));
    const logMax = Math.log(Math.max(max, 0.0001));
    return Math.exp(LERP(logMin, logMax, t));
  }
  return LERP(min, max, t);
};

const FORMAT_VALUE = (value: number, unit?: string): string => {
  if (unit === 'Hz') {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}kHz`;
    return `${value < 10 ? value.toFixed(2) : value.toFixed(0)}Hz`;
  }
  if (unit === 's') return `${value.toFixed(2)}s`;
  if (unit === '%') return `${Math.round(value * 100)}%`;
  if (value < 10) return value.toFixed(2);
  return value.toFixed(0);
};

const SIZE_MAP = {
  sm: { outer: 36, inner: 24, stroke: 3, fontSize: 9 },
  md: { outer: 52, inner: 36, stroke: 4, fontSize: 10 },
  lg: { outer: 68, inner: 48, stroke: 5, fontSize: 11 },
} as const;

function KnobComponent({
  value,
  min,
  max,
  onChange,
  label,
  unit,
  size = 'md',
  color = '#a78bfa',
  logarithmic = false,
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const dragStart = useRef<{ y: number; value: number } | null>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  const { outer, stroke } = SIZE_MAP[size];

  // Memoize expensive calculations
  const normalizedValue = useMemo(
    () => NORMALIZE(value, min, max, logarithmic),
    [value, min, max, logarithmic]
  );

  const angles = useMemo(() => {
    const minAngle = -140;
    const maxAngle = 140;
    const angle = LERP(minAngle, maxAngle, normalizedValue);
    const radius = outer / 2 - stroke;
    const cx = outer / 2;
    const cy = outer / 2;
    const startAngle = (minAngle - 90) * (Math.PI / 180);
    const endAngle = (angle - 90) * (Math.PI / 180);
    return {
      angle,
      radius,
      cx,
      cy,
      startAngle,
      endAngle,
      arcStartX: cx + radius * Math.cos(startAngle),
      arcStartY: cy + radius * Math.sin(startAngle),
      arcEndX: cx + radius * Math.cos(endAngle),
      arcEndY: cy + radius * Math.sin(endAngle),
      largeArc: angle - minAngle > 180 ? 1 : 0,
    };
  }, [normalizedValue, outer, stroke]);

  const indicatorPos = useMemo(() => {
    const indRad = (angles.angle - 90) * (Math.PI / 180);
    const innerR = (outer / 2) * 0.55;
    return {
      x: angles.cx + innerR * Math.cos(indRad),
      y: angles.cy + innerR * Math.sin(indRad),
    };
  }, [angles.angle, outer, angles.cx, angles.cy]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setShowTooltip(true);
      dragStart.current = { y: e.clientY, value };
    },
    [value]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onChange(DENORMALIZE(0.5, min, max, logarithmic));
    },
    [min, max, onChange, logarithmic]
  );

  // Consolidated event listener setup
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      const dy = dragStart.current.y - e.clientY;
      const sensitivity = e.shiftKey ? 0.003 : 0.008;
      const delta = dy * sensitivity;
      const startNorm = NORMALIZE(dragStart.current.value, min, max, logarithmic);
      const newNorm = Math.max(0, Math.min(1, startNorm + delta));
      onChange(DENORMALIZE(newNorm, min, max, logarithmic));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setShowTooltip(false);
      dragStart.current = null;
    };

    // Use passive listeners for better performance
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, min, max, onChange, logarithmic]);

  return (
    <div className="flex flex-col items-center gap-1 select-none" ref={knobRef}>
      <div className="relative">
        {showTooltip && (
          <div
            className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-50 border border-white/10"
            style={{ fontFamily: 'monospace' }}
          >
            {FORMAT_VALUE(value, unit)}
          </div>
        )}
        <svg
          width={outer}
          height={outer}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => !isDragging && setShowTooltip(false)}
          className={`cursor-ns-resize ${isDragging ? 'drop-shadow-lg' : ''}`}
          style={{ filter: isDragging ? `drop-shadow(0 0 6px ${color})` : undefined }}
        >
          {/* Track */}
          <circle
            cx={angles.cx}
            cy={angles.cy}
            r={angles.radius}
            fill="none"
            stroke="#1a1a2e"
            strokeWidth={stroke}
          />
          {/* Active arc */}
          {normalizedValue > 0 && (
            <path
              d={`M ${angles.arcStartX} ${angles.arcStartY} A ${angles.radius} ${angles.radius} 0 ${angles.largeArc} 1 ${angles.arcEndX} ${angles.arcEndY}`}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
            />
          )}
          {/* Knob body */}
          <circle
            cx={angles.cx}
            cy={angles.cy}
            r={(outer / 2) * 0.62}
            fill="url(#knobGrad)"
            stroke="#333355"
            strokeWidth={1}
          />
          {/* Indicator dot */}
          <circle cx={indicatorPos.x} cy={indicatorPos.y} r={stroke * 0.7} fill={color} />
          {/* Center dot */}
          <circle cx={angles.cx} cy={angles.cy} r={2} fill="#444466" />
          <defs>
            <radialGradient id="knobGrad" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#3a3a5c" />
              <stop offset="100%" stopColor="#1a1a2e" />
            </radialGradient>
          </defs>
        </svg>
      </div>
      <span
        className="text-center leading-tight"
        style={{
          fontSize: 9,
          color: '#8888aa',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          maxWidth: outer,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default React.memo(KnobComponent);
