import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import ModulePanel from '../components/ModulePanel';
import { ModuleButton } from '../components/ModuleButton';
import { ModuleIOSection } from '../components/ModuleIOSection';

type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

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
    gain.gain.value = 0.35; // Reduce headroom for multiple oscillators
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
  }, []);

  useEffect(() => {
    if (oscRef.current) {
      oscRef.current.frequency.setTargetAtTime(freq, engine.ctx.currentTime, 0.01);
      if (fmGainRef.current) fmGainRef.current.gain.value = freq * 2;
    }
  }, [freq, engine.ctx]);

  useEffect(() => {
    if (oscRef.current) oscRef.current.detune.value = detune;
  }, [detune]);

  useEffect(() => {
    if (oscRef.current) oscRef.current.type = waveform;
  }, [waveform]);

  useEffect(() => {
    if (gainRef.current)
      gainRef.current.gain.setTargetAtTime(isRunning ? 1 : 0, engine.ctx.currentTime, 0.01);
  }, [isRunning, engine.ctx]);

  const handleToggle = useCallback(() => {
    engine.resume();
    setIsRunning((v) => !v);
  }, []);

  const displayFreq = freq >= 1000 ? `${(freq / 1000).toFixed(2)}kHz` : `${freq.toFixed(1)}Hz`;

  return (
    <ModulePanel title={label} subtitle="Voltage Ctrl Osc" accentColor={accentColor} width={190} badge="VCO">
      <div className="flex gap-1 mb-3">
        {(Object.keys(WAVEFORM_ICONS) as WaveformType[]).map((w) => (
          <ModuleButton
            key={w}
            isActive={waveform === w}
            onClick={() => setWaveform(w)}
            label={WAVEFORM_ICONS[w]}
            accentColor={accentColor}
            title={w}
            className="flex-1"
          />
        ))}
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
          onChange={setFreq}
          label="Freq"
          unit="Hz"
          size="md"
          color={accentColor}
          logarithmic
        />
        <Knob value={detune} min={-100} max={100} onChange={setDetune} label="Detune" size="md" color={accentColor} />
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
