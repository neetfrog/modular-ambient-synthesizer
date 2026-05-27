import React, { useEffect, useRef, useState } from 'react';
import ModulePanel from '../components/ModulePanel';
import { ModuleIOSection } from '../components/ModuleIOSection';
import { getAudioEngine } from '../audio/AudioEngine';
import { broadcastNoteEvent } from './PolyVCOModule';

interface KeyboardModuleProps {
  id: string;
  label?: string;
  accentColor?: string;
}

// Note frequencies - 2 octaves (C3 to B4)
const NOTE_FREQUENCIES = {
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
} as const;

type NoteName = keyof typeof NOTE_FREQUENCIES;

// Map computer keyboard keys to notes - 2 octaves (defined outside component to avoid dependency issues)
const KEY_TO_NOTE: Record<string, NoteName> = {
  // ZXCVBNM: Octave 3 white keys (bass)
  'z': 'C3', 'x': 'D3', 'c': 'E3', 'v': 'F3', 'b': 'G3', 'n': 'A3', 'm': 'B3',
  // ASDFGH: Octave 3 black keys (sharps)
  'a': 'C#3', 's': 'D#3', 'd': 'F#3', 'f': 'G#3', 'g': 'A#3',
  // QWERTY: Octave 4 white keys (melody)
  'q': 'C4', 'w': 'D4', 'e': 'E4', 'r': 'F4', 't': 'G4', 'y': 'A4', 'u': 'B4',
};

