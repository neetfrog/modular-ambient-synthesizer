import { useState, useRef, useEffect, useCallback } from 'react';
import { usePatchStore } from './store/synthStore';
import PatchBay from './components/PatchBay';
import PatchConnectionManager from './components/PatchConnectionManager';
import VCOModule from './modules/VCOModule';
import LFOModule from './modules/LFOModule';
import VCFModule from './modules/VCFModule';
import VCAModule from './modules/VCAModule';
import ADSRModule from './modules/ADSRModule';
import ReverbModule from './modules/ReverbModule';
import DelayModule from './modules/DelayModule';
import NoiseModule from './modules/NoiseModule';
import MixerModule from './modules/MixerModule';
import OscilloscopeModule from './modules/OscilloscopeModule';
import OutputModule from './modules/OutputModule';
import SequencerModule from './modules/SequencerModule';
import { getAudioEngine } from './audio/AudioEngine';

interface ModuleInstance {
  id: string;
  type: string;
  x: number;
  y: number;
}

const DEFAULT_MODULES: ModuleInstance[] = [
  { id: 'output1', type: 'output', x: 24, y: 24 },
];

interface PresetModule {
  id: string;
  type: string;
  x: number;
  y: number;
}

interface Preset {
  name: string;
  description: string;
  emoji: string;
  modules: PresetModule[];
  cables: { id: string; fromJackId: string; toJackId: string; color: string }[];
}

