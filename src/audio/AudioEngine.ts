// Core Web Audio Engine

import { audioDebug } from './AudioDebug';

export class AudioEngine {
  private static instance: AudioEngine;
  public ctx: AudioContext;
  public masterGain: GainNode;
  public masterCompressor: DynamicsCompressorNode;
  private contextStateListener: (() => void) | null = null;

  private constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioDebug.setContext(this.ctx);
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -24;
    this.masterCompressor.knee.value = 30;
    this.masterCompressor.ratio.value = 12;
    this.masterCompressor.attack.value = 0.003;
    this.masterCompressor.release.value = 0.25;
    this.masterGain.connect(this.masterCompressor);
    this.masterCompressor.connect(this.ctx.destination);

    // Monitor context state changes
    this.setupStateListener();
    
    // Log initial state
    audioDebug.logStateChange('unknown', this.ctx.state);
  }

  private setupStateListener() {
    const handleStateChange = () => {
      if (this.contextStateListener) {
        const oldState = this.ctx.state;
        // Slight delay to get new state
        setTimeout(() => {
          audioDebug.logStateChange(oldState, this.ctx.state);
          if (this.ctx.state !== 'running') {
            console.warn('[AudioEngine] Audio context not running:', this.ctx.state);
          }
        }, 10);
      }
    };

    this.ctx.addEventListener('statechange', handleStateChange);
    this.contextStateListener = handleStateChange;
  }

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      audioDebug.logStateChange('suspended', 'resuming...');
      this.ctx.resume().catch((err) => {
        console.error('[AudioEngine] Failed to resume audio context:', err);
      });
    } else if (this.ctx.state === 'running') {
      // Periodic health check
      audioDebug.checkAudioHealth();
    }
  }

  get currentTime() {
    return this.ctx.currentTime;
  }

  /**
   * Get audio metrics for debugging
   */
  getMetrics() {
    return {
      state: this.ctx.state,
      sampleRate: this.ctx.sampleRate,
      currentTime: this.ctx.currentTime,
      baseLatency: this.ctx.baseLatency,
      outputLatency: this.ctx.outputLatency,
    };
  }
}

export function getAudioEngine(): AudioEngine {
  return AudioEngine.getInstance();
}
