import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import ModulePanel from '../components/ModulePanel';
import { ModuleButton } from '../components/ModuleButton';
import { ModuleIOSection } from '../components/ModuleIOSection';

type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

// Move outside component to avoid recreating
const WAVEFORM_ICONS: Record<WaveformType, string> = {
  sine: '∿',
  square: '⊓',
  sawtooth: '⋀',
  triangle: '△',
};

interface VCOModuleProps {
  id: string;
  label?: string;
  accentColor?: string;
}

function VCOModuleComponent({ id, label = 'VCO-1', accentColor = '#f97316' }: VCOModuleProps) {
  const engine = getAudioEngine();
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const fmGainRef = useRef<GainNode | null>(null);
  const pmGainRef = useRef<GainNode | null>(null);
  const detuneRef = useRef<number>(0);
  const [nodes, setNodes] = useState<{ out: GainNode; fmIn: GainNode; pmIn: GainNode } | null>(null);

  const [freq, setFreq] = useState(110);
  const [detune, setDetune] = useState(0);
  const [waveform, setWaveform] = useState<WaveformType>('sawtooth');
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    const ctx = engine.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const fmGain = ctx.createGain();
    const pmGain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = 110;
    osc.detune.value = 0;
    osc.connect(gain);
    gain.gain.value = 0.35;
    fmGain.gain.value = 220;
    fmGain.connect(osc.frequency);
    pmGain.gain.value = 200;
    pmGain.connect(osc.detune);

    osc.start();
    oscRef.current = osc;
    gainRef.current = gain;
    fmGainRef.current = fmGain;
    pmGainRef.current = pmGain;
    setNodes({ out: gain, fmIn: fmGain, pmIn: pmGain });

    return () => {
      try {
        osc.stop();
      } catch {}
      osc.disconnect();
      gain.disconnect();
      fmGain.disconnect();
      pmGain.disconnect();
    };
  }, [id, engine]);

  useEffect(() => {
    if (!oscRef.current || !fmGainRef.current) return;
    
    const now = engine.ctx.currentTime;
    const clampedFreq = Math.max(freq, 20);
    const rampTime = 0.015; // 15ms linear ramp for smooth frequency changes
    
    oscRef.current.frequency.cancelScheduledValues(now);
    oscRef.current.frequency.setValueAtTime(oscRef.current.frequency.value, now);
    oscRef.current.frequency.linearRampToValueAtTime(clampedFreq, now + rampTime);
    
    fmGainRef.current.gain.cancelScheduledValues(now);
    fmGainRef.current.gain.setValueAtTime(fmGainRef.current.gain.value, now);
    fmGainRef.current.gain.linearRampToValueAtTime(clampedFreq * 2, now + rampTime);
  }, [freq, engine]);

  useEffect(() => {
    if (!oscRef.current || detuneRef.current === detune) return;
    
    detuneRef.current = detune;
    const now = engine.ctx.currentTime;
    const rampTime = 0.015; // 15ms linear ramp
    
    oscRef.current.detune.cancelScheduledValues(now);
    oscRef.current.detune.setValueAtTime(oscRef.current.detune.value, now);
    oscRef.current.detune.linearRampToValueAtTime(detune, now + rampTime);
  }, [detune, engine]);

  useEffect(() => {
    if (oscRef.current) {
      oscRef.current.type = waveform;
    }
  }, [waveform]);

  useEffect(() => {
    if (!gainRef.current) return;
    
    const now = engine.ctx.currentTime;
    const targetValue = isRunning ? 0.35 : 0;
    const rampTime = 0.02; // 20ms linear ramp for smooth on/off
    
    gainRef.current.gain.cancelScheduledValues(now);
    gainRef.current.gain.setValueAtTime(gainRef.current.gain.value, now);
    gainRef.current.gain.linearRampToValueAtTime(targetValue, now + rampTime);
  }, [isRunning, engine]);

  const handleToggle = useCallback(() => {
    engine.resume();
    setIsRunning((v) => !v);
  }, [engine]);

  const handleWaveformChange = useCallback((w: WaveformType) => {
    setWaveform(w);
  }, []);

  const handleFreqChange = useCallback((value: number) => {
    setFreq(value);
  }, []);

  const handleDetuneChange = useCallback((value: number) => {
    setDetune(value);
  }, []);

  const displayFreq = useMemo(() => 
    freq >= 1000 ? `${(freq / 1000).toFixed(2)}kHz` : `${freq.toFixed(1)}Hz`,
    [freq]
  );

  const waveformButtons = useMemo(() =>
    (Object.keys(WAVEFORM_ICONS) as WaveformType[]).map((w) => (
      <ModuleButton
        key={w}
        isActive={waveform === w}
        onClick={() => handleWaveformChange(w)}
        label={WAVEFORM_ICONS[w]}
        accentColor={accentColor}
        title={w}
        className="flex-1"
      />
    )),
    [waveform, accentColor, handleWaveformChange]
  );

  return (
    <ModulePanel title={label} subtitle="Voltage Ctrl Osc" accentColor={accentColor} width={190} badge="VCO">
      <div className="flex gap-1 mb-3">
        {waveformButtons}
      </div>

      <div
        className="text-center rounded mb-2 py-1"
        style={{
          background: '#08081a',
          border: '1px solid #1a1a30',
          fontFamily: 'monospace',
          fontSize: 11,
          color: accentColor,
        }}
      >
        {displayFreq}
      </div>

      <div className="flex gap-2 justify-around mb-3">
        <Knob
          value={freq}
          min={20}
          max={4000}
          onChange={handleFreqChange}
          label="Freq"
          unit="Hz"
          size="md"
          color={accentColor}
          logarithmic
        />
        <Knob value={detune} min={-100} max={100} onChange={handleDetuneChange} label="Detune" size="md" color={accentColor} />
      </div>

      <div className="flex justify-center mb-3">
        <button
          onClick={handleToggle}
          className="rounded px-4 py-1 text-xs font-bold transition-all"
          style={{
            fontFamily: 'monospace',
            background: isRunning ? `${accentColor}22` : '#1a1a2e',
            border: `1px solid ${isRunning ? accentColor : '#333355'}`,
            color: isRunning ? accentColor : '#555577',
            boxShadow: isRunning ? `0 0 10px ${accentColor}44` : 'none',
            letterSpacing: '0.1em',
            cursor: 'pointer',
          }}
        >
          {isRunning ? '● ON' : '○ OFF'}
        </button>
      </div>

      <ModuleIOSection
        ports={[
          { id: `${id}_out`, moduleId: id, type: 'output', label: 'OUT', audioNode: nodes?.out },
          { id: `${id}_fm_in`, moduleId: id, type: 'input', label: 'FM IN', audioNode: nodes?.fmIn },
          { id: `${id}_pm_in`, moduleId: id, type: 'input', label: 'PM IN', audioNode: nodes?.pmIn },
        ]}
        title="OUTPUTS / INPUTS"
      />
    </ModulePanel>
  );
}

export default React.memo(VCOModuleComponent);
