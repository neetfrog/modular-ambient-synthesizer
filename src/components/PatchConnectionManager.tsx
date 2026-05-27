import React, { useEffect, useRef } from 'react';
import { usePatchStore } from '../store/synthStore';

interface ConnectedCable {
  fromJackId: string;
  toJackId: string;
}

// This component syncs patch cable connections to Web Audio API nodes
function PatchConnectionManagerComponent() {
  const { cables, jacks } = usePatchStore();
  const connectedRef = useRef<Record<string, ConnectedCable>>({});

  const disconnectCable = (id: string, cable: ConnectedCable) => {
    const fromJack = jacks[cable.fromJackId];
    const toJack = jacks[cable.toJackId];
    if (!fromJack?.audioNode) return;
    try {
      if (toJack?.audioParam) {
        fromJack.audioNode.disconnect(toJack.audioParam);
      } else if (toJack?.audioNode) {
        fromJack.audioNode.disconnect(toJack.audioNode);
      }
    } catch {
      // ignore disconnect failures during cleanup
    }
  };

  useEffect(() => {
    const currentCableIds = new Set(cables.map((c) => c.id));

    // Disconnect removed cables
    for (const cableId of Object.keys(connectedRef.current)) {
      if (!currentCableIds.has(cableId)) {
        disconnectCable(cableId, connectedRef.current[cableId]);
        delete connectedRef.current[cableId];
      }
    }

    // Try to connect all active cables
    cables.forEach((cable) => {
      if (connectedRef.current[cable.id]) return;
      const fromJack = jacks[cable.fromJackId];
      const toJack = jacks[cable.toJackId];
      if (!fromJack?.audioNode) return;
      try {
        if (toJack?.audioParam) {
          fromJack.audioNode.connect(toJack.audioParam);
          connectedRef.current[cable.id] = { fromJackId: cable.fromJackId, toJackId: cable.toJackId };
        } else if (toJack?.audioNode) {
          fromJack.audioNode.connect(toJack.audioNode);
          connectedRef.current[cable.id] = { fromJackId: cable.fromJackId, toJackId: cable.toJackId };
        }
      } catch (e) {
        console.warn('Patch connect error:', e);
      }
    });

    return () => {
      for (const cableId of Object.keys(connectedRef.current)) {
        disconnectCable(cableId, connectedRef.current[cableId]);
      }
      connectedRef.current = {};
    };
  }, [cables, jacks]);

  return null;
}
const PatchConnectionManager = React.memo(PatchConnectionManagerComponent);
export default PatchConnectionManager;