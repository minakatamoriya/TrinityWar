import { useEffect, useRef } from 'react';
import type {
  BattleCanvasPlaybackSnapshot,
  BattleCanvasTimeSource,
  BattleCanvasTiming,
  BattleCanvasViewport,
} from '@trinitywar/battle-canvas-core';
import { createBattleCanvasController, DEFAULT_BATTLE_CANVAS_TIMING } from '@trinitywar/battle-canvas-core';
import type { ClientRaidBattleReplay } from '@trinitywar/shared';
import { renderBattleCanvasScene, resizeCanvasToViewport } from './battleCanvasRenderer';

export interface BattleCanvasPlayerProps {
  replay: ClientRaidBattleReplay;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  playbackKey?: string | number;
  timing?: Partial<BattleCanvasTiming>;
  onComplete?: () => void;
}

export function BattleCanvasPlayer(props: BattleCanvasPlayerProps): JSX.Element {
  const {
    replay,
    width = 390,
    height = 760,
    autoPlay = true,
    playbackKey,
    timing,
    onComplete,
  } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    const viewport = createViewport(width, height);
    resizeCanvasToViewport(canvas, viewport);
    const controller = createBattleCanvasController({
      replay,
      timing,
    });
    const timeSource = createWebTimeSource();

    let frameHandle = 0;
    let completed = false;
    let startTimeMs: number | null = null;

    const renderSnapshot = (snapshot: BattleCanvasPlaybackSnapshot): void => {
      renderBattleCanvasScene(context, viewport, snapshot);
      if (snapshot.completed && !completed) {
        completed = true;
        onComplete?.();
      }
    };

    const tick = (timeMs: number): void => {
      if (startTimeMs === null) {
        startTimeMs = timeMs;
      }

      const snapshot = controller.sampleAt(timeMs - startTimeMs);
      renderSnapshot(snapshot);
      if (!snapshot.completed) {
        frameHandle = timeSource.requestFrame(tick);
      }
    };

    if (autoPlay) {
      frameHandle = timeSource.requestFrame(tick);
    } else {
      renderSnapshot(controller.sampleAt(0));
    }

    return () => {
      if (frameHandle !== 0) {
        timeSource.cancelFrame(frameHandle);
      }
    };
  }, [autoPlay, height, onComplete, playbackKey, replay, timing, width]);

  return (
    <canvas
      aria-label="Battle canvas demo"
      ref={canvasRef}
      style={{
        borderRadius: 24,
        display: 'block',
        height,
        margin: '0 auto',
        maxWidth: '100%',
        width,
      }}
    />
  );
}

export function getDefaultBattleCanvasTiming(): BattleCanvasTiming {
  return DEFAULT_BATTLE_CANVAS_TIMING;
}

function createViewport(width: number, height: number): BattleCanvasViewport {
  return {
    width,
    height,
    dpr: Math.max(window.devicePixelRatio || 1, 1),
  };
}

function createWebTimeSource(): BattleCanvasTimeSource {
  return {
    now(): number {
      return window.performance.now();
    },
    requestFrame(callback: (timeMs: number) => void): number {
      return window.requestAnimationFrame(callback);
    },
    cancelFrame(handle: number): void {
      window.cancelAnimationFrame(handle);
    },
  };
}
