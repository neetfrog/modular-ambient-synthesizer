import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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

interface PolyVCOModuleProps {
  id: string;
  label?: string;
  accentColor?: string;
}

// Global keyboard event system
interface NoteEvent {
  type: 'noteOn' | 'noteOff';
  note: string;
  frequency: number;
}

const noteListeners = new Map<string, (event: NoteEvent) => void>();

export function registerNoteListener(id: string, callback: (event: NoteEvent) => void) {
  noteListeners.set(id, callback);
}

export function unregisterNoteListener(id: string) {
  noteListeners.delete(id);
}

export function broadcastNoteEvent(event: NoteEvent) {
  for (const callback of noteListeners.values()) {
    callback(event);
  }
}

function PolyVCOModuleComponent({ id, label = 'POLY-VCO', accentColor = '#f97316' }: PolyVCOModuleProps) {
  const engine = getAudioEngine();
  const voicesRef = useRef<Voice[]>([]);
  const outputGainRef = useRef<GainNode | null>(null);
  const cvInputRef = useRef<GainNode | null>(null);
  
  const [nodes, setNodes] = useState<{ out: GainNode; cvIn: GainNode } | null>(null);
  const [baseDetune, setBaseDetune] = useState(0);
  const [waveform, setWaveform] = useState<WaveformType>('sawtooth');
  const [voiceCount, setVoiceCount] = useState(6);
  const activeNotesRef = useRef<Map<string, Voice>>(new Map());

  // Initialize polyphonic voices
  useEffect(() => {
    const ctx = engine.ctx;
    const outputGain = ctx.createGain();
    outputGain.gain.value = 0.2; // Lower gain for multiple voices
    
    const cvInput = ctx.createGain();
    cvInput.gain.value = 1;
    
    // Create voice pool
    const voices: Voice[] = [];
    for (let i = 0; i < voiceCount; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.value = 110;
      osc.connect(gain);
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
    cvInputRef.current = cvInput;
    setNodes({ out: outputGain, cvIn: cvInput });

    return () => {
      voices.forEach(v => {
        try {
          v.osc.stop();
        } catch {}
        v.osc.disconnect();
        v.gain.disconnect();
      });
      outputGain.disconnect();
      cvInput.disconnect();
    };
  }, [engine, voiceCount]);

  // Allocate a voice for a note
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
    
    return targetVoice;
  }, [engine]);

  // Release a note
  const releaseNote = useCallback((note: string) => {
    const voice = activeNotesRef.current.get(note);
    if (!voice) return;
    
    activeNotesRef.current.delete(note);
    voice.note = null;
    
    const now = engine.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + 0.05);
  }, [engine]);

  // Listen for note events from keyboard
  useEffect(() => {
    const handleNoteEvent = (event: NoteEvent) => {
      const frequency = NOTE_FREQUENCIES[event.note as keyof typeof NOTE_FREQUENCIES];
      if (!frequency) return;
      
      if (event.type === 'noteOn') {
        allocateVoice(event.note, frequency);
      } else {
        releaseNote(event.note);
      }
    };
    
    registerNoteListener(id, handleNoteEvent);
    return () => unregisterNoteListener(id);
  }, [id, allocateVoice, releaseNote]);

  // Update waveform
  useEffect(() => {
    voicesRef.current.forEach(voice => {
      voice.osc.type = waveform;
    });
  }, [waveform]);

  // Update detune
  useEffect(() => {
    const now = engine.ctx.currentTime;
    voicesRef.current.forEach(voice => {
      voice.osc.detune.cancelScheduledValues(now);
      voice.osc.detune.setValueAtTime(voice.osc.detune.value, now);
      voice.osc.detune.linearRampToValueAtTime(baseDetune, now + 0.015);
    });
  }, [baseDetune, engine]);

  const handleWaveformChange = useCallback((w: WaveformType) => {
    setWaveform(w);
  }, []);

  const activeVoices = activeNotesRef.current.size;

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
    <ModulePanel title={label} subtitle="Polyphonic VCO" accentColor={accentColor} width={190} badge="POLY">
      <div className="flex gap-1 mb-3">
        {waveformButtons}
      </div>

      <div className="text-center text-xs mb-2" style={{ color: '#666688', fontFamily: 'monospace' }}>
        Voices: {activeVoices}/{voiceCount}
      </div>

      <div className="flex gap-2 justify-around mb-3">
        <Knob value={baseDetune} min={-100} max={100} onChange={setBaseDetune} label="Detune" size="md" color={accentColor} />
        <Knob value={voiceCount} min={2} max={16} onChange={setVoiceCount} label="Voices" size="md" color={accentColor} />
      </div>

      <ModuleIOSection
        ports={[
          { id: `${id}_out`, moduleId: id, type: 'output', label: 'OUT', audioNode: outputGainRef.current! },
        ]}
        title="I/O"
      />
    </ModulePanel>
  );
}

export default React.memo(PolyVCOModuleComponent);
