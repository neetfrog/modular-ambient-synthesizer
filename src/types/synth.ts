export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface Jack {
  id: string;
  moduleId: string;
  type: 'output' | 'input';
  label: string;
  audioParam?: AudioParam;
  audioNode?: AudioNode;
  x?: number;
  y?: number;
}

export interface PatchCable {
  id: string;
  fromJackId: string;
  toJackId: string;
  color: string;
}

export interface ModulePosition {
  x: number;
  y: number;
}

export type ModuleType =
  | 'vco'
  | 'lfo'
  | 'vcf'
  | 'vca'
  | 'adsr'
  | 'reverb'
  | 'delay'
  | 'mixer'
  | 'noise'
  | 'scope'
  | 'output';

export interface SynthModule {
  id: string;
  type: ModuleType;
  position: ModulePosition;
  label: string;
}
