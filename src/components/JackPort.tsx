import React, { useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { usePatchStore } from '../store/synthStore';

interface JackPortProps {
  id: string;
  moduleId: string;
  type: 'input' | 'output';
  label: string;
  audioParam?: AudioParam;
  audioNode?: AudioNode;
}

function JackPortComponent({ id, moduleId, type, label, audioParam, audioNode }: JackPortProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastTouchTimeRef = useRef<number>(0);
  const registerJack = usePatchStore((s) => s.registerJack);
  const unregisterJack = usePatchStore((s) => s.unregisterJack);
  const updateJackPosition = usePatchStore((s) => s.updateJackPosition);
  const startDrag = usePatchStore((s) => s.startDrag);
  const completePatch = usePatchStore((s) => s.completePatch);
  const removeJackCables = usePatchStore((s) => s.removeJackCables);
  const cables = usePatchStore((s) => s.cables);
  const draggingFrom = usePatchStore((s) => s.draggingFrom);

  const isConnected = cables.some((c) => c.fromJackId === id || c.toJackId === id);
  const isDraggingFrom = draggingFrom === id;

  const connectedCable = cables.find((c) => c.fromJackId === id || c.toJackId === id);

  useEffect(() => {
    registerJack({ id, moduleId, type, label, audioParam, audioNode });
    return () => unregisterJack(id);
  }, [id, moduleId, type, label, audioNode, audioParam, registerJack, unregisterJack]);

  const updatePos = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    updateJackPosition(id, x, y);
  }, [id, updateJackPosition]);

  // Update position synchronously after DOM paint
  useLayoutEffect(() => {
    updatePos();
  }, [updatePos]);

  // Use ResizeObserver + scroll events only (no continuous RAF polling)
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Initial position update
    updatePos();
    
    // Small delay to catch late layout changes
    const timeoutId = setTimeout(updatePos, 50);
    
    const observer = new ResizeObserver(updatePos);
    observer.observe(element);

    const handleScroll = () => updatePos();
    const handleResize = () => updatePos();
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    // Throttled interval polling instead of continuous RAF (reduces main thread blocking)
    const intervalId = setInterval(updatePos, 100); // Update every 100ms instead of 16ms

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [updatePos]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    usePatchStore.getState().setMousePos(e.clientX, e.clientY);
    if (draggingFrom) {
      completePatch(id);
    } else {
      startDrag(id);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length > 0) {
      const now = Date.now();
      const isDoubleTap = now - lastTouchTimeRef.current < 300;
      lastTouchTimeRef.current = now;

      if (isDoubleTap && isConnected) {
        // Double-tap to remove cable
        removeJackCables(id);
        return;
      }

      usePatchStore.getState().setMousePos(e.touches[0].clientX, e.touches[0].clientY);
      if (draggingFrom) {
        completePatch(id);
      } else {
        startDrag(id);
        
        // Set up touch tracking for this drag
        const handleDragTouchMove = (moveEvent: TouchEvent) => {
          if (moveEvent.touches.length > 0) {
            moveEvent.preventDefault();
            usePatchStore.getState().setMousePos(moveEvent.touches[0].clientX, moveEvent.touches[0].clientY);
          }
        };
        
        const handleDragTouchEnd = () => {
          document.removeEventListener('touchmove', handleDragTouchMove, { passive: false } as EventListenerOptions);
          document.removeEventListener('touchend', handleDragTouchEnd);
          document.removeEventListener('touchcancel', handleDragTouchEnd);
        };
        
        document.addEventListener('touchmove', handleDragTouchMove, { passive: false } as EventListenerOptions);
        document.addEventListener('touchend', handleDragTouchEnd);
        document.addEventListener('touchcancel', handleDragTouchEnd);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (draggingFrom && draggingFrom !== id) {
      completePatch(id);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (draggingFrom && draggingFrom !== id) {
      completePatch(id);
    }
  };

  const typeColor = type === 'output' ? '#f97316' : '#38bdf8';
  const connColor = connectedCable?.color || typeColor;

  return (
    <div className="flex flex-col items-center gap-0.5 select-none" ref={ref}>
      <div
        className="relative flex items-center justify-center rounded-full cursor-pointer transition-all"
        style={{
          width: 20,
          height: 20,
          background: isConnected ? connColor : '#0f0f1e',
          border: `2px solid ${isConnected ? connColor : typeColor}`,
          boxShadow: isDraggingFrom
            ? `0 0 0 3px ${typeColor}66, 0 0 12px ${typeColor}`
            : isConnected
            ? `0 0 6px ${connColor}88`
            : 'inset 0 1px 3px rgba(0,0,0,0.8)',
          transition: 'box-shadow 0.15s, border-color 0.15s',
          touchAction: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Inner ring */}
        <div
          className="rounded-full"
          style={{
            width: 8,
            height: 8,
            background: isConnected ? 'rgba(0,0,0,0.4)' : '#1a1a3e',
            border: `1px solid ${isConnected ? 'rgba(255,255,255,0.3)' : '#333355'}`,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 7,
          color: '#666688',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          textAlign: 'center',
          maxWidth: 36,
          lineHeight: 1.1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default React.memo(JackPortComponent);
