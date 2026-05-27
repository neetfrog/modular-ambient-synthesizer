import { useEffect, useRef, useState, useCallback } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import JackPort from '../components/JackPort';
import ModulePanel from '../components/ModulePanel';

interface ADSRModuleProps {
  id: string;
}

export default function ADSRModule({ id }: ADSRModuleProps) {
  const engine = getAudioEngine();
  const envGainRef = useRef<GainNode | null>(null);
  const [envNode, setEnvNode] = useState<GainNode | null>(null);

  const [attack, setAttack] = useState(0.5);
  const [decay, setDecay] = useState(0.3);
  const [sustain, setSustain] = useState(0.6);
  const [release, setRelease] = useState(1.2);
  const [isGate, setIsGate] = useState(false);
  const accentColor = '#a78bfa';

  useEffect(() => {
    const ctx = engine.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    envGainRef.current = gain;
    setEnvNode(gain);
    return () => gain.disconnect();
  }, []);

  const triggerEnvelope = useCallback(() => {
    if (!envGainRef.current) return;
    engine.resume();
    const ctx = engine.ctx;
    const gain = envGainRef.current.gain;
    const now = ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0, now);
    gain.linearRampToValueAtTime(1, now + attack);
    gain.linearRampToValueAtTime(sustain, now + attack + decay);
  }, [attack, decay, sustain]);

  const releaseEnvelope = useCallback(() => {
    if (!envGainRef.current) return;
    const ctx = engine.ctx;
    const gain = envGainRef.current.gain;
    const now = ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + release);
  }, [release]);

  const w = 136, h = 48;
  const pad = 4;
  const totalT = attack + decay + 0.5 + release;
  const scale = (t: number) => (t / totalT) * (w - pad * 2) + pad;
  const attackX = scale(attack);
  const decayX = scale(attack + decay);
  const sustainX = scale(attack + decay + 0.5);
  const sustainY = pad + (1 - sustain) * (h - pad * 2);
  const path = `M ${pad} ${h - pad} L ${attackX} ${pad} L ${decayX} ${sustainY} L ${sustainX} ${sustainY} L ${w - pad} ${h - pad}`;

  return (
    <ModulePanel title="ADSR" subtitle="Envelope Generator" accentColor={accentColor} width={160} badge="ENV">
      <div className="rounded mb-2 overflow-hidden" style={{ background: '#08081a', border: '1px solid #1a1a30' }}>
        <svg width={w} height={h}>
          <defs>
            <linearGradient id={`adsr-fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.4" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path d={`${path} Z`} fill={`url(#adsr-fill-${id})`} />
          <path d={path} fill="none" stroke={accentColor} strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-1 mb-2">
        <Knob value={attack} min={0.001} max={4} onChange={setAttack} label="Attack" unit="s" size="sm" color={accentColor} logarithmic />
        <Knob value={decay} min={0.001} max={4} onChange={setDecay} label="Decay" unit="s" size="sm" color={accentColor} logarithmic />
        <Knob value={sustain} min={0} max={1} onChange={setSustain} label="Sustain" unit="%" size="sm" color={accentColor} />
        <Knob value={release} min={0.001} max={8} onChange={setRelease} label="Release" unit="s" size="sm" color={accentColor} logarithmic />
      </div>

      <button
        className="w-full rounded py-1.5 mb-2 text-xs font-bold transition-all"
        style={{
          fontFamily: 'monospace',
          background: isGate ? `${accentColor}33` : '#0a0a18',
          border: `2px solid ${isGate ? accentColor : '#2a2a4a'}`,
          color: isGate ? accentColor : '#666688',
          boxShadow: isGate ? `0 0 12px ${accentColor}55` : 'none',
          letterSpacing: '0.1em',
          cursor: 'pointer',
        }}
        onMouseDown={() => { setIsGate(true); triggerEnvelope(); }}
        onMouseUp={() => { setIsGate(false); releaseEnvelope(); }}
        onMouseLeave={() => { if (isGate) { setIsGate(false); releaseEnvelope(); } }}
      >
        ▶ GATE
      </button>

      <div className="rounded p-2" style={{ background: '#08081a', border: '1px solid #1a1a30' }}>
        <div className="text-center mb-1.5" style={{ fontSize: 7, color: '#444466', fontFamily: 'monospace' }}>OUTPUTS</div>
        <div className="flex justify-around">
          <JackPort id={`${id}_env_out`} moduleId={id} type="output" label="ENV" audioNode={envNode ?? undefined} />
          <JackPort id={`${id}_gate_in`} moduleId={id} type="input" label="GATE" />
        </div>
      </div>
    </ModulePanel>
  );
}
