import { useEffect, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import JackPort from '../components/JackPort';
import ModulePanel from '../components/ModulePanel';

type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';
const WAVEFORMS: WaveformType[] = ['sine', 'square', 'sawtooth', 'triangle'];
const WAVEFORM_ICONS: Record<WaveformType, string> = {
  sine: '∿', square: '⊓', sawtooth: '⋀', triangle: '△',
};

interface LFOModuleProps {
  id: string;
}

export default function LFOModule({ id }: LFOModuleProps) {
  const engine = getAudioEngine();
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const [outNode, setOutNode] = useState<GainNode | null>(null);

  const [rate, setRate] = useState(0.5);
  const [depth, setDepth] = useState(0.5);
  const [waveform, setWaveform] = useState<WaveformType>('sine');
  const accentColor = '#38bdf8';

  useEffect(() => {
    const ctx = engine.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 0.5;
    gain.gain.value = 0.5;
    osc.connect(gain);
    osc.start();
    oscRef.current = osc;
    gainRef.current = gain;
    setOutNode(gain);
    return () => {
      try { osc.stop(); } catch {}
      osc.disconnect();
      gain.disconnect();
    };
  }, []);

  useEffect(() => { if (oscRef.current) oscRef.current.frequency.value = rate; }, [rate]);
  useEffect(() => { if (gainRef.current) gainRef.current.gain.value = depth; }, [depth]);
  useEffect(() => { if (oscRef.current) oscRef.current.type = waveform; }, [waveform]);

  // Visual LFO display
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let animFrame: number;
    const tick = () => {
      setPhase((p) => (p + rate * 0.016) % (Math.PI * 2));
      animFrame = requestAnimationFrame(tick);
    };
    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, [rate]);

  const points = Array.from({ length: 40 }, (_, i) => {
    const x = (i / 39) * 150 + 4;
    let y: number;
    const t = (i / 39) * Math.PI * 4 + phase;
    if (waveform === 'sine') y = Math.sin(t);
    else if (waveform === 'square') y = Math.sign(Math.sin(t));
    else if (waveform === 'sawtooth') y = ((t % (Math.PI * 2)) / (Math.PI * 2)) * 2 - 1;
    else y = Math.abs(((t % (Math.PI * 2)) / (Math.PI * 2)) * 2 - 1) * 2 - 1;
    return `${x},${20 + y * 14 * depth}`;
  });

  return (
    <ModulePanel title="LFO" subtitle="Low Freq Oscillator" accentColor={accentColor} width={175} badge="MOD">
      <div className="flex gap-1 mb-2">
        {WAVEFORMS.map((w) => (
          <button
            key={w}
            onClick={() => setWaveform(w)}
            className="flex-1 flex items-center justify-center rounded text-sm transition-all"
            style={{
              height: 24,
              background: waveform === w ? `${accentColor}33` : '#0a0a18',
              border: `1px solid ${waveform === w ? accentColor : '#2a2a4a'}`,
              color: waveform === w ? accentColor : '#555577',
              fontFamily: 'monospace',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {WAVEFORM_ICONS[w]}
          </button>
        ))}
      </div>

      {/* Live waveform display */}
      <div className="rounded mb-2 overflow-hidden" style={{ height: 40, background: '#08081a', border: '1px solid #1a1a30' }}>
        <svg width={158} height={40}>
          <line x1={4} y1={20} x2={154} y2={20} stroke="#1a1a30" strokeWidth={0.5} />
          <polyline
            points={points.join(' ')}
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 3px ${accentColor})` }}
          />
        </svg>
      </div>

      <div className="flex gap-2 justify-around mb-3">
        <Knob value={rate} min={0.01} max={20} onChange={setRate} label="Rate" unit="Hz" size="md" color={accentColor} logarithmic />
        <Knob value={depth} min={0} max={1} onChange={setDepth} label="Depth" unit="%" size="md" color={accentColor} />
      </div>

      <div className="rounded p-2" style={{ background: '#08081a', border: '1px solid #1a1a30' }}>
        <div className="text-center mb-1.5" style={{ fontSize: 7, color: '#444466', fontFamily: 'monospace' }}>OUTPUTS</div>
        <div className="flex justify-around">
          <JackPort id={`${id}_out`} moduleId={id} type="output" label="OUT" audioNode={outNode ?? undefined} />
          <JackPort id={`${id}_trig`} moduleId={id} type="output" label="TRIG" audioNode={outNode ?? undefined} />
        </div>
      </div>
    </ModulePanel>
  );
}
