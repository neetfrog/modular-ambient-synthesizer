import React, { useEffect, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';
import { usePatchStore } from '../store/synthStore';
import ModulePanel from '../components/ModulePanel';
import { ModuleIOSection } from '../components/ModuleIOSection';

interface ClockDividerModuleProps {
  id: string;
}

function ClockDividerModuleComponent({ id }: ClockDividerModuleProps) {
  const engine = getAudioEngine();
  const clockInRef = useRef<GainNode | null>(null);
  const [divisionOutputs, setDivisionOutputs] = useState<Record<string, GainNode | null>>({
    div1: null,
    div2: null,
    div4: null,
    div8: null,
  });

  const accentColor = '#fbbf24';
  const jacks = usePatchStore((s) => s.jacks);

  useEffect(() => {
    const ctx = engine.ctx;

    // Input gate
    const clockIn = ctx.createGain();
    clockInRef.current = clockIn;

    // Create outputs for each division
    const outputs: Record<string, GainNode> = {};
    [1, 2, 4, 8].forEach((div) => {
      const output = ctx.createGain();
      output.gain.value = 0;
      outputs[`div${div}`] = output;
    });

    setDivisionOutputs(outputs);

    // Gate signal detection
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    clockIn.connect(analyser);

    let divisionCounter = 0;
    let lastGateState = false;
    let rafId: number | null = null;

    const checkClock = () => {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const hasGate = average > 30;

      // Detect rising edge (gate goes high)
      if (hasGate && !lastGateState) {
        divisionCounter++;
        lastGateState = true;

        // Output gates at each division
        [1, 2, 4, 8].forEach((div) => {
          if (divisionCounter % div === 0) {
            // Trigger this division's output
            const output = outputs[`div${div}`];
            if (output) {
              output.gain.setValueAtTime(1, ctx.currentTime);
              output.gain.setValueAtTime(0, ctx.currentTime + 0.01);
            }
          }
        });
      } else if (!hasGate) {
        lastGateState = false;
      }

      rafId = requestAnimationFrame(checkClock);
    };

    rafId = requestAnimationFrame(checkClock);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      Object.values(outputs).forEach((out) => out.disconnect());
      analyser.disconnect();
      clockIn.disconnect();
    };
  }, []);

  return (
    <ModulePanel title="CLOCK" subtitle="Divider" accentColor={accentColor} width={140} badge="UTIL">
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center px-2 py-1 rounded bg-black/50 border border-yellow-900">
            <div className="font-bold text-yellow-400">÷1</div>
            <div className="text-gray-500 text-xs">1x</div>
          </div>
          <div className="text-center px-2 py-1 rounded bg-black/50 border border-yellow-900">
            <div className="font-bold text-yellow-400">÷2</div>
            <div className="text-gray-500 text-xs">½x</div>
          </div>
          <div className="text-center px-2 py-1 rounded bg-black/50 border border-yellow-900">
            <div className="font-bold text-yellow-400">÷4</div>
            <div className="text-gray-500 text-xs">¼x</div>
          </div>
          <div className="text-center px-2 py-1 rounded bg-black/50 border border-yellow-900">
            <div className="font-bold text-yellow-400">÷8</div>
            <div className="text-gray-500 text-xs">⅛x</div>
          </div>
        </div>
      </div>

      <ModuleIOSection
        ports={[
          { id: `${id}_clock_in`, moduleId: id, type: 'input', label: 'CLOCK', audioNode: clockInRef.current ?? undefined },
          { id: `${id}_div1_out`, moduleId: id, type: 'output', label: '÷1', audioNode: divisionOutputs.div1 ?? undefined },
          { id: `${id}_div2_out`, moduleId: id, type: 'output', label: '÷2', audioNode: divisionOutputs.div2 ?? undefined },
          { id: `${id}_div4_out`, moduleId: id, type: 'output', label: '÷4', audioNode: divisionOutputs.div4 ?? undefined },
          { id: `${id}_div8_out`, moduleId: id, type: 'output', label: '÷8', audioNode: divisionOutputs.div8 ?? undefined },
        ]}
        title="I/O"
      />
    </ModulePanel>
  );
}

export default React.memo(ClockDividerModuleComponent);
