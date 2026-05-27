import React from 'react';
import JackPort from './JackPort';
import { MODULE_STYLES } from '../constants/moduleStyles';

interface IOPort {
  id: string;
  moduleId: string;
  type: 'input' | 'output';
  label: string;
  audioNode?: AudioNode;
  audioParam?: AudioParam;
}

interface ModuleIOSectionProps {
  ports: IOPort[];
  title?: string;
}

/**
 * Reusable I/O section component for modules
 * Reduces code duplication across all module panels
 */
export const ModuleIOSection = React.memo(({ ports, title = 'OUTPUTS / INPUTS' }: ModuleIOSectionProps) => (
  <div className="rounded p-2" style={{ background: MODULE_STYLES.sectionBg, border: MODULE_STYLES.sectionBorder }}>
    <div className="text-center mb-1.5" style={MODULE_STYLES.ioHeaderStyle}>
      {title}
    </div>
    <div className="flex justify-around">
      {ports.map((port) => (
        <JackPort
          key={port.id}
          id={port.id}
          moduleId={port.moduleId}
          type={port.type}
          label={port.label}
          audioNode={port.audioNode}
          audioParam={port.audioParam}
        />
      ))}
    </div>
  </div>
));

ModuleIOSection.displayName = 'ModuleIOSection';
