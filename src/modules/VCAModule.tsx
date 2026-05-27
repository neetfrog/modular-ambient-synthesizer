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
  const gainRef = useRef<GainNode | null>(null);
  const cvGainRef = useRef<GainNode | null>(null);
  const [nodes, setNodes] = useState<{ gain: GainNode; cv: GainNode } | null>(null);

  const [level, setLevel] = useState(0.7);
  const accentColor = '#f472b6';
  const [vu, setVu] = useState(0);

  useEffect(() => {
    const ctx = engine.ctx;
    const gain = ctx.createGain();
    const cvGain = ctx.createGain();
    gain.gain.value = 0.5; // Reduce max output gain for headroom
    cvGain.gain.value = 1;
    cvGain.connect(gain.gain);
    gainRef.current = gain;
    cvGainRef.current = cvGain;
    setNodes({ gain, cv: cvGain });

    // VU analyser - throttled to 60fps max
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    gain.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame: number;
    let lastUpdate = 0;
    const updateInterval = 16; // ~60fps

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
      gain.disconnect();
      cvGain.disconnect();
    };
  }, []);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.setTargetAtTime(level, engine.ctx.currentTime, 0.02);
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
          { id: `${id}_in`, moduleId: id, type: 'input', label: 'IN', audioNode: nodes?.gain },
          { id: `${id}_cv_in`, moduleId: id, type: 'input', label: 'CV', audioNode: nodes?.cv },
          { id: `${id}_out`, moduleId: id, type: 'output', label: 'OUT', audioNode: nodes?.gain },
        ]}
        title="I/O"
      />
    </ModulePanel>
  );
}

export default React.memo(VCAModuleComponent);
