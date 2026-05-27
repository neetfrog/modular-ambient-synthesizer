import React, { useEffect, useRef } from 'react';
import { usePatchStore } from '../store/synthStore';

interface ConnectedCable {
  fromJackId: string;
  toJackId: string;
}

// This component syncs patch cable connections to Web Audio API nodes
function PatchConnectionManagerComponent() {
  const cables = usePatchStore((s) => s.cables);
  const jacks = usePatchStore((s) => s.jacks);
  const connectedRef = useRef<Record<string, ConnectedCable>>({});

  // Helper to get audio target (audioParam or audioNode)
  const getAudioTarget = (jackId: string) => {
    const j = jacks[jackId];
    return j?.audioParam || j?.audioNode || null;
  };

  // Unified connect/disconnect helper
  const syncCable = (fromJackId: string, toJackId: string, connect: boolean) => {
    const fromJack = jacks[fromJackId];
    const target = getAudioTarget(toJackId);
    if (!fromJack?.audioNode || !target) return;
    
    try {
      if (connect) {
        fromJack.audioNode.connect(target);
      } else {
        fromJack.audioNode.disconnect(target);
      }
    } catch {
      // ignore connect/disconnect failures
    }
  };

  useEffect(() => {
    const currentCableIds = new Set(cables.map((c) => c.id));

    // Disconnect removed cables
    for (const cableId of Object.keys(connectedRef.current)) {
      if (!currentCableIds.has(cableId)) {
        const cable = connectedRef.current[cableId];
        syncCable(cable.fromJackId, cable.toJackId, false);
        delete connectedRef.current[cableId];
      }
    }

    // Connect new cables
    for (const cable of cables) {
      if (!connectedRef.current[cable.id]) {
        const fromJack = jacks[cable.fromJackId];
        const toJack = jacks[cable.toJackId];
        
        // Only connect if both jacks are registered and have audio nodes
        if (fromJack?.audioNode && toJack?.audioNode) {
          syncCable(cable.fromJackId, cable.toJackId, true);
          connectedRef.current[cable.id] = { fromJackId: cable.fromJackId, toJackId: cable.toJackId };
        }
      }
    }

    return () => {
      for (const cableId of Object.keys(connectedRef.current)) {
        const cable = connectedRef.current[cableId];
        syncCable(cable.fromJackId, cable.toJackId, false);
      }
      connectedRef.current = {};
    };
  }, [cables, jacks]);

  return null;
}
const PatchConnectionManager = React.memo(PatchConnectionManagerComponent);
export default PatchConnectionManager;