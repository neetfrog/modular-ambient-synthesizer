import React, { useEffect, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import ModulePanel from '../components/ModulePanel';
import { ModuleIOSection } from '../components/ModuleIOSection';

interface MultModuleProps {
  id: string;
}

function MultModuleComponent({ id }: MultModuleProps) {
  const engine = getAudioEngine();
  const inputRef = useRef<GainNode | null>(null);
  const [outputs, setOutputs] = useState<Record<string, GainNode | null>>({
    out1: null,
    out2: null,
    out3: null,
    out4: null,
  });

  const accentColor = '#f472b6';

  useEffect(() => {
    const ctx = engine.ctx;

    // Create input
    const input = ctx.createGain();
    inputRef.current = input;

    // Create 4 output taps (all just connected to the same input, no processing)
    const outs: Record<string, GainNode> = {};
    [1, 2, 3, 4].forEach((i) => {
      const output = ctx.createGain();
      output.gain.value = 1;
      input.connect(output);
      outs[`out${i}`] = output;
    });

    setOutputs(outs);

    return () => {
      Object.values(outs).forEach((out) => out.disconnect());
      input.disconnect();
    };
  }, []);

  return (
    <ModulePanel title="MULT" subtitle="Splitter" accentColor={accentColor} width={120} badge="UTIL">
      <div className="text-xs text-center px-2 py-1 rounded bg-black/50 border border-pink-900">
        <div className="text-pink-400 font-bold">1→4</div>
      </div>

      <ModuleIOSection
        ports={[
          { id: `${id}_in`, moduleId: id, type: 'input', label: 'IN', audioNode: inputRef.current ?? undefined },
          { id: `${id}_out1`, moduleId: id, type: 'output', label: 'O1', audioNode: outputs.out1 ?? undefined },
          { id: `${id}_out2`, moduleId: id, type: 'output', label: 'O2', audioNode: outputs.out2 ?? undefined },
          { id: `${id}_out3`, moduleId: id, type: 'output', label: 'O3', audioNode: outputs.out3 ?? undefined },
          { id: `${id}_out4`, moduleId: id, type: 'output', label: 'O4', audioNode: outputs.out4 ?? undefined },
        ]}
        title=""
      />
    </ModulePanel>
  );
}

export default React.memo(MultModuleComponent);
