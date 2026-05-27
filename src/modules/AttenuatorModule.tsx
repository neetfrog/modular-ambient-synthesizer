import React, { useEffect, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import Knob from '../components/Knob';
import ModulePanel from '../components/ModulePanel';
import { ModuleIOSection } from '../components/ModuleIOSection';

interface AttenuatorModuleProps {
  id: string;
}

function AttenuatorModuleComponent({ id }: AttenuatorModuleProps) {
  const engine = getAudioEngine();
  const inputRef = useRef<GainNode | null>(null);
  const outputRef = useRef<GainNode | null>(null);
  const [attenuation, setAttenuation] = useState(1); // 0-1 scale
  const accentColor = '#60a5fa';

  useEffect(() => {
    const ctx = engine.ctx;

    // Create input and output nodes
    const input = ctx.createGain();
    const output = ctx.createGain();

    input.connect(output);

    inputRef.current = input;
    outputRef.current = output;

    return () => {
      input.disconnect();
      output.disconnect();
    };
  }, []);

  // Update output gain based on attenuation knob
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.gain.setTargetAtTime(attenuation, 0, 0.01);
    }
  }, [attenuation]);

  return (
    <ModulePanel title="ATTEN" subtitle="Attenuator" accentColor={accentColor} width={120} badge="UTIL">
      <Knob
        value={attenuation}
        min={0}
        max={1}
        onChange={setAttenuation}
        label="Amt"
        unit="%"
        size="sm"
        color={accentColor}
      />
      <div className="text-center text-xs text-blue-400 font-bold mt-1">{Math.round(attenuation * 100)}%</div>

      <ModuleIOSection
        ports={[
          { id: `${id}_in`, moduleId: id, type: 'input', label: 'IN', audioNode: inputRef.current ?? undefined },
          { id: `${id}_out`, moduleId: id, type: 'output', label: 'OUT', audioNode: outputRef.current ?? undefined },
        ]}
        title=""
      />
    </ModulePanel>
  );
}

export default React.memo(AttenuatorModuleComponent);
