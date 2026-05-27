import React from 'react';
import { MODULE_STYLES } from '../constants/moduleStyles';

interface ModuleButtonProps {
  isActive: boolean;
  onClick: () => void;
  label: string;
  accentColor: string;
  title?: string;
  className?: string;
}

/**
 * Reusable button component for module controls (waveform, filter type, etc.)
 * Prevents DRY violations across modules
 */
export const ModuleButton = React.memo(
  ({ isActive, onClick, label, accentColor, title, className }: ModuleButtonProps) => {
    const style = MODULE_STYLES.getButtonStyle(isActive, accentColor);
    return (
      <button
        onClick={onClick}
        title={title}
        className={`flex items-center justify-center rounded text-sm transition-all ${className || ''}`}
        style={{
          ...style,
          height: 24,
          fontSize: 14,
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </button>
    );
  }
);

ModuleButton.displayName = 'ModuleButton';

export default ModuleButton;
