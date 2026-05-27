import { useEffect, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import JackPort from '../components/JackPort';
import ModulePanel from '../components/ModulePanel';

function createImpulseResponse(ctx: AudioContext, duration: number, decay: number) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

interface ReverbModuleProps {
  id: string;
}

export default function ReverbModule({ id }: ReverbModuleProps) {
  const engine = getAudioEngine();
  const reverbRef = useRef<ConvolverNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const inputGainRef = useRef<GainNode | null>(null);
  const [nodes, setNodes] = useState<{ input: GainNode; dry: GainNode; wet: GainNode } | null>(null);

  const [roomSize, setRoomSize] = useState(2.5);
  const [decay, setDecay] = useState(3);
  const [mix, setMix] = useState(0.5);
  const accentColor = '#34d399';

  useEffect(() => {
    const ctx = engine.ctx;
    const input = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const reverb = ctx.createConvolver();

    input.gain.value = 1;
    dry.gain.value = 0.5;
    wet.gain.value = 0.5;
    reverb.buffer = createImpulseResponse(ctx, 2.5, 3);

    input.connect(dry);
    input.connect(reverb);
    reverb.connect(wet);

    inputGainRef.current = input;
    dryGainRef.current = dry;
    wetGainRef.current = wet;
    reverbRef.current = reverb;
    setNodes({ input, dry, wet });

    return () => {
      input.disconnect();
      dry.disconnect();
      wet.disconnect();
      reverb.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!reverbRef.current || !inputGainRef.current || !dryGainRef.current || !wetGainRef.current) return;
    const ctx = engine.ctx;
    const reverb = ctx.createConvolver();
    reverb.buffer = createImpulseResponse(ctx, roomSize, decay);
    try { reverbRef.current.disconnect(); } catch {}
    inputGainRef.current.connect(reverb);
    reverb.connect(wetGainRef.current);
    reverbRef.current = reverb;
  }, [roomSize, decay]);

  useEffect(() => {
    if (dryGainRef.current) dryGainRef.current.gain.value = 1 - mix;
    if (wetGainRef.current) wetGainRef.current.gain.value = mix;
  }, [mix]);

  return (
    <ModulePanel title="REVERB" subtitle="Convolution" accentColor={accentColor} width={175} badge="FX">
      <div className="flex gap-2 justify-around mb-3">
        <Knob value={roomSize} min={0.1} max={10} onChange={setRoomSize} label="Room" unit="s" size="md" color={accentColor} logarithmic />
        <Knob value={decay} min={0.1} max={10} onChange={setDecay} label="Decay" size="md" color={accentColor} />
        <Knob value={mix} min={0} max={1} onChange={setMix} label="Mix" unit="%" size="md" color={accentColor} />
      </div>

      <div className="rounded mb-3 flex items-center justify-center overflow-hidden" style={{ height: 36, background: '#08081a', border: '1px solid #1a1a30' }}>
        <svg width={150} height={28}>
          {Array.from({ length: 20 }).map((_, i) => {
            const x = (i / 19) * 140 + 5;
            const amplitude = Math.exp(-i * decay / 20) * mix;
            const h = Math.max(1, amplitude * 22);
            return (
              <rect key={i} x={x - 3} y={14 - h} width={6} height={h * 2} rx={1}
                fill={accentColor} opacity={0.1 + amplitude * 0.8} />
            );
          })}
        </svg>
      </div>

      <div className="rounded p-2" style={{ background: '#08081a', border: '1px solid #1a1a30' }}>
        <div className="text-center mb-1.5" style={{ fontSize: 7, color: '#444466', fontFamily: 'monospace' }}>I/O</div>
        <div className="flex justify-around">
          <JackPort id={`${id}_in`} moduleId={id} type="input" label="IN" audioNode={nodes?.input} />
          <JackPort id={`${id}_dry_out`} moduleId={id} type="output" label="DRY" audioNode={nodes?.dry} />
          <JackPort id={`${id}_wet_out`} moduleId={id} type="output" label="WET" audioNode={nodes?.wet} />
        </div>
      </div>
    </ModulePanel>
  );
}
