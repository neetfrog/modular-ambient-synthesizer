import React, { useEffect, useRef, useState, useMemo } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import ModulePanel from '../components/ModulePanel';
import { ModuleButton } from '../components/ModuleButton';
import { ModuleIOSection } from '../components/ModuleIOSection';

type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';

const FILTER_LABELS: Record<FilterType, string> = {
  lowpass: 'LP',
  highpass: 'HP',
  bandpass: 'BP',
  notch: 'NT',
};

interface VCFModuleProps {
  id: string;
}

function VCFModuleComponent({ id }: VCFModuleProps) {
  const engine = getAudioEngine();
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const cvGainRef = useRef<GainNode | null>(null);
  const [nodes, setNodes] = useState<{ filter: BiquadFilterNode; cv: GainNode } | null>(null);

  const [cutoff, setCutoff] = useState(800);
  const [resonance, setResonance] = useState(1);
  const [filterType, setFilterType] = useState<FilterType>('lowpass');
  const accentColor = '#4ade80';

  useEffect(() => {
    const ctx = engine.ctx;
    const filter = ctx.createBiquadFilter();
    const cvGain = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 1;
    cvGain.gain.value = 1000;
    cvGain.connect(filter.frequency);
    filterRef.current = filter;
    cvGainRef.current = cvGain;
    setNodes({ filter, cv: cvGain });
    return () => {
      filter.disconnect();
      cvGain.disconnect();
    };
  }, []);

  useEffect(() => {
    if (filterRef.current) filterRef.current.frequency.setTargetAtTime(cutoff, engine.ctx.currentTime, 0.01);
  }, [cutoff, engine.ctx]);

  useEffect(() => {
    if (filterRef.current) filterRef.current.Q.value = resonance;
  }, [resonance]);

  useEffect(() => {
    if (filterRef.current) filterRef.current.type = filterType;
  }, [filterType]);

  // Memoize frequency response visualization to avoid recalculation
  const freqBars = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => {
      const freq = 20 * Math.pow(1000, i / 23);
      let level = 0;
      if (filterType === 'lowpass') level = freq < cutoff ? 1 : Math.max(0, 1 - (freq - cutoff) / (cutoff * 3));
      else if (filterType === 'highpass') level = freq > cutoff ? 1 : Math.max(0, 1 - (cutoff - freq) / (cutoff * 3));
      else if (filterType === 'bandpass') {
        const dist = Math.abs(Math.log(freq / cutoff));
        level = Math.max(0, 1 - dist * 2);
      } else {
        const dist = Math.abs(Math.log(freq / cutoff));
        level = Math.min(1, dist * 2);
      }
      return Math.max(3, level * 100);
    });
  }, [cutoff, filterType]);

  return (
    <ModulePanel title="VCF" subtitle="Voltage Ctrl Filter" accentColor={accentColor} width={180} badge="FILTER">
      <div className="flex gap-1 mb-3">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map((ft) => (
          <ModuleButton
            key={ft}
            isActive={filterType === ft}
            onClick={() => setFilterType(ft)}
            label={FILTER_LABELS[ft]}
            accentColor={accentColor}
            title={ft}
            className="flex-1 text-xs"
          />
        ))}
      </div>

      <div className="flex gap-2 justify-around mb-3">
        <Knob
          value={cutoff}
          min={20}
          max={20000}
          onChange={setCutoff}
          label="Cutoff"
          unit="Hz"
          size="md"
          color={accentColor}
          logarithmic
        />
        <Knob
          value={resonance}
          min={0.1}
          max={25}
          onChange={setResonance}
          label="Res"
          size="md"
          color={accentColor}
          logarithmic
        />
      </div>

      {/* Freq response visual - memoized */}
      <div className="rounded mb-3 flex items-end overflow-hidden" style={{ height: 24, background: '#08081a', border: '1px solid #1a1a30', padding: '2px 4px', gap: 1 }}>
        {freqBars.map((height, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${height}%`,
              background: accentColor,
              opacity: 0.6,
              borderRadius: 1,
            }}
          />
        ))}
      </div>

      <ModuleIOSection
        ports={[
          { id: `${id}_in`, moduleId: id, type: 'input', label: 'IN', audioNode: nodes?.filter },
          { id: `${id}_cv_in`, moduleId: id, type: 'input', label: 'CV', audioNode: nodes?.cv },
          { id: `${id}_out`, moduleId: id, type: 'output', label: 'OUT', audioNode: nodes?.filter },
        ]}
        title="I/O"
      />
    </ModulePanel>
  );
}

export default React.memo(VCFModuleComponent);
