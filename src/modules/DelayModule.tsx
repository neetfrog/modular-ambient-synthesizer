import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import ModulePanel from '../components/ModulePanel';
import { ModuleIOSection } from '../components/ModuleIOSection';

interface DelayModuleProps {
  id: string;
}

function DelayModuleComponent({ id }: DelayModuleProps) {
  const engine = getAudioEngine();
  const delayRef = useRef<DelayNode | null>(null);
  const feedbackRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const inputRef = useRef<GainNode | null>(null);
  const [nodes, setNodes] = useState<{ input: GainNode; dry: GainNode; wet: GainNode } | null>(null);

  const [time, setTime] = useState(0.4);
  const [feedback, setFeedback] = useState(0.35);
  const [mix, setMix] = useState(0.5);
  const accentColor = '#fb923c';

  useEffect(() => {
    const ctx = engine.ctx;
    const input = ctx.createGain();
    const delay = ctx.createDelay(4);
    const fb = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();

    delay.delayTime.value = 0.4;
    fb.gain.value = 0.35;
    dry.gain.value = 0.5;
    wet.gain.value = 0.5;

    input.connect(dry);
    input.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);

    delayRef.current = delay;
    feedbackRef.current = fb;
    dryGainRef.current = dry;
    wetGainRef.current = wet;
    inputRef.current = input;
    setNodes({ input, dry, wet });

    return () => {
      input.disconnect();
      delay.disconnect();
      fb.disconnect();
      dry.disconnect();
      wet.disconnect();
    };
  }, []);

  useEffect(() => {
    if (delayRef.current) delayRef.current.delayTime.setTargetAtTime(time, engine.ctx.currentTime, 0.01);
  }, [time, engine.ctx]);

  useEffect(() => {
    if (feedbackRef.current) feedbackRef.current.gain.value = Math.min(0.95, feedback);
  }, [feedback]);

  useEffect(() => {
    if (dryGainRef.current) dryGainRef.current.gain.value = 1 - mix;
    if (wetGainRef.current) wetGainRef.current.gain.value = mix;
  }, [mix]);

  const tapTimes = useRef<number[]>([]);
  const handleTap = useCallback(() => {
    engine.resume();
    const now = Date.now();
    tapTimes.current = [...tapTimes.current.slice(-3), now];
    if (tapTimes.current.length >= 2) {
      const diffs = tapTimes.current.slice(1).map((t, i) => t - tapTimes.current[i]);
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length / 1000;
      setTime(Math.max(0.05, Math.min(4, avg)));
    }
  }, [engine]);

  // Memoize delay visualization
  const delayBars = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const amp = Math.pow(Math.min(0.95, feedback), i) * mix;
      return Math.max(1, amp * 24);
    });
  }, [feedback, mix]);

  return (
    <ModulePanel title="DELAY" subtitle="Tape Echo" accentColor={accentColor} width={170} badge="FX">
      <div className="flex gap-2 justify-around mb-3">
        <Knob
          value={time}
          min={0.05}
          max={2}
          onChange={setTime}
          label="Time"
          unit="s"
          size="md"
          color={accentColor}
          logarithmic
        />
        <Knob value={feedback} min={0} max={0.95} onChange={setFeedback} label="Feed" unit="%" size="md" color={accentColor} />
        <Knob value={mix} min={0} max={1} onChange={setMix} label="Mix" unit="%" size="md" color={accentColor} />
      </div>

      <div className="rounded mb-3 overflow-hidden" style={{ height: 32, background: '#08081a', border: '1px solid #1a1a30' }}>
        <svg width={150} height={32}>
          {delayBars.map((h, i) => {
            const x = (i / 6) * 140 + 5;
            const amp = Math.pow(Math.min(0.95, feedback), i) * mix;
            return (
              <rect
                key={i}
                x={x - 4}
                y={16 - h / 2}
                width={8}
                height={h}
                rx={2}
                fill={accentColor}
                opacity={Math.max(0.1, amp)}
              />
            );
          })}
        </svg>
      </div>

      <button
        onClick={handleTap}
        className="w-full rounded py-1 mb-2 text-xs transition-all"
        style={{
          fontFamily: 'monospace',
          background: '#0a0a18',
          border: `1px solid ${accentColor}`,
          color: accentColor,
          letterSpacing: '0.1em',
          cursor: 'pointer',
        }}
      >
        ⏱ TAP TEMPO
      </button>

      <ModuleIOSection
        ports={[
          { id: `${id}_in`, moduleId: id, type: 'input', label: 'IN', audioNode: nodes?.input },
          { id: `${id}_dry_out`, moduleId: id, type: 'output', label: 'DRY', audioNode: nodes?.dry },
          { id: `${id}_wet_out`, moduleId: id, type: 'output', label: 'WET', audioNode: nodes?.wet },
        ]}
        title="I/O"
      />
    </ModulePanel>
  );
}

export default React.memo(DelayModuleComponent);
