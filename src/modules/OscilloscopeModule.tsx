import { useEffect, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import JackPort from '../components/JackPort';
import ModulePanel from '../components/ModulePanel';

interface OscilloscopeModuleProps {
  id: string;
}

export default function OscilloscopeModule({ id }: OscilloscopeModuleProps) {
  const engine = getAudioEngine();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const inputGainRef = useRef<GainNode | null>(null);
  const [inputNode, setInputNode] = useState<GainNode | null>(null);

  const [mode, setMode] = useState<'time' | 'freq'>('time');
  const accentColor = '#a78bfa';

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

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;

      // Phosphor decay effect
      ctx2d.fillStyle = 'rgba(8, 8, 26, 0.3)';
      ctx2d.fillRect(0, 0, W, H);

      // Grid
      ctx2d.strokeStyle = '#1a1a30';
      ctx2d.lineWidth = 0.5;
      for (let i = 1; i < 4; i++) {
        ctx2d.beginPath();
        ctx2d.moveTo((i / 4) * W, 0);
        ctx2d.lineTo((i / 4) * W, H);
        ctx2d.stroke();
        ctx2d.beginPath();
        ctx2d.moveTo(0, (i / 4) * H);
        ctx2d.lineTo(W, (i / 4) * H);
        ctx2d.stroke();
      }
      // Center line
      ctx2d.strokeStyle = '#2a2a4a';
      ctx2d.lineWidth = 0.5;
      ctx2d.beginPath();
      ctx2d.moveTo(0, H / 2);
      ctx2d.lineTo(W, H / 2);
      ctx2d.stroke();

      if (mode === 'time') {
        const bufLen = analyser.frequencyBinCount;
        const data = new Uint8Array(bufLen);
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
      } else {
        const bufLen = analyser.frequencyBinCount;
        const data = new Uint8Array(bufLen);
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

  return (
    <ModulePanel title="SCOPE" subtitle="Oscilloscope" accentColor={accentColor} width={205} badge="VIZ">
      <div className="flex gap-1 mb-2">
        {(['time', 'freq'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
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
            {m === 'time' ? 'TIME DOM' : 'SPECTRUM'}
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

      <div className="rounded p-2" style={{ background: '#08081a', border: '1px solid #1a1a30' }}>
        <div className="text-center mb-1.5" style={{ fontSize: 7, color: '#444466', fontFamily: 'monospace' }}>INPUT</div>
        <div className="flex justify-center">
          <JackPort id={`${id}_in`} moduleId={id} type="input" label="IN" audioNode={inputNode ?? undefined} />
        </div>
      </div>
    </ModulePanel>
  );
}
