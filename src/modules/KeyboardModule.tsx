import React, { useEffect, useRef, useState } from 'react';
import ModulePanel from '../components/ModulePanel';
import { ModuleIOSection } from '../components/ModuleIOSection';
import { getAudioEngine } from '../audio/AudioEngine';

interface KeyboardModuleProps {
  id: string;
  label?: string;
  accentColor?: string;
}

// Note frequencies for 2 octaves starting from C3
const NOTE_FREQUENCIES = {
  'C': 130.81, 'C#': 138.59, 'D': 146.83, 'D#': 155.56,
  'E': 164.81, 'F': 174.61, 'F#': 185.00, 'G': 196.00,
  'G#': 207.65, 'A': 220.00, 'A#': 233.08, 'B': 246.94,
} as const;

type NoteName = keyof typeof NOTE_FREQUENCIES;

const NOTES: NoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const WHITE_NOTES: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_NOTES: (NoteName | null)[] = [null, 'C#', null, 'D#', null, null, 'F#', null, 'G#', null, 'A#', null];

function KeyboardModuleComponent({ id, label = 'KEYBOARD', accentColor = '#38bdf8' }: KeyboardModuleProps) {
  const engine = getAudioEngine();
  const cvOutRef = useRef<GainNode | null>(null);
  const gateOutRef = useRef<GainNode | null>(null);
  const [activeNotes, setActiveNotes] = useState<Set<NoteName>>(new Set());
  const [cvOut, setCvOut] = useState<GainNode | null>(null);
  const [gateOut, setGateOut] = useState<GainNode | null>(null);
  const [currentNote, setCurrentNote] = useState<NoteName | null>(null);

  // Initialize CV and GATE outputs (control signals only, no audio)
  useEffect(() => {
    const ctx = engine.ctx;
    
    // CV output - outputs frequency value as voltage (ConstantSource at note frequency)
    const cvSource = ctx.createConstantSource();
    const cvGain = ctx.createGain();
    cvGain.gain.value = 0;
    cvSource.connect(cvGain);
    cvSource.start();
    cvOutRef.current = cvGain;
    setCvOut(cvGain);

    // GATE output - outputs 0 or 1 when keys pressed
    const gateSource = ctx.createConstantSource();
    const gateGain = ctx.createGain();
    gateGain.gain.value = 0; // Start with no gate
    gateSource.connect(gateGain);
    gateSource.start();
    gateOutRef.current = gateGain;
    setGateOut(gateGain);

    return () => {
      try {
        cvSource.stop();
        cvSource.disconnect();
        gateSource.stop();
        gateSource.disconnect();
      } catch {
        // Already stopped
      }
    };
  }, [engine]);

  // Use refs for ports to ensure they're always current
  const portsCvOut = cvOutRef.current;
  const portsGateOut = gateOutRef.current;

  const playNote = (note: NoteName) => {
    setActiveNotes((prev) => {
      const next = new Set([...prev, note]);
      setCurrentNote(note);
      
      // Update CV output to note frequency (for VCO pitch control)
      if (cvOutRef.current) {
        const now = engine.ctx.currentTime;
        cvOutRef.current.gain.setValueAtTime(NOTE_FREQUENCIES[note] / 220, now);
      }
      
      // Open gate when first key pressed (ADSR will handle envelope)
      if (prev.size === 0 && gateOutRef.current) {
        const now = engine.ctx.currentTime;
        gateOutRef.current.gain.setValueAtTime(1, now);
      }
      
      return next;
    });
  };

  const stopNote = (note: NoteName) => {
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      
      // Close gate when last key released (ADSR will handle release tail)
      if (next.size === 0 && gateOutRef.current) {
        const now = engine.ctx.currentTime;
        gateOutRef.current.gain.setValueAtTime(0, now);
        setCurrentNote(null);
      } else if (next.size > 0) {
        // Switch to another active note
        const firstNote = Array.from(next)[0];
        setCurrentNote(firstNote);
        if (cvOutRef.current) {
          const now = engine.ctx.currentTime;
          cvOutRef.current.gain.setValueAtTime(NOTE_FREQUENCIES[firstNote] / 220, now);
        }
      }
      
      return next;
    });
  };

  return (
    <ModulePanel title={label} width={280} accentColor={accentColor} badge="KBD">
      <div className="p-2 flex flex-col gap-2">
        {/* Piano keyboard */}
        <div className="relative h-20 flex items-end gap-0.5">
          {/* White keys */}
          <div className="flex gap-1">
            {WHITE_NOTES.map((note) => (
              <button
                key={note}
                onMouseDown={() => playNote(note)}
                onMouseUp={() => stopNote(note)}
                onMouseLeave={() => stopNote(note)}
                className="flex-1 rounded-b transition-all"
                style={{
                  width: 24,
                  height: 70,
                  background: activeNotes.has(note)
                    ? '#e0e0e0'
                    : 'white',
                  border: '1px solid #999',
                  borderTop: 'none',
                  cursor: 'pointer',
                  fontSize: 8,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 2,
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  color: '#333',
                }}
              >
                {note}
              </button>
            ))}
          </div>

          {/* Black keys - positioned absolutely */}
          {BLACK_NOTES.map((note, idx) => {
            if (!note) return null;
            const offset = idx < 6 ? idx * 22.5 + 16 : (idx - 6) * 22.5 + 16;
            return (
              <button
                key={note}
                onMouseDown={() => playNote(note)}
                onMouseUp={() => stopNote(note)}
                onMouseLeave={() => stopNote(note)}
                className="absolute rounded-b transition-all"
                style={{
                  width: 16,
                  height: 50,
                  left: offset,
                  top: 0,
                  background: activeNotes.has(note) ? '#333' : '#000',
                  border: '1px solid #000',
                  cursor: 'pointer',
                  fontSize: 7,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 1,
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  color: '#fff',
                  zIndex: 10,
                }}
              >
                {note}
              </button>
            );
          })}
        </div>

        {/* Octave info */}
        <div
          className="text-center text-xs rounded p-1"
          style={{
            background: '#08081a',
            border: '1px solid #1a1a30',
            color: accentColor,
            fontFamily: 'monospace',
          }}
        >
          C3 - B4
        </div>

        {/* Output section */}
        <ModuleIOSection
          ports={[
            { id: `${id}_cv_out`, moduleId: id, type: 'output', label: 'CV', audioNode: portsCvOut! },
            { id: `${id}_gate_out`, moduleId: id, type: 'output', label: 'GATE', audioNode: portsGateOut! },
          ]}
          title="OUTPUTS"
        />
      </div>
    </ModulePanel>
  );
}

export default React.memo(KeyboardModuleComponent);
