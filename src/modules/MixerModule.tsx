import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import ModulePanel from '../components/ModulePanel';
import { ModuleIOSection } from '../components/ModuleIOSection';

const CHANNEL_COLORS = ['#f97316', '#38bdf8', '#4ade80', '#f472b6'];

interface MixerModuleProps {
  id: string;
}

function MixerModuleComponent({ id }: MixerModuleProps) {
  const engine = getAudioEngine();
  const [nodes, setNodes] = useState<{ inputs: GainNode[]; output: GainNode } | null>(null);
  const inputGainsRef = useRef<GainNode[]>([]);
  const outputGainRef = useRef<GainNode | null>(null);

  const [levels, setLevels] = useState([0.7, 0.7, 0.7, 0.7]);
  const [masterLevel, setMasterLevel] = useState(0.8);
  const accentColor = '#60a5fa';

  useEffect(() => {
    const ctx = engine.ctx;
    const output = ctx.createGain();
    output.gain.value = 0.8;
    const inputs = Array.from({ length: 4 }, () => {
      const g = ctx.createGain();
      g.gain.value = 0.7;
      g.connect(output);
      return g;
    });
    inputGainsRef.current = inputs;
    outputGainRef.current = output;
    setNodes({ inputs, output });
    return () => {
      inputs.forEach((g) => g.disconnect());
      output.disconnect();
    };
  }, []);

  useEffect(() => {
    inputGainsRef.current.forEach((g, i) => {
      g.gain.setTargetAtTime(levels[i], engine.ctx.currentTime, 0.02);
    });
  }, [levels, engine.ctx]);

  useEffect(() => {
    if (outputGainRef.current)
      outputGainRef.current.gain.setTargetAtTime(masterLevel, engine.ctx.currentTime, 0.02);
  }, [masterLevel, engine.ctx]);

  const setLevel = useCallback((i: number, v: number) => {
    setLevels((prev) => prev.map((l, idx) => (idx === i ? v : l)));
  }, []);

  const ports = nodes?.inputs.map((node, i) => ({
    id: `${id}_ch${i + 1}_in`,
    moduleId: id,
    type: 'input' as const,
    label: `CH${i + 1}`,
    audioNode: node,
  })) || [];

  ports.push({
    id: `${id}_out`,
    moduleId: id,
    type: 'output' as const,
    label: 'OUT',
    audioNode: nodes?.output,
  });

  return (
    <ModulePanel title="MIXER" subtitle="4-Channel" accentColor={accentColor} width={205} badge="MIX">
      <div className="flex gap-2 mb-3">
        {levels.map((level, i) => (
          <div key={i} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
            <div className="relative flex justify-center" style={{ height: 60 }}>
              <div
                className="absolute rounded-full"
                style={{
                  width: 3,
                  height: '100%',
                  background: '#0a0a18',
                  border: '1px solid #2a2a4a',
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  width: 3,
                  height: `${level * 100}%`,
                  background: `linear-gradient(to top, ${CHANNEL_COLORS[i]}, ${CHANNEL_COLORS[i]}88)`,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bottom: 0,
                  boxShadow: `0 0 6px ${CHANNEL_COLORS[i]}66`,
                }}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={level}
                onChange={(e) => setLevel(i, parseFloat(e.target.value))}
                className="absolute h-full cursor-pointer"
                style={{
                  WebkitAppearance: 'slider-vertical',
                  writingMode: 'vertical-lr',
                  direction: 'rtl',
                  width: 20,
                  opacity: 0,
                  zIndex: 10,
                } as React.CSSProperties}
              />
            </div>
            <div style={{ fontSize: 7, color: CHANNEL_COLORS[i], fontFamily: 'monospace' }}>CH{i + 1}</div>
            <div style={{ fontSize: 7, color: '#555577', fontFamily: 'monospace' }}>{Math.round(level * 100)}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontSize: 8, color: '#666688', fontFamily: 'monospace', flex: 1 }}>MASTER</span>
        <Knob value={masterLevel} min={0} max={1} onChange={setMasterLevel} label="" unit="%" size="sm" color={accentColor} />
      </div>

      <ModuleIOSection ports={ports} title="INPUTS / OUTPUT" />
    </ModulePanel>
  );
}

export default React.memo(MixerModuleComponent);
