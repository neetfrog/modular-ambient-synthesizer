import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import ModulePanel from '../components/ModulePanel';
import { ModuleIOSection } from '../components/ModuleIOSection';

interface OscilloscopeModuleProps {
  id: string;
}

// Pre-calculate grid pattern
function createGridCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Grid
  ctx.strokeStyle = '#1a1a30';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo((i / 4) * width, 0);
    ctx.lineTo((i / 4) * width, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, (i / 4) * height);
    ctx.lineTo(width, (i / 4) * height);
    ctx.stroke();
  }
  // Center line
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  return canvas;
}

function OscilloscopeModuleComponent({ id }: OscilloscopeModuleProps) {
  const engine = getAudioEngine();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const inputGainRef = useRef<GainNode | null>(null);
  // Reuse typed arrays instead of allocating new ones each frame
  const timeDataRef = useRef<Uint8Array | null>(null);
  const freqDataRef = useRef<Uint8Array | null>(null);
  const [inputNode, setInputNode] = useState<GainNode | null>(null);

  const [mode, setMode] = useState<'time' | 'freq' | 'marantz'>('time');
  const accentColor = '#a78bfa';
  // Marantz VU meter state
  const vuValueLeftRef = useRef(0);
  const vuValueRightRef = useRef(0);
  const vuDecayRef = useRef(0.92);

  useEffect(() => {
    const ctx = engine.ctx;
    const analyser = ctx.createAnalyser();
    const input = ctx.createGain();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.85;
    input.connect(analyser);
    analyserRef.current = analyser;
    inputGainRef.current = input;
    setInputNode(input);
    return () => {
      analyser.disconnect();
      input.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    // Create grid canvas once
    if (!gridCanvasRef.current) {
      gridCanvasRef.current = createGridCanvas(canvas.width, canvas.height);
    }

    let lastUpdate = 0;
    const updateInterval = 33; // ~30fps

    const draw = () => {
      const now = performance.now();
      if (now - lastUpdate < updateInterval) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      lastUpdate = now;

      const W = canvas.width;
      const H = canvas.height;

      // Phosphor decay effect
      ctx2d.fillStyle = 'rgba(8, 8, 26, 0.3)';
      ctx2d.fillRect(0, 0, W, H);

      // Draw pre-cached grid
      if (gridCanvasRef.current) {
        ctx2d.drawImage(gridCanvasRef.current, 0, 0);
      }

      if (mode === 'marantz') {
        // Vintage Marantz VU meter style
        const bufLen = analyser.frequencyBinCount;
        if (!freqDataRef.current || freqDataRef.current.length !== bufLen) {
          freqDataRef.current = new Uint8Array(bufLen);
        }
        const data = freqDataRef.current;
        analyser.getByteFrequencyData(data);

        // Get low and high frequency bands for stereo effect
        const lowBand = data.slice(0, bufLen / 3).reduce((a, b) => a + b, 0) / (bufLen / 3);
        const highBand = data.slice((bufLen * 2) / 3).reduce((a, b) => a + b, 0) / (bufLen / 3);

        // Smooth VU updates with decay
        vuValueLeftRef.current = Math.max(lowBand / 255, vuValueLeftRef.current * vuDecayRef.current);
        vuValueRightRef.current = Math.max(highBand / 255, vuValueRightRef.current * vuDecayRef.current);

        const padding = 8;
        const meterY = H / 2;
        const meterWidth = (W - padding * 3) / 2;

        // Draw warm amber background (warm vintage tone)
        ctx2d.fillStyle = '#1a0f05';
        ctx2d.fillRect(0, 0, W, H);

        // Draw each VU meter
        const drawVUMeter = (x: number, value: number, label: string) => {
          // Meter background
          ctx2d.fillStyle = '#0a0603';
          ctx2d.fillRect(x, padding, meterWidth, H - padding * 2);
          ctx2d.strokeStyle = '#8b6914';
          ctx2d.lineWidth = 1;
          ctx2d.strokeRect(x, padding, meterWidth, H - padding * 2);

          // dB scale marks
          ctx2d.strokeStyle = '#5d4a0a';
          ctx2d.lineWidth = 0.5;
          for (let i = 0; i <= 10; i++) {
            const markX = x + (i / 10) * meterWidth;
            const markH = i % 2 === 0 ? 4 : 2;
            ctx2d.beginPath();
            ctx2d.moveTo(markX, H - padding - markH);
            ctx2d.lineTo(markX, H - padding);
            ctx2d.stroke();
          }

          // Needle
          const needleX = x + value * meterWidth;
          const needleH = H - padding * 2;
          const needleGradient = ctx2d.createLinearGradient(needleX - 1, padding, needleX + 1, padding);
          needleGradient.addColorStop(0, '#d4a574');
          needleGradient.addColorStop(0.5, '#f0c868');
          needleGradient.addColorStop(1, '#c4924a');
          ctx2d.fillStyle = needleGradient;
          ctx2d.fillRect(needleX - 1, padding, 2, needleH);

          // Needle glow
          ctx2d.shadowBlur = 6;
          ctx2d.shadowColor = '#f0c868';
          ctx2d.fillStyle = '#ffd700';
          ctx2d.fillRect(needleX - 0.5, padding + 2, 1, needleH - 4);
          ctx2d.shadowBlur = 0;

          // Label
          ctx2d.fillStyle = '#8b6914';
          ctx2d.font = 'bold 8px monospace';
          ctx2d.textAlign = 'center';
          ctx2d.fillText(label, x + meterWidth / 2, H - 1);
        };

        drawVUMeter(padding, vuValueLeftRef.current, 'LOW');
        drawVUMeter(W / 2 + padding, vuValueRightRef.current, 'HIGH');
      } else if (mode === 'time') {
        const bufLen = analyser.frequencyBinCount;
        if (!timeDataRef.current || timeDataRef.current.length !== bufLen) {
          timeDataRef.current = new Uint8Array(bufLen);
        }
        const data = timeDataRef.current;
        analyser.getByteTimeDomainData(data);

        ctx2d.beginPath();
        ctx2d.strokeStyle = accentColor;
        ctx2d.lineWidth = 1.5;
        ctx2d.shadowBlur = 8;
        ctx2d.shadowColor = accentColor;
        for (let i = 0; i < bufLen; i++) {
          const x = (i / bufLen) * W;
          const y = ((data[i] - 128) / 128) * (H / 2 - 6) + H / 2;
          i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
        }
        ctx2d.stroke();
        ctx2d.shadowBlur = 0;
      } else if (mode === 'freq') {
        const bufLen = analyser.frequencyBinCount;
        if (!freqDataRef.current || freqDataRef.current.length !== bufLen) {
          freqDataRef.current = new Uint8Array(bufLen);
        }
        const data = freqDataRef.current;
        analyser.getByteFrequencyData(data);
        const bars = 48;
        const step = Math.floor(bufLen / bars);
        for (let i = 0; i < bars; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += data[i * step + j];
          const avg = sum / step;
          const barH = (avg / 255) * H;
          const x = (i / bars) * W;
          const w = W / bars - 1;
          const gradient = ctx2d.createLinearGradient(0, H, 0, H - barH);
          gradient.addColorStop(0, `${accentColor}44`);
          gradient.addColorStop(0.7, `${accentColor}99`);
          gradient.addColorStop(1, accentColor);
          ctx2d.fillStyle = gradient;
          ctx2d.fillRect(x, H - barH, w, barH);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    // Clear first
    ctx2d.fillStyle = '#08081a';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [mode]);

  const handleModeChange = useCallback((m: 'time' | 'freq' | 'marantz') => {
    setMode(m);
  }, []);

  return (
    <ModulePanel title="SCOPE" subtitle="Oscilloscope" accentColor={accentColor} width={205} badge="VIZ">
      <div className="flex gap-1 mb-2">
        {(['time', 'freq', 'marantz'] as const).map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            className="flex-1 rounded py-1 text-xs transition-all"
            style={{
              fontFamily: 'monospace',
              background: mode === m ? `${accentColor}33` : '#0a0a18',
              border: `1px solid ${mode === m ? accentColor : '#2a2a4a'}`,
              color: mode === m ? accentColor : '#555577',
              fontSize: 9,
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
          >
            {m === 'time' ? 'TIME DOM' : m === 'freq' ? 'SPECTRUM' : 'MARANTZ'}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', display: 'inline-block', borderRadius: 4, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={183}
          height={88}
          style={{
            display: 'block',
            border: '1px solid #1a1a30',
            borderRadius: 4,
            marginBottom: 8,
          }}
        />
        {/* Scanline overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
            pointerEvents: 'none',
            borderRadius: 4,
          }}
        />
      </div>

      <ModuleIOSection
        ports={[{ id: `${id}_in`, moduleId: id, type: 'input', label: 'IN', audioNode: inputNode ?? undefined }]}
        title="INPUT"
      />
    </ModulePanel>
  );
}

export default React.memo(OscilloscopeModuleComponent);
