import { useEffect, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import JackPort from '../components/JackPort';
import ModulePanel from '../components/ModulePanel';

type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';

const FILTER_LABELS: Record<FilterType, string> = {
  lowpass: 'LP', highpass: 'HP', bandpass: 'BP', notch: 'NT',
};

interface VCFModuleProps {
  id: string;
}

export default function VCFModule({ id }: VCFModuleProps) {
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
  }, [cutoff]);

  useEffect(() => {
    if (filterRef.current) filterRef.current.Q.value = resonance;
  }, [resonance]);

  useEffect(() => {
    if (filterRef.current) filterRef.current.type = filterType;
  }, [filterType]);

  return (
    <ModulePanel title="VCF" subtitle="Voltage Ctrl Filter" accentColor={accentColor} width={180} badge="FILTER">
      <div className="flex gap-1 mb-3">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map((ft) => (
          <button
            key={ft}
            onClick={() => setFilterType(ft)}
            className="flex-1 rounded text-xs transition-all"
            style={{
              height: 24,
              background: filterType === ft ? `${accentColor}33` : '#0a0a18',
              border: `1px solid ${filterType === ft ? accentColor : '#2a2a4a'}`,
              color: filterType === ft ? accentColor : '#555577',
              fontFamily: 'monospace',
              fontSize: 9,
              letterSpacing: '0.05em',
              cursor: 'pointer',
            }}
          >
            {FILTER_LABELS[ft]}
          </button>
        ))}
      </div>

      <div className="flex gap-2 justify-around mb-3">
        <Knob value={cutoff} min={20} max={20000} onChange={setCutoff} label="Cutoff" unit="Hz" size="md" color={accentColor} logarithmic />
        <Knob value={resonance} min={0.1} max={25} onChange={setResonance} label="Res" size="md" color={accentColor} logarithmic />
      </div>

      {/* Freq response visual */}
      <div className="rounded mb-3 flex items-end overflow-hidden" style={{ height: 24, background: '#08081a', border: '1px solid #1a1a30', padding: '2px 4px', gap: 1 }}>
        {Array.from({ length: 24 }).map((_, i) => {
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
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${Math.max(3, level * 100)}%`,
                background: accentColor,
                opacity: 0.6,
                borderRadius: 1,
              }}
            />
          );
        })}
      </div>

      <div className="rounded p-2" style={{ background: '#08081a', border: '1px solid #1a1a30' }}>
        <div className="text-center mb-1.5" style={{ fontSize: 7, color: '#444466', fontFamily: 'monospace' }}>I/O</div>
        <div className="flex justify-around">
          <JackPort id={`${id}_in`} moduleId={id} type="input" label="IN" audioNode={nodes?.filter} />
          <JackPort id={`${id}_cv_in`} moduleId={id} type="input" label="CV" audioNode={nodes?.cv} />
          <JackPort id={`${id}_out`} moduleId={id} type="output" label="OUT" audioNode={nodes?.filter} />
        </div>
      </div>
    </ModulePanel>
  );
}
