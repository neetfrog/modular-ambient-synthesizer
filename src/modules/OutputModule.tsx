import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import ModulePanel from '../components/ModulePanel';
import { ModuleIOSection } from '../components/ModuleIOSection';

interface OutputModuleProps {
  id: string;
}

function OutputModuleComponent({ id }: OutputModuleProps) {
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
        const rms = Math.sqrt(sum / data.length);
        // Update both channels together with slight variation for stereo visual
        setVuLevel(rms);
        setVuLevelR(rms * 0.95);
        lastUpdate = now;
      }
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
    if (inputGainRef.current) {
      const now = engine.ctx.currentTime;
      const rampTime = 0.02; // 20ms linear ramp
      const targetValue = isOn ? volume : 0;
      inputGainRef.current.gain.cancelScheduledValues(now);
      inputGainRef.current.gain.setValueAtTime(inputGainRef.current.gain.value, now);
      inputGainRef.current.gain.linearRampToValueAtTime(targetValue, now + rampTime);
    }
  }, [volume, isOn, engine.ctx]);

  const toggleOutput = useCallback(() => {
    engine.resume();
    setIsOn((v) => !v);
  }, [engine]);

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
        <div style={{ fontSize: 7, color: '#444466', fontFamily: 'monospace', letterSpacing: '0.06em', textAlign: 'center', marginBottom: 4 }}>
          STEREO VU
        </div>
        {([
          ['L', vuLevel],
          ['R', vuLevelR],
        ] as const).map(([ch, level]) => (
          <div key={ch} className="flex items-center gap-1.5 mb-0.5">
            <span style={{ fontSize: 7, color: '#555577', fontFamily: 'monospace', width: 8 }}>{ch}</span>
            <div className="flex gap-0.5 flex-1">
              {Array.from({ length: vuBars }).map((_, i) => {
                const thresh = i / vuBars;
                const active = level > thresh * 0.45;
                const clipping = thresh > 0.875; // Red zone (clipping)
                const warning = thresh > 0.7; // Orange zone (warning)
                
                let barColor = '#1a1a2e'; // Inactive
                if (active) {
                  if (clipping) barColor = '#ef4444'; // Red for clipping
                  else if (warning) barColor = '#f97316'; // Orange for warning
                  else barColor = '#22c55e'; // Green for normal
                }
                
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 1,
                      background: barColor,
                      transition: 'background 0.04s',
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center mb-3">
        <Knob value={volume} min={0} max={1} onChange={setVolume} label="Volume" unit="%" size="lg" color={accentColor} />
      </div>

      <ModuleIOSection
        ports={[
          { id: `${id}_l_in`, moduleId: id, type: 'input', label: 'L IN', audioNode: inputNode ?? undefined },
          { id: `${id}_r_in`, moduleId: id, type: 'input', label: 'R IN', audioNode: inputNode ?? undefined },
        ]}
        title="INPUTS"
      />
    </ModulePanel>
  );
}

export default React.memo(OutputModuleComponent);
