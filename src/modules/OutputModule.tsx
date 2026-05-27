import { useEffect, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import JackPort from '../components/JackPort';
import ModulePanel from '../components/ModulePanel';

interface OutputModuleProps {
  id: string;
}

export default function OutputModule({ id }: OutputModuleProps) {
  const engine = getAudioEngine();
  const inputGainRef = useRef<GainNode | null>(null);
  const [inputNode, setInputNode] = useState<GainNode | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [vuLevel, setVuLevel] = useState(0);
  const [vuLevelR, setVuLevelR] = useState(0);
  const accentColor = '#f43f5e';
  const [isOn, setIsOn] = useState(true);

  useEffect(() => {
    const ctx = engine.ctx;
    const input = ctx.createGain();
    input.gain.value = 0.7;
    input.connect(engine.masterGain);
    inputGainRef.current = input;
    setInputNode(input);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    input.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame: number;
    let toggle = false;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      toggle = !toggle;
      if (toggle) setVuLevel(rms);
      else setVuLevelR(rms * (0.9 + Math.random() * 0.1));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      analyser.disconnect();
      input.disconnect();
    };
  }, []);

  useEffect(() => {
    if (inputGainRef.current)
      inputGainRef.current.gain.setTargetAtTime(isOn ? volume : 0, engine.ctx.currentTime, 0.05);
  }, [volume, isOn]);

  const toggleOutput = () => {
    engine.resume();
    setIsOn((v) => !v);
  };

  const vuBars = 16;

  return (
    <ModulePanel title="OUTPUT" subtitle="Master Out" accentColor={accentColor} width={175} badge="OUT">
      <div className="flex justify-center mb-3">
        <button
          onClick={toggleOutput}
          className="rounded-full flex items-center justify-center transition-all"
          style={{
            width: 54,
            height: 54,
            background: isOn
              ? `radial-gradient(circle at 40% 35%, ${accentColor}66, ${accentColor}22)`
              : 'radial-gradient(circle at 40% 35%, #2a2a4a, #1a1a2e)',
            border: `2px solid ${isOn ? accentColor : '#333355'}`,
            boxShadow: isOn ? `0 0 20px ${accentColor}55, 0 0 40px ${accentColor}22` : 'none',
            cursor: 'pointer',
            fontSize: 24,
            color: isOn ? accentColor : '#333355',
            transition: 'all 0.2s',
          }}
        >
          ⏻
        </button>
      </div>

      <div className="mb-3">
        <div className="text-center mb-1" style={{ fontSize: 7, color: '#444466', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
          STEREO VU
        </div>
        {([['L', vuLevel], ['R', vuLevelR]] as const).map(([ch, level]) => (
          <div key={ch} className="flex items-center gap-1.5 mb-0.5">
            <span style={{ fontSize: 7, color: '#555577', fontFamily: 'monospace', width: 8 }}>{ch}</span>
            <div className="flex gap-0.5 flex-1">
              {Array.from({ length: vuBars }).map((_, i) => {
                const thresh = i / vuBars;
                const active = level > thresh * 0.45;
                const hot = i >= vuBars * 0.875;
                const warm = i >= vuBars * 0.7;
                return (
                  <div key={i} style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 1,
                    background: active
                      ? hot ? '#ef4444' : warm ? '#f97316' : accentColor
                      : '#1a1a2e',
                    transition: 'background 0.04s',
                  }} />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center mb-3">
        <Knob value={volume} min={0} max={1} onChange={setVolume} label="Volume" unit="%" size="lg" color={accentColor} />
      </div>

      <div className="rounded p-2" style={{ background: '#08081a', border: '1px solid #1a1a30' }}>
        <div className="text-center mb-1.5" style={{ fontSize: 7, color: '#444466', fontFamily: 'monospace' }}>INPUTS</div>
        <div className="flex justify-around">
          <JackPort id={`${id}_l_in`} moduleId={id} type="input" label="L IN" audioNode={inputNode ?? undefined} />
          <JackPort id={`${id}_r_in`} moduleId={id} type="input" label="R IN" audioNode={inputNode ?? undefined} />
        </div>
      </div>
    </ModulePanel>
  );
}
