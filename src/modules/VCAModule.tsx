import { useEffect, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import JackPort from '../components/JackPort';
import ModulePanel from '../components/ModulePanel';

interface VCAModuleProps {
  id: string;
}

export default function VCAModule({ id }: VCAModuleProps) {
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
    gain.gain.value = 0.7;
    cvGain.gain.value = 1;
    cvGain.connect(gain.gain);
    gainRef.current = gain;
    cvGainRef.current = cvGain;
    setNodes({ gain, cv: cvGain });

    // VU analyser
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    gain.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame: number;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      setVu(Math.sqrt(sum / data.length));
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
  }, [level]);

  const vuBars = 12;

  return (
    <ModulePanel title="VCA" subtitle="Voltage Ctrl Amp" accentColor={accentColor} width={150} badge="AMP">
      <div className="flex gap-0.5 mb-3 items-end" style={{ height: 48 }}>
        {Array.from({ length: vuBars }).map((_, i) => {
          const threshold = i / vuBars;
          const active = vu > threshold * 0.3;
          const isHot = i >= vuBars * 0.8;
          const isWarm = i >= vuBars * 0.6;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${((i + 1) / vuBars) * 100}%`,
                background: active ? (isHot ? '#ef4444' : isWarm ? '#f97316' : accentColor) : '#1a1a2e',
                borderRadius: 1,
                transition: 'background 0.05s',
                border: `1px solid ${active ? 'transparent' : '#2a2a4a'}`,
              }}
            />
          );
        })}
      </div>

      <div className="flex justify-center mb-3">
        <Knob value={level} min={0} max={1} onChange={setLevel} label="Level" unit="%" size="lg" color={accentColor} />
      </div>

      <div className="rounded p-2" style={{ background: '#08081a', border: '1px solid #1a1a30' }}>
        <div className="text-center mb-1.5" style={{ fontSize: 7, color: '#444466', fontFamily: 'monospace' }}>I/O</div>
        <div className="flex justify-around">
          <JackPort id={`${id}_in`} moduleId={id} type="input" label="IN" audioNode={nodes?.gain} />
          <JackPort id={`${id}_cv_in`} moduleId={id} type="input" label="CV" audioNode={nodes?.cv} />
          <JackPort id={`${id}_out`} moduleId={id} type="output" label="OUT" audioNode={nodes?.gain} />
        </div>
      </div>
    </ModulePanel>
  );
}
