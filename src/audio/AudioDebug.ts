// Audio Debug and Performance Monitoring

interface AudioMetrics {
  contextState: AudioContextState;
  sampleRate: number;
  baseLatency: number;
  outputLatency: number;
  cpuUsage: number;
  timestamp: number;
}

class AudioDebugger {
  private static instance: AudioDebugger;
  private ctx: AudioContext | null = null;
  private lastCheck = 0;
  private checkInterval = 2000; // Check every 2 seconds
  private enabled = false;

  private constructor() {
    // Check if debug mode is enabled via URL param or localStorage
    if (typeof window !== 'undefined') {
      this.enabled =
        new URLSearchParams(window.location.search).get('audio_debug') === 'true' ||
        localStorage.getItem('audio_debug') === 'true';
    }
  }

  static getInstance(): AudioDebugger {
    if (!AudioDebugger.instance) {
      AudioDebugger.instance = new AudioDebugger();
    }
    return AudioDebugger.instance;
  }

  setContext(ctx: AudioContext) {
    this.ctx = ctx;
    if (this.enabled) {
      console.log('[AudioDebug] Context initialized', {
        state: ctx.state,
        sampleRate: ctx.sampleRate,
        baseLatency: ctx.baseLatency,
      });
    }
  }

  enable() {
    this.enabled = true;
    localStorage.setItem('audio_debug', 'true');
    console.log('[AudioDebug] Debug mode enabled');
  }

  disable() {
    this.enabled = false;
    localStorage.setItem('audio_debug', 'false');
    console.log('[AudioDebug] Debug mode disabled');
  }

  toggleDebug() {
    this.enabled ? this.disable() : this.enable();
  }

  /**
   * Log audio state and check for issues
   */
  checkAudioHealth(): AudioMetrics | null {
    if (!this.ctx) return null;

    const now = performance.now();
    if (!this.enabled && now - this.lastCheck < this.checkInterval) {
      return null;
    }

    this.lastCheck = now;

    const metrics: AudioMetrics = {
      contextState: this.ctx.state,
      sampleRate: this.ctx.sampleRate,
      baseLatency: this.ctx.baseLatency,
      outputLatency: this.ctx.outputLatency,
      cpuUsage: (this.ctx as any).cpuUsage?.value ?? 0,
      timestamp: this.ctx.currentTime,
    };

    if (this.enabled) {
      console.log('[AudioDebug] Health Check:', {
        state: metrics.contextState,
        sampleRate: `${metrics.sampleRate} Hz`,
        baseLatency: `${(metrics.baseLatency * 1000).toFixed(2)} ms`,
        outputLatency: `${(metrics.outputLatency * 1000).toFixed(2)} ms`,
        cpuUsage: `${(metrics.cpuUsage * 100).toFixed(1)}%`,
      });

      // Warn if state is not running
      if (metrics.contextState !== 'running') {
        console.warn('[AudioDebug] Audio context not running!', metrics.contextState);
      }

      // Warn if CPU usage is high
      if (metrics.cpuUsage > 0.8) {
        console.warn('[AudioDebug] High CPU usage detected:', `${(metrics.cpuUsage * 100).toFixed(1)}%`);
      }

      // Warn if latency is high
      if (metrics.outputLatency > 0.1) {
        console.warn('[AudioDebug] High output latency:', `${(metrics.outputLatency * 1000).toFixed(2)} ms`);
      }
    }

    return metrics;
  }

  /**
   * Log when context state changes
   */
  logStateChange(oldState: AudioContextState, newState: AudioContextState) {
    if (this.enabled) {
      console.log('[AudioDebug] Context state change:', `${oldState} → ${newState}`);
    }
  }

  /**
   * Log audio node creation
   */
  logNodeCreation(type: string, id?: string) {
    if (this.enabled) {
      console.log('[AudioDebug] Created node:', type, id ? `(${id})` : '');
    }
  }

  /**
   * Log audio node destruction
   */
  logNodeDestruction(type: string, id?: string) {
    if (this.enabled) {
      console.log('[AudioDebug] Destroyed node:', type, id ? `(${id})` : '');
    }
  }

  /**
   * Log parameter automation events (throttled)
   */
  private lastParamLog = 0;
  logParamChange(paramName: string, value: number, timeConstant?: number) {
    if (!this.enabled) return;

    const now = performance.now();
    // Only log every 500ms to avoid spam
    if (now - this.lastParamLog > 500) {
      console.log('[AudioDebug] Param change:', paramName, value, timeConstant ? `(τ=${timeConstant}s)` : '');
      this.lastParamLog = now;
    }
  }

  /**
   * Create a debug panel overlay (if needed later)
   */
  createDebugPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'audio-debug-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      font-family: monospace;
      font-size: 11px;
      padding: 15px;
      border: 1px solid #00ff00;
      border-radius: 4px;
      z-index: 10000;
      max-width: 300px;
      max-height: 300px;
      overflow: auto;
    `;
    return panel;
  }
}

export const audioDebug = AudioDebugger.getInstance();

// Make available globally for console debugging
if (typeof window !== 'undefined') {
  (window as any).audioDebug = audioDebug;
}