function KeyboardModuleComponent({ id, label = 'KEYBOARD', accentColor = '#38bdf8' }: KeyboardModuleProps) {
  const engine = getAudioEngine();
  const cvOutRef = useRef<GainNode | null>(null);
  const gateOutRef = useRef<GainNode | null>(null);
  const [activeNotes, setActiveNotes] = useState<Set<NoteName>>(new Set());
  const [cvOut, setCvOut] = useState<GainNode | null>(null);
  const [gateOut, setGateOut] = useState<GainNode | null>(null);
  const [currentNote, setCurrentNote] = useState<NoteName | null>(null);
  const [width, setWidth] = useState(520);
  const resizeRef = useRef<HTMLDivElement>(null);

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
      
      // Broadcast note-on event for polyphonic synths
      broadcastNoteEvent({ type: 'noteOn', note, frequency: NOTE_FREQUENCIES[note] });
      
      // Update CV output to note frequency with smooth glide
      if (cvOutRef.current) {
        const now = engine.ctx.currentTime;
        const targetCV = NOTE_FREQUENCIES[note] / 220;
        const glideTime = 0.05; // 50ms glide for smooth pitch change
        cvOutRef.current.gain.cancelScheduledValues(now);
        cvOutRef.current.gain.setValueAtTime(cvOutRef.current.gain.value, now);
        cvOutRef.current.gain.linearRampToValueAtTime(targetCV, now + glideTime);
      }
      
      // Open gate when first key pressed - ramp up to avoid click
      if (prev.size === 0 && gateOutRef.current) {
        const now = engine.ctx.currentTime;
        const attackTime = 0.02; // 20ms attack to avoid click
        gateOutRef.current.gain.cancelScheduledValues(now);
        gateOutRef.current.gain.setValueAtTime(0, now);
        gateOutRef.current.gain.linearRampToValueAtTime(1, now + attackTime);
      }
      
      return next;
    });
  };

  const stopNote = (note: NoteName) => {
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      
      // Broadcast note-off event for polyphonic synths
      broadcastNoteEvent({ type: 'noteOff', note, frequency: NOTE_FREQUENCIES[note] });
      
      // Close gate when last key released - ramp down to avoid click
      if (next.size === 0 && gateOutRef.current) {
        const now = engine.ctx.currentTime;
        const releaseClickTime = 0.02; // 20ms to avoid click on release
        gateOutRef.current.gain.cancelScheduledValues(now);
        gateOutRef.current.gain.setValueAtTime(gateOutRef.current.gain.value, now);
        gateOutRef.current.gain.linearRampToValueAtTime(0, now + releaseClickTime);
        setCurrentNote(null);
      } else if (next.size > 0) {
        // Switch to another active note
        const firstNote = Array.from(next)[0];
        setCurrentNote(firstNote);
        if (cvOutRef.current) {
          const now = engine.ctx.currentTime;
          const targetCV = NOTE_FREQUENCIES[firstNote] / 220;
          const glideTime = 0.05; // smooth glide between notes
          cvOutRef.current.gain.cancelScheduledValues(now);
          cvOutRef.current.gain.setValueAtTime(cvOutRef.current.gain.value, now);
          cvOutRef.current.gain.linearRampToValueAtTime(targetCV, now + glideTime);
        }
      }
      
      return next;
    });
  };

  // Keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const note = KEY_TO_NOTE[e.key.toLowerCase()];
      if (note && !e.repeat) {
        playNote(note);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const note = KEY_TO_NOTE[e.key.toLowerCase()];
      if (note) {
        stopNote(note);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Resize handler
  useEffect(() => {
    let startX = 0;
    let startWidth = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const minWidth = 350;
      const maxWidth = 1200;
      const delta = e.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, minWidth), maxWidth);
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    const handleMouseDown = (e: MouseEvent) => {
      startX = e.clientX;
      startWidth = width;
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    const resizeHandle = resizeRef.current;
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown);
      return () => {
        resizeHandle.removeEventListener('mousedown', handleMouseDown);
      };
    }
  }, [width]);

  return (
    <div style={{ position: 'relative' }}>
      <ModulePanel title={label} width={width} accentColor={accentColor} badge="KBD">
        <div className="p-2 flex flex-col gap-2">
        {/* Info: Computer keyboard mapping */}
        <div
          className="text-center text-xs rounded p-1"
          style={{
            background: '#0a4a2e',
            border: '1px solid #1a7a4e',
            color: '#10b981',
            fontFamily: 'monospace',
            fontSize: '8px',
            lineHeight: '1.2',
          }}
        >
          <div>ZXCVBNM = low | ASDFG = low sharps | QWERTY = high</div>
        </div>

        {/* Piano keyboard - 2 octaves (C3 and C4) */}
        <div className="relative mx-auto" style={{ width: '100%', height: 90, background: '#1a1a2e', borderRadius: '4px', padding: '4px', overflow: 'hidden', touchAction: 'manipulation' }}>
          {/* White keys - 14 keys for 2 octaves */}
          <div className="flex gap-0" style={{ height: '100%' }}>
            {(['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'] as const).map((note, idx) => (
              <button
                key={note}
                onMouseDown={() => playNote(note as NoteName)}
                onMouseUp={() => stopNote(note as NoteName)}
                onMouseLeave={() => stopNote(note as NoteName)}
                onTouchStart={() => playNote(note as NoteName)}
                onTouchEnd={() => stopNote(note as NoteName)}
                style={{
                  flex: 1,
                  height: '100%',
                  background: activeNotes.has(note as NoteName) ? '#34d399' : '#f5f5f5',
                  border: '2px solid #333',
                  borderRadius: '0 0 4px 4px',
                  cursor: 'pointer',
                  fontSize: '8px',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  color: '#000',
                  transition: 'background 0.05s',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 2,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {note.slice(0, -1)}
              </button>
            ))}
          </div>

          {/* Black keys - 10 keys for 2 octaves */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '55%', pointerEvents: 'none' }}>
            {[
              { note: 'C#3' as NoteName, whiteIdx: 0.5 },
              { note: 'D#3' as NoteName, whiteIdx: 1.5 },
              { note: 'F#3' as NoteName, whiteIdx: 3.5 },
              { note: 'G#3' as NoteName, whiteIdx: 4.5 },
              { note: 'A#3' as NoteName, whiteIdx: 5.5 },
              { note: 'C#4' as NoteName, whiteIdx: 7.5 },
              { note: 'D#4' as NoteName, whiteIdx: 8.5 },
              { note: 'F#4' as NoteName, whiteIdx: 10.5 },
              { note: 'G#4' as NoteName, whiteIdx: 11.5 },
              { note: 'A#4' as NoteName, whiteIdx: 12.5 },
            ].map(({ note, whiteIdx }) => (
              <button
                key={note}
                onMouseDown={() => playNote(note)}
                onMouseUp={() => stopNote(note)}
                onMouseLeave={() => stopNote(note)}
                onTouchStart={() => playNote(note)}
                onTouchEnd={() => stopNote(note)}
                style={{
                  position: 'absolute',
                  left: `calc((${whiteIdx} / 14) * 100% - 13px)`,
                  width: 26,
                  height: '100%',
                  background: activeNotes.has(note) ? '#059669' : '#1a1a2e',
                  border: '2px solid #000',
                  borderRadius: '0 0 3px 3px',
                  cursor: 'pointer',
                  fontSize: '6px',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  color: '#0ff',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 1,
                  pointerEvents: 'auto',
                  transition: 'background 0.05s',
                  zIndex: 2,
                }}
              >
                {note.slice(0, -1)}
              </button>
            ))}
          </div>
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

    {/* Resize handle */}
    <div
      ref={resizeRef}
      data-nondrag="true"
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 16,
        height: 16,
        background: 'linear-gradient(135deg, transparent 50%, #38bdf8 50%)',
        cursor: 'nwse-resize',
        borderRadius: '0 0 6px 0',
        opacity: 0.6,
        transition: 'opacity 0.2s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
    />
    </div>
  );
}

export default React.memo(KeyboardModuleComponent);