const PRESETS: Preset[] = [
  {
    name: 'ADSR TEST 1',
    description: 'Simplest: VCO → ADSR → Output (manual gate trigger)',
    emoji: '?',
    modules: [
      { id: 'vco1', type: 'vco1', x: 24, y: 24 },
      { id: 'adsr1', type: 'adsr', x: 260, y: 24 },
      { id: 'output1', type: 'output', x: 500, y: 24 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'vco1_out', toJackId: 'adsr1_gate_in', color: '#ff9500' },
      { id: 'c2', fromJackId: 'adsr1_env_out', toJackId: 'output1_l_in', color: '#a78bfa' },
      { id: 'c3', fromJackId: 'adsr1_env_out', toJackId: 'output1_r_in', color: '#a78bfa' },
    ],
  },
  {
    name: 'ADSR TEST 2',
    description: 'VCO → VCA + ADSR CV → Output',
    emoji: '?',
    modules: [
      { id: 'vco1', type: 'vco1', x: 24, y: 24 },
      { id: 'adsr1', type: 'adsr', x: 260, y: 24 },
      { id: 'vca1', type: 'vca', x: 500, y: 24 },
      { id: 'output1', type: 'output', x: 24, y: 320 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'vco1_out', toJackId: 'vca1_in', color: '#ff9500' },
      { id: 'c2', fromJackId: 'adsr1_env_out', toJackId: 'vca1_cv_in', color: '#a78bfa' },
      { id: 'c3', fromJackId: 'vca1_out', toJackId: 'output1_l_in', color: '#f472b6' },
      { id: 'c4', fromJackId: 'vca1_out', toJackId: 'output1_r_in', color: '#f472b6' },
    ],
  },
  {
    name: 'ADSR TEST 3',
    description: 'Noise → ADSR → Output (test with different source)',
    emoji: '?',
    modules: [
      { id: 'noise1', type: 'noise', x: 24, y: 24 },
      { id: 'adsr1', type: 'adsr', x: 260, y: 24 },
      { id: 'output1', type: 'output', x: 500, y: 24 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'noise1_out', toJackId: 'adsr1_gate_in', color: '#e2e8f0' },
      { id: 'c2', fromJackId: 'adsr1_env_out', toJackId: 'output1_l_in', color: '#a78bfa' },
      { id: 'c3', fromJackId: 'adsr1_env_out', toJackId: 'output1_r_in', color: '#a78bfa' },
    ],
  },
  {
    name: 'EMPTY',
    description: 'Start from scratch with just output',
    emoji: '○',
    modules: [
      { id: 'output1', type: 'output', x: 24, y: 24 },
    ],
    cables: [],
  },
  {
    name: 'BASIC OSC',
    description: 'Simple oscillator into output',
    emoji: '∿',
    modules: [
      { id: 'vco1', type: 'vco1', x: 24, y: 24 },
      { id: 'output1', type: 'output', x: 260, y: 24 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'vco1_out', toJackId: 'output1_l_in', color: '#ff9500' },
      { id: 'c2', fromJackId: 'vco1_out', toJackId: 'output1_r_in', color: '#ff9500' },
    ],
  },
  {
    name: 'FILTERED',
    description: 'Oscillator through filter into output',
    emoji: '⊞',
    modules: [
      { id: 'vco1', type: 'vco1', x: 24, y: 24 },
      { id: 'vcf1', type: 'vcf', x: 260, y: 24 },
      { id: 'output1', type: 'output', x: 500, y: 24 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'vco1_out', toJackId: 'vcf1_in', color: '#ff9500' },
      { id: 'c2', fromJackId: 'vcf1_out', toJackId: 'output1_l_in', color: '#4ade80' },
      { id: 'c3', fromJackId: 'vcf1_out', toJackId: 'output1_r_in', color: '#4ade80' },
    ],
  },
  {
    name: 'MODULATED',
    description: 'LFO sweeps filter cutoff on filtered oscillator',
    emoji: '◈',
    modules: [
      { id: 'vco1', type: 'vco1', x: 24, y: 24 },
      { id: 'lfo1', type: 'lfo', x: 260, y: 24 },
      { id: 'vcf1', type: 'vcf', x: 500, y: 24 },
      { id: 'output1', type: 'output', x: 24, y: 320 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'vco1_out', toJackId: 'vcf1_in', color: '#ff9500' },
      { id: 'c2', fromJackId: 'lfo1_out', toJackId: 'vcf1_cv_in', color: '#38bdf8' },
      { id: 'c3', fromJackId: 'vcf1_out', toJackId: 'output1_l_in', color: '#4ade80' },
      { id: 'c4', fromJackId: 'vcf1_out', toJackId: 'output1_r_in', color: '#4ade80' },
    ],
  },
  {
    name: 'FILTERED + VERB',
    description: 'Filtered oscillator with reverb space',
    emoji: '⊞☁',
    modules: [
      { id: 'vco1', type: 'vco1', x: 24, y: 24 },
      { id: 'vcf1', type: 'vcf', x: 260, y: 24 },
      { id: 'reverb1', type: 'reverb', x: 500, y: 24 },
      { id: 'output1', type: 'output', x: 24, y: 320 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'vco1_out', toJackId: 'vcf1_in', color: '#ff9500' },
      { id: 'c2', fromJackId: 'vcf1_out', toJackId: 'reverb1_in', color: '#4ade80' },
      { id: 'c3', fromJackId: 'reverb1_dry_out', toJackId: 'output1_l_in', color: '#34d399' },
      { id: 'c4', fromJackId: 'reverb1_wet_out', toJackId: 'output1_r_in', color: '#a78bfa' },
    ],
  },
  {
    name: 'MODULATED + VERB',
    description: 'LFO-modulated filter with reverb tail',
    emoji: '◈☁',
    modules: [
      { id: 'vco1', type: 'vco1', x: 24, y: 24 },
      { id: 'lfo1', type: 'lfo', x: 260, y: 24 },
      { id: 'vcf1', type: 'vcf', x: 500, y: 24 },
      { id: 'reverb1', type: 'reverb', x: 24, y: 320 },
      { id: 'output1', type: 'output', x: 260, y: 320 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'vco1_out', toJackId: 'vcf1_in', color: '#ff9500' },
      { id: 'c2', fromJackId: 'lfo1_out', toJackId: 'vcf1_cv_in', color: '#38bdf8' },
      { id: 'c3', fromJackId: 'vcf1_out', toJackId: 'reverb1_in', color: '#4ade80' },
      { id: 'c4', fromJackId: 'reverb1_dry_out', toJackId: 'output1_l_in', color: '#34d399' },
      { id: 'c5', fromJackId: 'reverb1_wet_out', toJackId: 'output1_r_in', color: '#a78bfa' },
    ],
  },
  {
    name: 'NOISE BASIC',
    description: 'Noise source into output',
    emoji: '⋈',
    modules: [
      { id: 'noise1', type: 'noise', x: 24, y: 24 },
      { id: 'output1', type: 'output', x: 260, y: 24 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'noise1_out', toJackId: 'output1_l_in', color: '#e2e8f0' },
      { id: 'c2', fromJackId: 'noise1_out', toJackId: 'output1_r_in', color: '#e2e8f0' },
    ],
  },
  {
    name: 'NOISE FILTERED',
    description: 'Noise through filter',
    emoji: '⋈⊞',
    modules: [
      { id: 'noise1', type: 'noise', x: 24, y: 24 },
      { id: 'vcf1', type: 'vcf', x: 260, y: 24 },
      { id: 'output1', type: 'output', x: 500, y: 24 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'noise1_out', toJackId: 'vcf1_in', color: '#e2e8f0' },
      { id: 'c2', fromJackId: 'vcf1_out', toJackId: 'output1_l_in', color: '#4ade80' },
      { id: 'c3', fromJackId: 'vcf1_out', toJackId: 'output1_r_in', color: '#4ade80' },
    ],
  },
  {
    name: 'NOISE MODULATED',
    description: 'Noise with LFO-swept filter',
    emoji: '⋈◈',
    modules: [
      { id: 'noise1', type: 'noise', x: 24, y: 24 },
      { id: 'lfo1', type: 'lfo', x: 260, y: 24 },
      { id: 'vcf1', type: 'vcf', x: 500, y: 24 },
      { id: 'output1', type: 'output', x: 24, y: 320 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'noise1_out', toJackId: 'vcf1_in', color: '#e2e8f0' },
      { id: 'c2', fromJackId: 'lfo1_out', toJackId: 'vcf1_cv_in', color: '#38bdf8' },
      { id: 'c3', fromJackId: 'vcf1_out', toJackId: 'output1_l_in', color: '#4ade80' },
      { id: 'c4', fromJackId: 'vcf1_out', toJackId: 'output1_r_in', color: '#4ade80' },
    ],
  },
  {
    name: 'DUAL OSC',
    description: 'Two oscillators blended together',
    emoji: '∿∿',
    modules: [
      { id: 'vco1', type: 'vco1', x: 24, y: 24 },
      { id: 'vco2', type: 'vco2', x: 260, y: 24 },
      { id: 'mixer1', type: 'mixer', x: 500, y: 24 },
      { id: 'output1', type: 'output', x: 24, y: 320 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'vco1_out', toJackId: 'mixer1_ch1_in', color: '#ff9500' },
      { id: 'c2', fromJackId: 'vco2_out', toJackId: 'mixer1_ch2_in', color: '#fb923c' },
      { id: 'c3', fromJackId: 'mixer1_out', toJackId: 'output1_l_in', color: '#fbbf24' },
      { id: 'c4', fromJackId: 'mixer1_out', toJackId: 'output1_r_in', color: '#fbbf24' },
    ],
  },
  {
    name: 'OSC + DELAY',
    description: 'Oscillator with echo repeats',
    emoji: '∿♪',
    modules: [
      { id: 'vco1', type: 'vco1', x: 24, y: 24 },
      { id: 'delay1', type: 'delay', x: 260, y: 24 },
      { id: 'output1', type: 'output', x: 500, y: 24 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'vco1_out', toJackId: 'delay1_in', color: '#ff9500' },
      { id: 'c2', fromJackId: 'delay1_dry_out', toJackId: 'output1_l_in', color: '#fb923c' },
      { id: 'c3', fromJackId: 'delay1_wet_out', toJackId: 'output1_r_in', color: '#fb923c' },
    ],
  },
  {
    name: 'FILTERED + DELAY',
    description: 'Filtered oscillator with echo repeats',
    emoji: '⊞♪',
    modules: [
      { id: 'vco1', type: 'vco1', x: 24, y: 24 },
      { id: 'vcf1', type: 'vcf', x: 260, y: 24 },
      { id: 'delay1', type: 'delay', x: 500, y: 24 },
      { id: 'output1', type: 'output', x: 24, y: 320 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'vco1_out', toJackId: 'vcf1_in', color: '#ff9500' },
      { id: 'c2', fromJackId: 'vcf1_out', toJackId: 'delay1_in', color: '#4ade80' },
      { id: 'c3', fromJackId: 'delay1_dry_out', toJackId: 'output1_l_in', color: '#fb923c' },
      { id: 'c4', fromJackId: 'delay1_wet_out', toJackId: 'output1_r_in', color: '#fb923c' },
    ],
  },
  {
    name: 'ENVELOPE SHAPER',
    description: 'Filtered oscillator shaped by ADSR envelope',
    emoji: '⊞︿',
    modules: [
      { id: 'vco1', type: 'vco1', x: 24, y: 24 },
      { id: 'vcf1', type: 'vcf', x: 260, y: 24 },
      { id: 'adsr1', type: 'adsr', x: 500, y: 24 },
      { id: 'vca1', type: 'vca', x: 24, y: 320 },
      { id: 'output1', type: 'output', x: 260, y: 320 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'vco1_out', toJackId: 'vcf1_in', color: '#ff9500' },
      { id: 'c2', fromJackId: 'vcf1_out', toJackId: 'vca1_in', color: '#4ade80' },
      { id: 'c3', fromJackId: 'adsr1_env_out', toJackId: 'vca1_cv_in', color: '#a78bfa' },
      { id: 'c4', fromJackId: 'vca1_out', toJackId: 'output1_l_in', color: '#f472b6' },
      { id: 'c5', fromJackId: 'vca1_out', toJackId: 'output1_r_in', color: '#f472b6' },
    ],
  },
  {
    name: 'SEQ + ADSR',
    description: 'Sequencer triggers ADSR-shaped notes (try clicking sequencer steps)',
    emoji: '⊏︿',
    modules: [
      { id: 'seq1', type: 'seq', x: 24, y: 24 },
      { id: 'vco1', type: 'vco1', x: 260, y: 24 },
      { id: 'adsr1', type: 'adsr', x: 500, y: 24 },
      { id: 'vcf1', type: 'vcf', x: 24, y: 320 },
      { id: 'vca1', type: 'vca', x: 260, y: 320 },
      { id: 'output1', type: 'output', x: 500, y: 320 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'seq1_cv_out', toJackId: 'vco1_fm_in', color: '#ff4d6d' },
      { id: 'c2', fromJackId: 'seq1_gate_out', toJackId: 'adsr1_gate_in', color: '#fbbf24' },
      { id: 'c3', fromJackId: 'vco1_out', toJackId: 'vcf1_in', color: '#ff9500' },
      { id: 'c4', fromJackId: 'vcf1_out', toJackId: 'vca1_in', color: '#4ade80' },
      { id: 'c5', fromJackId: 'adsr1_env_out', toJackId: 'vca1_cv_in', color: '#a78bfa' },
      { id: 'c6', fromJackId: 'vca1_out', toJackId: 'output1_l_in', color: '#f472b6' },
      { id: 'c7', fromJackId: 'vca1_out', toJackId: 'output1_r_in', color: '#f472b6' },
    ],
  },
  {
    name: 'PLUCK',
    description: 'Plucked string: VCO shaped by ADSR envelope for percussive decay',
    emoji: '↗︿',
    modules: [
      { id: 'vco1', type: 'vco1', x: 24, y: 24 },
      { id: 'adsr1', type: 'adsr', x: 260, y: 24 },
      { id: 'vca1', type: 'vca', x: 500, y: 24 },
      { id: 'output1', type: 'output', x: 24, y: 320 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'vco1_out', toJackId: 'adsr1_gate_in', color: '#ff9500' },
      { id: 'c2', fromJackId: 'vco1_out', toJackId: 'vca1_in', color: '#ff9500' },
      { id: 'c3', fromJackId: 'adsr1_env_out', toJackId: 'vca1_cv_in', color: '#a78bfa' },
      { id: 'c4', fromJackId: 'vca1_out', toJackId: 'output1_l_in', color: '#f472b6' },
      { id: 'c5', fromJackId: 'vca1_out', toJackId: 'output1_r_in', color: '#f472b6' },
    ],
  },
  {
    name: 'NOISE PUNCH',
    description: 'Noise burst shaped by snappy ADSR (kick/punch sound)',
    emoji: '⋈↘',
    modules: [
      { id: 'noise1', type: 'noise', x: 24, y: 24 },
      { id: 'adsr1', type: 'adsr', x: 260, y: 24 },
      { id: 'vca1', type: 'vca', x: 500, y: 24 },
      { id: 'output1', type: 'output', x: 24, y: 320 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'noise1_out', toJackId: 'adsr1_gate_in', color: '#e2e8f0' },
      { id: 'c2', fromJackId: 'noise1_out', toJackId: 'vca1_in', color: '#e2e8f0' },
      { id: 'c3', fromJackId: 'adsr1_env_out', toJackId: 'vca1_cv_in', color: '#a78bfa' },
      { id: 'c4', fromJackId: 'vca1_out', toJackId: 'output1_l_in', color: '#f472b6' },
      { id: 'c5', fromJackId: 'vca1_out', toJackId: 'output1_r_in', color: '#f472b6' },
    ],
  },
  {
    name: 'FILTER SWEEP',
    description: 'ADSR sweeps filter cutoff for dynamic tone shaping',
    emoji: '∿⊞︿',
    modules: [
      { id: 'vco1', type: 'vco1', x: 24, y: 24 },
      { id: 'vcf1', type: 'vcf', x: 260, y: 24 },
      { id: 'adsr1', type: 'adsr', x: 500, y: 24 },
      { id: 'output1', type: 'output', x: 24, y: 320 },
    ],
    cables: [
      { id: 'c1', fromJackId: 'vco1_out', toJackId: 'adsr1_gate_in', color: '#ff9500' },
      { id: 'c2', fromJackId: 'vco1_out', toJackId: 'vcf1_in', color: '#ff9500' },
      { id: 'c3', fromJackId: 'adsr1_env_out', toJackId: 'vcf1_cv_in', color: '#a78bfa' },
      { id: 'c4', fromJackId: 'vcf1_out', toJackId: 'output1_l_in', color: '#4ade80' },
      { id: 'c5', fromJackId: 'vcf1_out', toJackId: 'output1_r_in', color: '#4ade80' },
    ],
  },
];

