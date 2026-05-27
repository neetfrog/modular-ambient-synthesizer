import React, { useEffect, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import ModulePanel from '../components/ModulePanel';
import { ModuleButton } from '../components/ModuleButton';
import { ModuleIOSection } from '../components/ModuleIOSection';

type NoiseColor = 'white' | 'pink' | 'brown';

const COLOR_MAP: Record<NoiseColor, string> = {
  white: '#f8fafc',
  pink: '#f9a8d4',
  brown: '#a16207',
};

function createNoiseBuffer(ctx: AudioContext, color: NoiseColor) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    if (color === 'white') {
      data[i] = white;
    } else if (color === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    } else {
      const brown = (lastOut + 0.02 * white) / 1.02;
      data[i] = brown * 3.5;
      lastOut = brown;
    }
  }
  return buffer;
}

interface NoiseModuleProps {
  id: string;
}

function NoiseModuleComponent({ id }: NoiseModuleProps) {
  const engine = getAudioEngine();
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const [outNode, setOutNode] = useState<GainNode | null>(null);

  const [color, setColor] = useState<NoiseColor>('pink');
  const [level, setLevel] = useState(0.3);
  const accentColor = '#e2e8f0';

  const buildNoise = (noiseColor: NoiseColor, noiseLevel: number) => {
    const ctx = engine.ctx;
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {}
      sourceRef.current.disconnect();
    }
    const source = ctx.createBufferSource();
    source.buffer = createNoiseBuffer(ctx, noiseColor);
    source.loop = true;
    let gain = gainRef.current;
    if (!gain) {
      gain = ctx.createGain();
      gainRef.current = gain;
      setOutNode(gain);
    }
    gain.gain.value = noiseLevel;
    source.connect(gain);
    source.start();
    sourceRef.current = source;
  };

  useEffect(() => {
    buildNoise('pink', 0.3);
    return () => {
      try {
        sourceRef.current?.stop();
      } catch {}
      sourceRef.current?.disconnect();
      gainRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    buildNoise(color, level);
  }, [color, level]);

  return (
    <ModulePanel title="NOISE" subtitle="Generator" accentColor={accentColor} width={150} badge="SRC">
      <div className="flex gap-1 mb-3">
        {(['white', 'pink', 'brown'] as NoiseColor[]).map((c) => (
          <ModuleButton
            key={c}
            isActive={color === c}
            onClick={() => setColor(c)}
            label={c.toUpperCase()}
            accentColor={COLOR_MAP[c]}
            className="flex-1 text-xs py-1"
          />
        ))}
      </div>

      <div className="rounded mb-3 overflow-hidden" style={{ height: 28, background: '#08081a', border: '1px solid #1a1a30' }}>
        <svg width={130} height={28}>
          {Array.from({ length: 40 }).map((_, i) => {
            const x = (i / 39) * 126 + 2;
            const r = Math.random();
            const h = color === 'brown' ? r * r * 20 : color === 'pink' ? r * 18 : r * 16;
            return (
              <line
                key={i}
                x1={x}
                y1={14 - h / 2}
                x2={x}
                y2={14 + h / 2}
                stroke={COLOR_MAP[color]}
                strokeWidth={1.5}
                opacity={0.4 + r * 0.4}
              />
            );
          })}
        </svg>
      </div>

      <div className="flex justify-center mb-3">
        <Knob value={level} min={0} max={1} onChange={setLevel} label="Level" unit="%" size="md" color={accentColor} />
      </div>

      <ModuleIOSection
        ports={[{ id: `${id}_out`, moduleId: id, type: 'output', label: 'OUT', audioNode: outNode ?? undefined }]}
        title="OUTPUT"
      />
    </ModulePanel>
  );
}

export default React.memo(NoiseModuleComponent);
