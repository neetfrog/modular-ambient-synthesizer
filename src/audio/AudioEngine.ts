// Core Web Audio Engine

export class AudioEngine {
  private static instance: AudioEngine;
  public ctx: AudioContext;
  public masterGain: GainNode;
  public masterCompressor: DynamicsCompressorNode;

  private constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  }

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  get currentTime() {
    return this.ctx.currentTime;
  }
}

export function getAudioEngine(): AudioEngine {
  return AudioEngine.getInstance();
}