function renderModule(mod: ModuleInstance) {
  switch (mod.type) {
    case 'vco1': return <VCOModule id={mod.id} label="VCO-1" accentColor="#f97316" />;
    case 'vco2': return <VCOModule id={mod.id} label="VCO-2" accentColor="#fb923c" />;
    case 'noise': return <NoiseModule id={mod.id} />;
    case 'lfo': return <LFOModule id={mod.id} />;
    case 'adsr': return <ADSRModule id={mod.id} />;
    case 'vcf': return <VCFModule id={mod.id} />;
    case 'vca': return <VCAModule id={mod.id} />;
    case 'mixer': return <MixerModule id={mod.id} />;
    case 'delay': return <DelayModule id={mod.id} />;
    case 'reverb': return <ReverbModule id={mod.id} />;
    case 'scope': return <OscilloscopeModule id={mod.id} />;
    case 'output': return <OutputModule id={mod.id} />;
    case 'seq': return <SequencerModule id={mod.id} />;
    default: return null;
  }
}

const ADD_OPTIONS = [
  { type: 'vco1', label: 'VCO Oscillator', color: '#f97316' },
  { type: 'lfo', label: 'LFO Modulator', color: '#38bdf8' },
  { type: 'vcf', label: 'VCF Filter', color: '#4ade80' },
  { type: 'vca', label: 'VCA Amplifier', color: '#f472b6' },
  { type: 'adsr', label: 'ADSR Envelope', color: '#a78bfa' },
  { type: 'reverb', label: 'Reverb FX', color: '#34d399' },
  { type: 'delay', label: 'Delay FX', color: '#fb923c' },
  { type: 'noise', label: 'Noise Source', color: '#e2e8f0' },
  { type: 'mixer', label: 'Mixer', color: '#60a5fa' },
  { type: 'scope', label: 'Oscilloscope', color: '#a78bfa' },
  { type: 'output', label: 'Output', color: '#f43f5e' },
  { type: 'seq', label: 'Step Sequencer', color: '#fbbf24' },
];

