export interface BattleCanvasTimeSource {
  now(): number;
  requestFrame(callback: (timeMs: number) => void): number;
  cancelFrame(handle: number): void;
}

export interface BattleCanvasViewport {
  width: number;
  height: number;
  dpr: number;
}

export interface BattleCanvasAssetLoader<TImage = unknown> {
  loadImage(key: string, source: string): Promise<TImage>;
}
