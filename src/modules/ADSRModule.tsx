import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import ModulePanel from '../components/ModulePanel';
import { ModuleIOSection } from '../components/ModuleIOSection';

interface ADSRModuleProps {
  id: string;
}

function ADSRModuleComponent({ id }: ADSRModuleProps) {
  const engine = getAudioEngine();
  const envGainRef = useRef<GainNode | null>(null);
  const constantSourceRef = useRef<ConstantSourceNode | null>(null);
  const gateInputRef = useRef<GainNode | null>(null);
  const gateAnalyserRef = useRef<AnalyserNode | null>(null);
  const [envNode, setEnvNode] = useState<GainNode | null>(null);
  const [gateInputNode, setGateInputNode] = useState<GainNode | null>(null);

  const [attack, setAttack] = useState(0.5);
  const [decay, setDecay] = useState(0.3);
  const [sustain, setSustain] = useState(0.6);
  const [release, setRelease] = useState(1.2);
  const [isGate, setIsGate] = useState(false);
  const accentColor = '#a78bfa';
  const rafIdRef = useRef<number | null>(null);
  const lastGateStateRef = useRef(false);

  useEffect(() => {
    const ctx = engine.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    
    // Create constant source to feed through the envelope (amplified for noticeable CV output)
    const constantSource = ctx.createConstantSource();
    constantSource.offset.value = 5; // 5V output for noticeable modulation
    constantSource.connect(gain);
    constantSource.start();
    
    // Create gate input node (receives audio from patches)
    const gateInput = ctx.createGain();
    gateInput.gain.value = 1;
    
    // Create analyser to detect gate signal
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    gateInput.connect(analyser);
    
    envGainRef.current = gain;
    constantSourceRef.current = constantSource;
    gateInputRef.current = gateInput;
    gateAnalyserRef.current = analyser;
    setEnvNode(gain);
    setGateInputNode(gateInput);
    
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      constantSource.stop();
      constantSource.disconnect();
      analyser.disconnect();
      gateInput.disconnect();
      gain.disconnect();
    };
  }, [engine.ctx]);

  const triggerEnvelope = useCallback(() => {
    if (!envGainRef.current) return;
    engine.resume();
    const ctx = engine.ctx;
    const gain = envGainRef.current.gain;
    const now = ctx.currentTime;
    
    // Cancel any existing scheduled changes
    gain.cancelScheduledValues(now);
    
    // Set initial value
    gain.setValueAtTime(0, now);
    
    // Attack: ramp from 0 to 1
    gain.linearRampToValueAtTime(1, now + Math.max(attack, 0.001));
    
    // Decay: ramp from 1 to sustain level
    gain.linearRampToValueAtTime(sustain, now + Math.max(attack, 0.001) + Math.max(decay, 0.001));
  }, [attack, decay, sustain, engine]);

  const releaseEnvelope = useCallback(() => {
    if (!envGainRef.current) return;
    const ctx = engine.ctx;
    const gain = envGainRef.current.gain;
    const now = ctx.currentTime;
    
    // Cancel scheduled changes and start release from current value
    gain.cancelScheduledValues(now);
    const currentValue = gain.value;
    gain.setValueAtTime(currentValue, now);
    gain.linearRampToValueAtTime(0, now + Math.max(release, 0.001));
  }, [release]);

  // Monitor gate input for incoming audio to auto-trigger envelope
  useEffect(() => {
    if (!gateAnalyserRef.current) return;
    
    const analyser = gateAnalyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const threshold = 100; // Detect when signal crosses this level (0-255 range)
    let stableCount = 0;
    let lastStableState = false;
    let hasEverSeenGate = false; // Track if we've ever detected a gate signal
    let silenceCount = 0; // Track frames of silence
    
    const checkGateSignal = () => {
      // Use time-domain data to detect DC levels (keyboard gate signal)
      analyser.getByteTimeDomainData(dataArray);
      
      // Calculate average amplitude across time-domain samples
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        // Center around 128 (DC bias) and measure deviation
        const centered = Math.abs(dataArray[i] - 128);
        sum += centered;
      }
      const average = sum / dataArray.length;
      const hasGate = average > threshold / 2; // Adjusted threshold for time-domain
      
      // Track if we've ever seen a real gate signal
      if (hasGate && average > 80) {
        hasEverSeenGate = true;
        silenceCount = 0;
      } else if (average < 30) {
        silenceCount++;
      }
      
      // Only consider gate-off if we previously saw a gate-on
      // and have been silent for several frames (to distinguish disconnect from gate release)
      const effectiveHasGate = hasGate || silenceCount < 6;
      
      // Debounce: require signal to be stable for 3 frames before triggering
      if (effectiveHasGate === lastStableState) {
        stableCount++;
      } else {
        stableCount = 0;
        lastStableState = effectiveHasGate;
      }
      
      // Trigger/release based on stable gate signal change
      if (stableCount >= 3 && hasEverSeenGate) {
        if (effectiveHasGate && !lastGateStateRef.current) {
          triggerEnvelope();
          lastGateStateRef.current = true;
        } else if (!effectiveHasGate && lastGateStateRef.current) {
          releaseEnvelope();
          lastGateStateRef.current = false;
        }
      }
      
      rafIdRef.current = requestAnimationFrame(checkGateSignal);
    };
    
    rafIdRef.current = requestAnimationFrame(checkGateSignal);
    
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [triggerEnvelope, releaseEnvelope]);

  // Re-trigger envelope when knobs change while gate is active
  useEffect(() => {
    if (!isGate || !envGainRef.current) return;
    
    const ctx = engine.ctx;
    const gain = envGainRef.current.gain;
    const now = ctx.currentTime;
    
    // Retrigger with new values
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0, now);
    gain.linearRampToValueAtTime(1, now + Math.max(attack, 0.001));
    gain.linearRampToValueAtTime(sustain, now + Math.max(attack, 0.001) + Math.max(decay, 0.001));
  }, [attack, decay, sustain, isGate, engine]);

  // Memoize ADSR path calculation
  const adsrPath = useMemo(() => {
    const w = 136,
      h = 48;
    const pad = 4;
    const totalT = attack + decay + 0.5 + release;
    const scale = (t: number) => (t / totalT) * (w - pad * 2) + pad;
    const attackX = scale(attack);
    const decayX = scale(attack + decay);
    const sustainX = scale(attack + decay + 0.5);
    const sustainY = pad + (1 - sustain) * (h - pad * 2);
    return `M ${pad} ${h - pad} L ${attackX} ${pad} L ${decayX} ${sustainY} L ${sustainX} ${sustainY} L ${w - pad} ${h - pad}`;
  }, [attack, decay, sustain, release]);

  const w = 136, h = 48;

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
          <path d={`${adsrPath} Z`} fill={`url(#adsr-fill-${id})`} />
          <path d={adsrPath} fill="none" stroke={accentColor} strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-1 mb-2">
        <Knob
          value={attack}
          min={0.001}
          max={4}
          onChange={setAttack}
          label="Attack"
          unit="s"
          size="sm"
          color={accentColor}
          logarithmic
        />
        <Knob
          value={decay}
          min={0.001}
          max={4}
          onChange={setDecay}
          label="Decay"
          unit="s"
          size="sm"
          color={accentColor}
          logarithmic
        />
        <Knob value={sustain} min={0} max={1} onChange={setSustain} label="Sustain" unit="%" size="sm" color={accentColor} />
        <Knob
          value={release}
          min={0.001}
          max={8}
          onChange={setRelease}
          label="Release"
          unit="s"
          size="sm"
          color={accentColor}
          logarithmic
        />
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
        onClick={() => {
          setIsGate(!isGate);
          if (!isGate) {
            triggerEnvelope();
          } else {
            releaseEnvelope();
          }
        }}
      >
        ▶ GATE
      </button>

      <ModuleIOSection
        ports={[
          { id: `${id}_env_out`, moduleId: id, type: 'output', label: 'ENV', audioNode: envNode ?? undefined },
          { id: `${id}_gate_in`, moduleId: id, type: 'input', label: 'GATE', audioNode: gateInputNode ?? undefined },
        ]}
        title="OUTPUTS"
      />
    </ModulePanel>
  );
}

export default React.memo(ADSRModuleComponent);