export default function App() {
  const [modules, setModules] = useState<ModuleInstance[]>(DEFAULT_MODULES);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [activePreset, setActivePreset] = useState('EMPTY');
  const [started, setStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { cancelDrag, draggingFrom, cables } = usePatchStore();
  const resetCables = usePatchStore((s) => s.resetCables);
  const setCables = usePatchStore((s) => s.setCables);

  const handleStartClick = () => {
    getAudioEngine().resume();
    setStarted(true);
  };

  const handleModuleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    if ((e.target as HTMLElement).closest('[data-nondrag]')) return;
    e.preventDefault();
    const mod = modules.find((m) => m.id === id);
    if (!mod) return;
    setDragging({ id, startX: e.clientX, startY: e.clientY, origX: mod.x, origY: mod.y });
  }, [modules]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;
      setModules((prev) =>
        prev.map((m) =>
          m.id === dragging.id
            ? { ...m, x: Math.max(0, dragging.origX + dx), y: Math.max(0, dragging.origY + dy) }
            : m
        )
      );
    };
    const handleUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  const addModule = (type: string) => {
    const id = `${type}_${Date.now()}`;
    const scrollX = containerRef.current?.scrollLeft || 0;
    const scrollY = containerRef.current?.scrollTop || 0;
    setModules((prev) => [...prev, { id, type, x: 100 + scrollX, y: 100 + scrollY }]);
    setShowAddMenu(false);
  };

  const removeModule = (id: string) => {
    setModules((prev) => prev.filter((m) => m.id !== id));
    usePatchStore.getState().removeJackCables(id);
  };

  const loadPreset = (presetName: string) => {
    const preset = PRESETS.find((item) => item.name === presetName);
    if (!preset) return;
    setModules(preset.modules);
    resetCables();
    setCables(preset.cables);
    setShowAddMenu(false);
    setShowPresetMenu(false);
    setActivePreset(preset.name);
  };

  const handleCanvasClick = () => {
    if (draggingFrom) cancelDrag();
    setShowAddMenu(false);
    setShowPresetMenu(false);
  };

  // Canvas size
  const canvasW = Math.max(1200, ...modules.map((m) => m.x + 250));
  const canvasH = Math.max(900, ...modules.map((m) => m.y + 350));

  if (!started) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, #12123a 0%, #0a0a18 60%, #050510 100%)',
        }}
      >
        {/* Starfield */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 80 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: Math.random() * 2 + 0.5,
                height: Math.random() * 2 + 0.5,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                background: 'white',
                opacity: Math.random() * 0.6 + 0.1,
                animation: `twinkle ${2 + Math.random() * 4}s ease-in-out ${Math.random() * 4}s infinite`,
              }}
            />
          ))}
        </div>

        <div className="text-center relative z-10">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center">
            <div
              className="text-8xl font-black tracking-widest mb-2"
              style={{
                fontFamily: 'monospace',
                background: 'linear-gradient(135deg, #f97316, #a78bfa, #38bdf8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: 'none',
                filter: 'drop-shadow(0 0 40px rgba(167,139,250,0.4))',
              }}
            >
              SYNTHEX
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                letterSpacing: '0.4em',
                color: '#555577',
                textTransform: 'uppercase',
              }}
            >
              Modular Ambient Synthesizer
            </div>
          </div>

          {/* Features */}
          <div className="flex gap-4 mb-10 justify-center flex-wrap">
            {[
              { icon: '🎛️', label: 'Modular Patches' },
              { icon: '🔊', label: 'Real Audio Engine' },
              { icon: '🌊', label: 'Ambient Soundscapes' },
              { icon: '⚡', label: 'Live Modulation' },
            ].map(({ icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span className="text-2xl">{icon}</span>
                <span style={{ fontSize: 9, color: '#666688', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Start button */}
          <button
            onClick={handleStartClick}
            className="relative overflow-hidden rounded-xl px-16 py-5 text-sm font-bold transition-all"
            style={{
              fontFamily: 'monospace',
              letterSpacing: '0.2em',
              background: 'linear-gradient(135deg, #f97316, #a78bfa)',
              color: 'white',
              border: 'none',
              boxShadow: '0 0 40px rgba(167,139,250,0.4), 0 0 80px rgba(249,115,22,0.2)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ▶ INITIALIZE SYNTH
          </button>

          <div className="mt-4" style={{ fontSize: 9, color: '#333355', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
            DRAG WIRES BETWEEN JACKS TO PATCH • DOUBLE-CLICK CABLE TO REMOVE • SHIFT+DRAG KNOB FOR FINE TUNE
          </div>
        </div>

        <style>{`
          @keyframes twinkle {
            0%, 100% { opacity: 0.1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.5); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: '#050510', overflow: 'hidden' }}
    >
      {/* Header */}
      <div
        className="flex-none flex flex-col max-sm:flex-row max-sm:flex-wrap items-center justify-between px-6 max-sm:px-3 py-2 gap-2 max-sm:gap-1"
        style={{
          background: 'linear-gradient(180deg, #0d0d20 0%, #08081a 100%)',
          borderBottom: '1px solid #1a1a30',
          zIndex: 100,
        }}
      >
        <div className="flex items-center gap-4 max-sm:gap-2 min-w-0">
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 18,
              maxWidth: '200px',
              fontWeight: 900,
              letterSpacing: '0.15em',
              background: 'linear-gradient(90deg, #f97316, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
            className="max-sm:text-sm"
          >
            SYNTHEX
          </div>
          <div
            style={{
              fontSize: 8,
              color: '#333355',
              fontFamily: 'monospace',
              letterSpacing: '0.15em',
              paddingTop: 2,
            }}
            className="max-sm:hidden"
          >
            MODULAR AMBIENT SYNTHESIZER
          </div>
        </div>

        <div className="flex items-center gap-3 max-sm:gap-1 max-sm:text-xs flex-wrap max-sm:justify-end max-sm:w-full">
          {/* Cable count */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 max-sm:px-2 max-sm:py-0.5 rounded"
            style={{
              background: '#0a0a18',
              border: '1px solid #1a1a30',
              fontSize: 9,
              color: '#555577',
              fontFamily: 'monospace',
            }}
          >
            <div
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                background: cables.length > 0 ? '#4ade80' : '#333355',
                boxShadow: cables.length > 0 ? '0 0 6px #4ade80' : 'none',
              }}
            />
            <span className="max-sm:hidden">{cables.length} CABLES PATCHED</span>
            <span className="sm:hidden">{cables.length}</span>
          </div>

          {/* Help - hidden on mobile */}
          <div
            className="max-sm:hidden px-3 py-1 rounded"
            style={{
              background: '#0a0a18',
              border: '1px solid #1a1a30',
              fontSize: 9,
              color: '#444466',
              fontFamily: 'monospace',
              letterSpacing: '0.08em',
            }}
          >
            CLICK JACK → CLICK JACK TO PATCH • DBL-CLICK CABLE TO REMOVE
          </div>

          {/* Preset menu button */}
          <div className="relative">
            <button
              onClick={() => setShowPresetMenu((v) => !v)}
              className="flex items-center gap-2 px-4 max-sm:px-2 py-1.5 max-sm:py-0.5 rounded transition-all text-sm max-sm:text-xs"
              style={{
                fontFamily: 'monospace',
                fontSize: 10,
                letterSpacing: '0.1em',
                background: showPresetMenu ? '#38bdf822' : '#0a0a18',
                border: `1px solid ${showPresetMenu ? '#38bdf8' : '#2a2a4a'}`,
                color: showPresetMenu ? '#38bdf8' : '#666688',
                cursor: 'pointer',
              }}
            >
              PRESETS
            </button>
            {showPresetMenu && (
              <div
                className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden"
                style={{
                  background: '#0d0d20',
                  border: '1px solid #2a2a4a',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  zIndex: 200,
                  minWidth: 220,
                  maxHeight: '60vh',
                  overflowY: 'auto',
                }}
              >
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => loadPreset(preset.name)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 10,
                      color: activePreset === preset.name ? '#ffffff' : '#888899',
                      background: activePreset === preset.name ? '#1e1b3b' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderBottom: '1px solid #1a1a28',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a30')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = activePreset === preset.name ? '#1e1b3b' : 'transparent')}
                  >
                    <span style={{ fontSize: 14 }}>{preset.emoji}</span>
                    <div>
                      <div>{preset.name}</div>
                      <div style={{ fontSize: 8, color: '#555577', letterSpacing: '0.08em' }}>{preset.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add module button */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu((v) => !v)}
              className="flex items-center gap-2 px-4 max-sm:px-2 py-1.5 max-sm:py-0.5 rounded transition-all text-sm max-sm:text-xs"
              style={{
                fontFamily: 'monospace',
                fontSize: 10,
                letterSpacing: '0.1em',
                background: showAddMenu ? '#a78bfa22' : '#0a0a18',
                border: `1px solid ${showAddMenu ? '#a78bfa' : '#2a2a4a'}`,
                color: showAddMenu ? '#a78bfa' : '#666688',
                cursor: 'pointer',
              }}
            >
              <span className="max-sm:hidden">+ ADD MODULE</span>
              <span className="sm:hidden">+</span>
            </button>
            {showAddMenu && (
              <div
                className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden"
                style={{
                  background: '#0d0d20',
                  border: '1px solid #2a2a4a',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  zIndex: 200,
                  minWidth: 180,
                  maxHeight: '60vh',
                  overflowY: 'auto',
                }}
              >
                {ADD_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => addModule(opt.type)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left transition-all"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 10,
                      color: '#888899',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderBottom: '1px solid #1a1a28',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a30')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="rounded-full" style={{ width: 8, height: 8, background: opt.color, boxShadow: `0 0 4px ${opt.color}` }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative"
        style={{ background: 'transparent' }}
        onClick={handleCanvasClick}
      >
        {/* Background grid - hidden on mobile */}
        <div
          className="absolute inset-0 pointer-events-none max-sm:hidden"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px),
              linear-gradient(rgba(255,255,255,0.005) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.005) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
            minWidth: canvasW,
            minHeight: canvasH,
          }}
        />

        {/* Radial glow - hidden on mobile */}
        <div
          className="absolute pointer-events-none max-sm:hidden"
          style={{
            width: '80vw',
            height: '80vh',
            left: '10%',
            top: '5%',
            background: 'radial-gradient(ellipse, rgba(167,139,250,0.04) 0%, transparent 70%)',
            minWidth: canvasW,
            minHeight: canvasH,
          }}
        />

        {/* Modules */}
        <div 
          className="synth-modules-container"
          style={{ position: 'relative', minWidth: canvasW, minHeight: canvasH }}>
          {modules.map((mod) => (
            <div
              key={mod.id}
              className="synth-module-wrapper"
              style={{
                position: 'absolute',
                left: mod.x,
                top: mod.y,
                zIndex: dragging?.id === mod.id ? 50 : 10,
                filter: dragging?.id === mod.id ? 'drop-shadow(0 8px 24px rgba(0,0,0,0.8))' : undefined,
              }}
            >
              {/* Drag handle */}
              <div
                className="flex items-center justify-between px-2 mb-0.5 rounded-t cursor-move"
                style={{
                  background: '#0a0a18',
                  border: '1px solid #1a1a30',
                  borderBottom: 'none',
                  height: 18,
                }}
                onMouseDown={(e) => handleModuleMouseDown(e, mod.id)}
              >
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-full" style={{ width: 4, height: 4, background: '#222244' }} />
                  ))}
                </div>
                <div style={{ fontSize: 7, color: '#333355', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                  ⠿⠿⠿
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeModule(mod.id); }}
                  className="transition-all"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 9,
                    color: '#333355',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    lineHeight: 1,
                    padding: '0 2px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#333355')}
                  data-nondrag="true"
                >
                  ✕
                </button>
              </div>

              {/* Module content */}
              <div data-nondrag="true" onMouseDown={(e) => e.stopPropagation()}>
                {renderModule(mod)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Patch cables SVG overlay */}
      <PatchBay />
      <PatchConnectionManager />

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a18; }
        ::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #3a3a5a; }
        input[type=range] { -webkit-appearance: none; appearance: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; }
        button { outline: none; }
        
        @media (max-width: 640px) {
          .synth-modules-container {
            display: flex !important;
            flex-direction: column;
            gap: 12px;
            padding: 12px;
            width: 100% !important;
            min-width: 100% !important;
            min-height: auto !important;
            position: static !important;
          }
          
          .synth-module-wrapper {
            position: static !important;
            left: auto !important;
            top: auto !important;
            z-index: 10 !important;
            width: 100% !important;
            max-width: calc(100vw - 24px) !important;
          }
        }
      `}</style>
    </div>
  );
}
