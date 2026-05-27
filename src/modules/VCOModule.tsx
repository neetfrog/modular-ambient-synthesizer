import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import ModulePanel from '../components/ModulePanel';
import { ModuleButton } from '../components/ModuleButton';
import { ModuleIOSection } from '../components/ModuleIOSection';
import { registerNoteListener, unregisterNoteListener, broadcastNoteEvent } from './PolyVCOModule';

type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

// Move outside component to avoid recreating
const WAVEFORM_ICONS: Record<WaveformType, string> = {
  sine: '∿',
  square: '⊓',
  sawtooth: '⋀',
  triangle: '△',
};

const NOTE_FREQUENCIES: Record<string, number> = {
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
};

interface Voice {
  id: string;
  osc: OscillatorNode;
  gain: GainNode;
  note: string | null;
}

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
  
  // Polyphonic voice support
  const voicesRef = useRef<Voice[]>([]);
  const outputGainRef = useRef<GainNode | null>(null);
  const activeNotesRef = useRef<Map<string, Voice>>(new Map());
  
  const [nodes, setNodes] = useState<{ out: GainNode; fmIn: GainNode; pmIn: GainNode } | null>(null);
  const [freq, setFreq] = useState(110);
  const [detune, setDetune] = useState(0);
  const [waveform, setWaveform] = useState<WaveformType>('sawtooth');
  const [isRunning, setIsRunning] = useState(true);
  const [voiceCount, setVoiceCount] = useState(1);
  const [activeVoices, setActiveVoices] = useState(0);
  
  // Waveform visualization
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Initialize mono/poly oscillator
  useEffect(() => {
    const ctx = engine.ctx;
    
    if (voiceCount === 1) {
      // Monophonic mode - single oscillator
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const fmGain = ctx.createGain();
      const pmGain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;

      osc.type = 'sawtooth';
      osc.frequency.value = 110;
      osc.detune.value = 0;
      osc.connect(gain);
      osc.connect(analyser);
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
      analyserRef.current = analyser;
      setNodes({ out: gain, fmIn: fmGain, pmIn: pmGain });

      return () => {
        try {
          osc.stop();
        } catch {}
        osc.disconnect();
        gain.disconnect();
        fmGain.disconnect();
        pmGain.disconnect();
        analyser.disconnect();
      };
    } else {
      // Polyphonic mode - voice pool
      const outputGain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      outputGain.gain.value = 0.2; // Lower gain for multiple voices
      
      const fmGain = ctx.createGain();
      fmGain.gain.value = 220;
      
      const pmGain = ctx.createGain();
      pmGain.gain.value = 200;
      
      const voices: Voice[] = [];
      for (let i = 0; i < voiceCount; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.value = 110;
        osc.detune.value = 0;
        
        // Connect FM/PM to all voices
        fmGain.connect(osc.frequency);
        pmGain.connect(osc.detune);
        
        osc.connect(gain);
        // Tap analyser from first voice for visualization
        if (i === 0) {
          osc.connect(analyser);
        }
        gain.gain.value = 0;
        gain.connect(outputGain);
        osc.start();
        
        voices.push({
          id: `voice_${i}`,
          osc,
          gain,
          note: null,
        });
      }
      
      voicesRef.current = voices;
      outputGainRef.current = outputGain;
      fmGainRef.current = fmGain;
      pmGainRef.current = pmGain;
      analyserRef.current = analyser;
      setNodes({ out: outputGain, fmIn: fmGain, pmIn: pmGain });

      return () => {
        voices.forEach(v => {
          try {
            v.osc.stop();
          } catch {}
          v.osc.disconnect();
          v.gain.disconnect();
        });
        outputGain.disconnect();
        fmGain.disconnect();
        pmGain.disconnect();
        analyser.disconnect();
      };
    }
  }, [voiceCount, engine]);

  useEffect(() => {
    if (!oscRef.current && voiceCount === 1) return;
    if (voiceCount > 1) return; // Handled by polyphonic frequency allocation
    
    const now = engine.ctx.currentTime;
    const clampedFreq = Math.max(freq, 20);
    const rampTime = 0.015; // 15ms linear ramp for smooth frequency changes
    
    oscRef.current!.frequency.cancelScheduledValues(now);
    oscRef.current!.frequency.setValueAtTime(oscRef.current!.frequency.value, now);
    oscRef.current!.frequency.linearRampToValueAtTime(clampedFreq, now + rampTime);
    
    fmGainRef.current!.gain.cancelScheduledValues(now);
    fmGainRef.current!.gain.setValueAtTime(fmGainRef.current!.gain.value, now);
    fmGainRef.current!.gain.linearRampToValueAtTime(clampedFreq * 2, now + rampTime);
  }, [freq, engine, voiceCount]);

  useEffect(() => {
    if (voiceCount === 1) {
      if (!oscRef.current || detuneRef.current === detune) return;
      detuneRef.current = detune;
      const now = engine.ctx.currentTime;
      const rampTime = 0.015;
      
      oscRef.current.detune.cancelScheduledValues(now);
      oscRef.current.detune.setValueAtTime(oscRef.current.detune.value, now);
      oscRef.current.detune.linearRampToValueAtTime(detune, now + rampTime);
    } else {
      // Update detune for all voices
      const now = engine.ctx.currentTime;
      voicesRef.current.forEach(voice => {
        voice.osc.detune.cancelScheduledValues(now);
        voice.osc.detune.setValueAtTime(voice.osc.detune.value, now);
        voice.osc.detune.linearRampToValueAtTime(detune, now + 0.015);
      });
    }
  }, [detune, engine, voiceCount]);

  useEffect(() => {
    if (voiceCount === 1) {
      if (oscRef.current) {
        oscRef.current.type = waveform;
      }
    } else {
      voicesRef.current.forEach(voice => {
        voice.osc.type = waveform;
      });
    }
  }, [waveform, voiceCount]);

  useEffect(() => {
    if (voiceCount === 1) {
      if (!gainRef.current) return;
      const now = engine.ctx.currentTime;
      const targetValue = isRunning ? 0.35 : 0;
      const rampTime = 0.02;
      
      gainRef.current.gain.cancelScheduledValues(now);
      gainRef.current.gain.setValueAtTime(gainRef.current.gain.value, now);
      gainRef.current.gain.linearRampToValueAtTime(targetValue, now + rampTime);
    } else {
      if (!outputGainRef.current) return;
      const now = engine.ctx.currentTime;
      const targetValue = isRunning ? 0.2 : 0;
      const rampTime = 0.02;
      
      outputGainRef.current.gain.cancelScheduledValues(now);
      outputGainRef.current.gain.setValueAtTime(outputGainRef.current.gain.value, now);
      outputGainRef.current.gain.linearRampToValueAtTime(targetValue, now + rampTime);
    }
  }, [isRunning, engine, voiceCount]);

  // Allocate voice for polyphonic playback
  const allocateVoice = useCallback((note: string, frequency: number) => {
    const voices = voicesRef.current;
    
    // Check if note already playing
    let existingVoice = activeNotesRef.current.get(note);
    if (existingVoice) {
      return existingVoice;
    }
    
    // Find unused or quietest voice
    let targetVoice = voices[0];
    for (const voice of voices) {
      if (voice.note === null) {
        targetVoice = voice;
        break;
      }
    }
    
    targetVoice.note = note;
    activeNotesRef.current.set(note, targetVoice);
    
    const now = engine.ctx.currentTime;
    targetVoice.osc.frequency.cancelScheduledValues(now);
    targetVoice.osc.frequency.setValueAtTime(targetVoice.osc.frequency.value, now);
    targetVoice.osc.frequency.linearRampToValueAtTime(frequency, now + 0.01);
    
    targetVoice.gain.gain.cancelScheduledValues(now);
    targetVoice.gain.gain.setValueAtTime(0, now);
    targetVoice.gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    
    setActiveVoices(activeNotesRef.current.size);
    return targetVoice;
  }, [engine]);

  // Release voice for polyphonic playback
  const releaseNote = useCallback((note: string) => {
    const voice = activeNotesRef.current.get(note);
    if (!voice) return;
    
    activeNotesRef.current.delete(note);
    voice.note = null;
    
    const now = engine.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + 0.05);
    
    setActiveVoices(activeNotesRef.current.size);
  }, []);

  // Listen for note events from keyboard (only in poly mode)
  useEffect(() => {
    if (voiceCount === 1) return;
    
    const handleNoteEvent = (event: { type: 'noteOn' | 'noteOff'; note: string; frequency: number }) => {
      if (event.type === 'noteOn') {
        allocateVoice(event.note, event.frequency);
      } else {
        releaseNote(event.note);
      }
    };
    
    registerNoteListener(id, handleNoteEvent);
    return () => unregisterNoteListener(id);
  }, [id, voiceCount, allocateVoice, releaseNote]);

  // Draw waveform visualization
  useEffect(() => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let animationId: number;
    
    const draw = () => {
      animationId = requestAnimationFrame(draw);
      
      analyser.getByteTimeDomainData(dataArray);
      
      // Clear canvas
      ctx.fillStyle = '#08081a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw waveform
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [accentColor]);

  const handleWaveformChange = useCallback((w: WaveformType) => {
    setWaveform(w);
  }, []);

  const handleFreqChange = useCallback((value: number) => {
    setFreq(value);
  }, []);

  const handleDetuneChange = useCallback((value: number) => {
    setDetune(value);
  }, []);

  const handleToggle = useCallback(() => {
    engine.resume();
    setIsRunning((v) => !v);
  }, [engine]);

  const handleVoiceCountChange = useCallback((value: number) => {
    setVoiceCount(value);
    activeNotesRef.current.clear();
    setActiveVoices(0);
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
        className="rounded mb-2 border"
        style={{
          background: '#08081a',
          border: '1px solid #1a1a30',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          width={160}
          height={60}
          style={{
            display: 'block',
            width: '100%',
            height: '60px',
          }}
        />
      </div>

      <div
        className="text-center text-xs mb-2"
        style={{
          fontFamily: 'monospace',
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

      {voiceCount > 1 && (
        <div className="text-center text-xs mb-2" style={{ color: '#666688', fontFamily: 'monospace' }}>
          Voices: {activeVoices}/{voiceCount}
        </div>
      )}

      <div className="flex gap-2 justify-around mb-3">
        <Knob value={voiceCount} min={1} max={16} onChange={handleVoiceCountChange} label="Voices" size="md" color={accentColor} />
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
