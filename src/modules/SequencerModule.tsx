import { useEffect, useRef, useState, useCallback } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import JackPort from '../components/JackPort';
import ModulePanel from '../components/ModulePanel';

const NOTES = [
  130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94,
  261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88,
  523.25, 587.33,
];

const NOTE_NAMES = ['C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4','B4','C5','D5'];

// Normalize frequencies to 0-1 range for use as CV modulation signals
const NOTE_CV = NOTES.map(freq => {
  const min = Math.min(...NOTES);
  const max = Math.max(...NOTES);
  return (freq - min) / (max - min);
});

interface SequencerModuleProps {
  id: string;
}

export default function SequencerModule({ id }: SequencerModuleProps) {
  const engine = getAudioEngine();
  const cvOutRef = useRef<ConstantSourceNode | null>(null);
  const gateOutRef = useRef<GainNode | null>(null);

  const STEPS = 8;
  const [steps, setSteps] = useState<number[]>(Array(STEPS).fill(0).map((_, i) => i * 2));
  const [active, setActive] = useState<boolean[]>(Array(STEPS).fill(true));
  const [currentStep, setCurrentStep] = useState(-1);
  const [bpm, setBpm] = useState(60);
  const [isPlaying, setIsPlaying] = useState(true);
  const stepRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const accentColor = '#fbbf24';

  useEffect(() => {
    const ctx = engine.ctx;
    
    // Create CV output (control voltage)
    const cv = ctx.createConstantSource();
    cv.offset.value = 220;
    // Connect to a dummy gain to keep it in the audio graph
    const cvDummy = ctx.createGain();
    cvDummy.gain.value = 0;
    cv.connect(cvDummy);
    cvDummy.connect(ctx.destination);
    cv.start();
    
    // Create gate output (trigger/pulse)
    const gate = ctx.createGain();
    gate.gain.value = 0;
    // Connect gate to dummy output as well
    const gateDummy = ctx.createGain();
    gateDummy.gain.value = 0;
    gate.connect(gateDummy);
    gateDummy.connect(ctx.destination);
    
    cvOutRef.current = cv;
    gateOutRef.current = gate;
    
    return () => {
      try { cv.stop(); } catch {}
      try { cv.disconnect(); } catch {}
      try { cvDummy.disconnect(); } catch {}
      try { gate.disconnect(); } catch {}
      try { gateDummy.disconnect(); } catch {}
    };
  }, []);

  const tick = useCallback(() => {
    const step = stepRef.current;
    setCurrentStep(step);
    if (cvOutRef.current && active[step]) {
      cvOutRef.current.offset.setTargetAtTime(NOTE_CV[steps[step]], engine.ctx.currentTime, 0.005);
    }
    if (gateOutRef.current) {
      const g = gateOutRef.current.gain;
      if (active[step]) {
        g.cancelScheduledValues(engine.ctx.currentTime);
        g.setValueAtTime(1, engine.ctx.currentTime);
        g.setValueAtTime(0, engine.ctx.currentTime + 0.05);
      }
    }
    stepRef.current = (step + 1) % STEPS;
  }, [steps, active]);

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCurrentStep(-1);
      return;
    }
    engine.resume();
    const interval = (60 / bpm) * 1000;
    timerRef.current = window.setInterval(tick, interval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, bpm, tick]);

  const setStep = (i: number, noteIdx: number) => {
    setSteps((prev) => prev.map((s, idx) => idx === i ? noteIdx : s));
  };

  const toggleActive = (i: number) => {
    setActive((prev) => prev.map((a, idx) => idx === i ? !a : a));
  };

  return (
    <ModulePanel title="SEQ-8" subtitle="Step Sequencer" accentColor={accentColor} width={280} badge="SEQ">
      {/* Steps */}
      <div className="flex gap-1 mb-3">
        {steps.map((noteIdx, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5" style={{ flex: 1 }}>
            {/* Note display */}
            <div
              className="text-center rounded px-0.5"
              style={{
                fontSize: 7,
                fontFamily: 'monospace',
                color: currentStep === i ? accentColor : active[i] ? '#666688' : '#2a2a4a',
                background: currentStep === i ? `${accentColor}22` : 'transparent',
                border: `1px solid ${currentStep === i ? accentColor : 'transparent'}`,
                minWidth: 20,
                lineHeight: '14px',
              }}
            >
              {NOTE_NAMES[noteIdx]}
            </div>

            {/* Vertical slider */}
            <div
              className="relative rounded overflow-hidden"
              style={{ width: '100%', height: 56, background: '#08081a', border: '1px solid #1a1a30' }}
            >
              <div
                className="absolute bottom-0 w-full rounded transition-all"
                style={{
                  height: `${((noteIdx) / 15) * 100}%`,
                  background: currentStep === i
                    ? `linear-gradient(to top, ${accentColor}, ${accentColor}88)`
                    : active[i]
                    ? `linear-gradient(to top, ${accentColor}66, ${accentColor}33)`
                    : `linear-gradient(to top, #2a2a4a, #1a1a30)`,
                  boxShadow: currentStep === i ? `0 0 8px ${accentColor}88` : 'none',
                }}
              />
              <input
                type="range"
                min={0}
                max={15}
                step={1}
                value={noteIdx}
                onChange={(e) => setStep(i, parseInt(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                style={{ writingMode: 'vertical-lr', direction: 'rtl', WebkitAppearance: 'slider-vertical' }}
              />
            </div>

            {/* Active toggle */}
            <button
              onClick={() => toggleActive(i)}
              className="rounded w-full transition-all"
              style={{
                height: 10,
                background: active[i] ? accentColor : '#1a1a2e',
                border: `1px solid ${active[i] ? accentColor : '#2a2a4a'}`,
                boxShadow: active[i] ? `0 0 4px ${accentColor}88` : 'none',
              }}
            />
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-3">
        <Knob value={bpm} min={20} max={240} onChange={setBpm} label="BPM" size="sm" color={accentColor} />
        <button
          onClick={() => { engine.resume(); setIsPlaying((v) => !v); }}
          className="flex-1 rounded py-2 transition-all font-bold"
          style={{
            fontFamily: 'monospace',
            fontSize: 11,
            letterSpacing: '0.1em',
            background: isPlaying ? `${accentColor}22` : '#0a0a18',
            border: `2px solid ${isPlaying ? accentColor : '#2a2a4a'}`,
            color: isPlaying ? accentColor : '#666688',
            boxShadow: isPlaying ? `0 0 12px ${accentColor}44` : 'none',
            cursor: 'pointer',
          }}
        >
          {isPlaying ? '⏸ STOP' : '▶ PLAY'}
        </button>
        <button
          onClick={() => {
            stepRef.current = 0;
            setCurrentStep(-1);
          }}
          className="px-3 rounded py-2 transition-all"
          style={{
            fontFamily: 'monospace',
            fontSize: 9,
            background: '#0a0a18',
            border: '1px solid #2a2a4a',
            color: '#666688',
            cursor: 'pointer',
          }}
        >
          ⏮ RST
        </button>
      </div>

      {/* Jacks */}
      <div className="rounded p-2" style={{ background: '#08081a', border: '1px solid #1a1a30' }}>
        <div className="text-center mb-1.5" style={{ fontSize: 7, color: '#444466', fontFamily: 'monospace' }}>OUTPUTS</div>
        <div className="flex justify-around">
          <JackPort id={`${id}_cv_out`} moduleId={id} type="output" label="CV" audioNode={cvOutRef.current ?? undefined} />
          <JackPort id={`${id}_gate_out`} moduleId={id} type="output" label="GATE" audioNode={gateOutRef.current ?? undefined} />
        </div>
      </div>
    </ModulePanel>
  );
}
