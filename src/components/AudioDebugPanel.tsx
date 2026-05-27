import React, { useEffect, useState } from 'react';
import { getAudioEngine } from '../audio/AudioEngine';

export function AudioDebugPanel() {
  const [metrics, setMetrics] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(true); // Always visible by default

  useEffect(() => {
    // Allow hiding via URL param
    const params = new URLSearchParams(window.location.search);
    if (params.get('audio_debug') === 'false') {
      setIsVisible(false);
    }
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      const engine = getAudioEngine();
      setMetrics(engine.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible || !metrics) return null;

  const warningClass = (condition: boolean) => (condition ? 'text-red-400' : 'text-green-400');

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        background: 'rgba(0, 0, 0, 0.95)',
        border: '2px solid #00ff00',
        borderRadius: 4,
        padding: 12,
        zIndex: 50000,
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#00ff00',
        maxWidth: 300,
        boxShadow: '0 0 20px rgba(0,255,0,0.3)',
      }}
    >
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold' }}>🔊 Audio Debug</span>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            background: 'rgba(255, 0, 0, 0.5)',
            border: '1px solid #ff0000',
            color: '#ff0000',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: 2,
            fontSize: 10,
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ borderBottom: '1px solid #00ff0044', marginBottom: 8 }} />

      <div className={warningClass(metrics.state !== 'running')}>
        State: {metrics.state.toUpperCase()}
      </div>

      <div>Sample Rate: {(metrics.sampleRate / 1000).toFixed(1)}kHz</div>

      <div className={warningClass(metrics.baseLatency > 0.05)}>
        Base Latency: {(metrics.baseLatency * 1000).toFixed(2)}ms
      </div>

      <div className={warningClass(metrics.outputLatency > 0.1)}>
        Output Latency: {(metrics.outputLatency * 1000).toFixed(2)}ms
      </div>

      <div>Time: {metrics.currentTime.toFixed(3)}s</div>

      <div style={{ borderTop: '1px solid #00ff0044', marginTop: 8, paddingTop: 8, fontSize: 9, color: '#00aa00' }}>
        💡 Tip: Add ?audio_debug=true to URL to show this panel
      </div>
    </div>
  );
}

export default AudioDebugPanel;
