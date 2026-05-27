import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import ModulePanel from '../components/ModulePanel';
import { ModuleIOSection } from '../components/ModuleIOSection';

interface VCAModuleProps {
  id: string;
}

function VCAModuleComponent({ id }: VCAModuleProps) {
  const engine = getAudioEngine();
  const inputGainRef = useRef<GainNode | null>(null);
  const levelGainRef = useRef<GainNode | null>(null);
  const gateGainRef = useRef<GainNode | null>(null);
  const [nodes, setNodes] = useState<{ gain: GainNode; cv: GainNode } | null>(null);

  const [level, setLevel] = useState(0.5); // Start at 50% level
  const accentColor = '#f472b6';
  const [vu, setVu] = useState(0);

  useEffect(() => {
    const ctx = engine.ctx;
    // Three stage VCA: input → level → gate
    const inputGain = ctx.createGain();
    inputGain.gain.value = 1;
    
    const levelGain = ctx.createGain();
    levelGain.gain.value = 0.5;
    
    const gateGain = ctx.createGain();
    gateGain.gain.value = 0; // Start at 0, will be modulated by keyboard gate CV
    
    // Chain: input → level → gate → output
    inputGain.connect(levelGain);
    levelGain.connect(gateGain);
    
    inputGainRef.current = inputGain;
    levelGainRef.current = levelGain;
    gateGainRef.current = gateGain;
    // Expose gateGain as both the main gain (for output) and cv parameter target
    setNodes({ gain: gateGain, cv: gateGain });

    // VU analyser on gate output
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    gateGain.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame: number;
    let lastUpdate = 0;
    const updateInterval = 33; // ~30fps

    const tick = () => {
      const now = performance.now();
      if (now - lastUpdate > updateInterval) {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        setVu(Math.sqrt(sum / data.length));
        lastUpdate = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      analyser.disconnect();
      inputGain.disconnect();
      levelGain.disconnect();
      gateGain.disconnect();
    };
  }, []);

  useEffect(() => {
    if (levelGainRef.current) {
      const now = engine.ctx.currentTime;
      levelGainRef.current.gain.setTargetAtTime(level, now, 0.02);
    }
  }, [level, engine.ctx]);

  const vuBars = 12;
  const vuBarElements = Array.from({ length: vuBars }).map((_, i) => {
    const threshold = i / vuBars;
    const active = vu > threshold * 0.3;
    const isHot = i >= vuBars * 0.8;
    const isWarm = i >= vuBars * 0.6;
    return {
      height: `${((i + 1) / vuBars) * 100}%`,
      background: active ? (isHot ? '#ef4444' : isWarm ? '#f97316' : accentColor) : '#1a1a2e',
      border: `1px solid ${active ? 'transparent' : '#2a2a4a'}`,
    };
  });

  return (
    <ModulePanel title="VCA" subtitle="Voltage Ctrl Amp" accentColor={accentColor} width={150} badge="AMP">
      <div className="flex gap-0.5 mb-3 items-end" style={{ height: 48 }}>
        {vuBarElements.map((style, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: style.height,
              background: style.background,
              borderRadius: 1,
              transition: 'background 0.05s',
              border: style.border,
            }}
          />
        ))}
      </div>

      <div className="flex justify-center mb-3">
        <Knob value={level} min={0} max={1} onChange={setLevel} label="Level" unit="%" size="lg" color={accentColor} />
      </div>

      <ModuleIOSection
        ports={[
          { id: `${id}_in`, moduleId: id, type: 'input', label: 'IN', audioNode: inputGainRef.current! },
          { id: `${id}_cv_in`, moduleId: id, type: 'input', label: 'CV', audioParam: gateGainRef.current?.gain },
          { id: `${id}_out`, moduleId: id, type: 'output', label: 'OUT', audioNode: gateGainRef.current! },
        ]}
        title="I/O"
      />
    </ModulePanel>
  );
}

export default React.memo(VCAModuleComponent);
