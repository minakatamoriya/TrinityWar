import type { BattleCanvasPlaybackSnapshot, BattleCanvasViewport } from '@trinitywar/battle-canvas-core';

const LOGICAL_BOARD_WIDTH = 390;
const LOGICAL_BOARD_HEIGHT = 760;
const LOGICAL_CENTER_X = LOGICAL_BOARD_WIDTH / 2;
const LOGICAL_CENTER_Y = LOGICAL_BOARD_HEIGHT / 2;
const LOGICAL_PANEL_PADDING = 18;
const LOGICAL_LANE_HALF_DISTANCE = 138;
const LOGICAL_CARD_WIDTH = 124;
const LOGICAL_CARD_HEIGHT = 150;
const LOGICAL_BASE_PLATE_RADIUS_X = 76;

const TONE_COLORS: Record<string, string> = {
  damage: '#f8ede3',
  miss: '#d6e5fa',
  crit: '#ffd166',
  buff: '#8bd3a8',
  blood: '#ff7a7a',
  element: '#7ad9ff',
  default: '#f7f0de',
};

interface BoardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

interface LogicalPoint {
  x: number;
  y: number;
}

export function renderBattleCanvasScene(
  context: CanvasRenderingContext2D,
  viewport: BattleCanvasViewport,
  snapshot: BattleCanvasPlaybackSnapshot,
): void {
  const boardLayout = resolveBoardLayout(viewport);

  clearViewport(context, viewport);
  drawViewportBackground(context, viewport, boardLayout, snapshot);

  context.save();
  context.translate(boardLayout.x, boardLayout.y);
  context.scale(boardLayout.scale, boardLayout.scale);
  drawBoardSurface(context, snapshot);
  drawBoard(context, snapshot);
  drawUnits(context, snapshot);
  drawSideCallouts(context, snapshot);
  drawFloatingTexts(context, snapshot);
  drawNotice(context, snapshot);
  drawResult(context, snapshot);
  context.restore();
}

export function resizeCanvasToViewport(canvas: HTMLCanvasElement, viewport: BattleCanvasViewport): void {
  const physicalWidth = Math.max(Math.round(viewport.width * viewport.dpr), 1);
  const physicalHeight = Math.max(Math.round(viewport.height * viewport.dpr), 1);
  if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
    canvas.width = physicalWidth;
    canvas.height = physicalHeight;
  }

  if (canvas.style.width !== `${viewport.width}px`) {
    canvas.style.width = `${viewport.width}px`;
  }
  if (canvas.style.height !== `${viewport.height}px`) {
    canvas.style.height = `${viewport.height}px`;
  }
}

function resolveBoardLayout(viewport: BattleCanvasViewport): BoardLayout {
  const horizontalPadding = Math.min(Math.max(viewport.width * 0.05, 16), 28);
  const verticalPadding = Math.min(Math.max(viewport.height * 0.03, 16), 28);
  const availableWidth = Math.max(viewport.width - horizontalPadding * 2, 1);
  const availableHeight = Math.max(viewport.height - verticalPadding * 2, 1);
  const scale = Math.min(
    1,
    availableWidth / LOGICAL_BOARD_WIDTH,
    availableHeight / LOGICAL_BOARD_HEIGHT,
  );
  const width = LOGICAL_BOARD_WIDTH * scale;
  const height = LOGICAL_BOARD_HEIGHT * scale;

  return {
    x: (viewport.width - width) / 2,
    y: (viewport.height - height) / 2,
    width,
    height,
    scale,
  };
}

function clearViewport(context: CanvasRenderingContext2D, viewport: BattleCanvasViewport): void {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, viewport.width * viewport.dpr, viewport.height * viewport.dpr);
  context.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
}

function drawViewportBackground(
  context: CanvasRenderingContext2D,
  viewport: BattleCanvasViewport,
  boardLayout: BoardLayout,
  snapshot: BattleCanvasPlaybackSnapshot,
): void {
  const gradient = context.createLinearGradient(0, 0, 0, viewport.height);
  gradient.addColorStop(0, snapshot.enteredBloodMode ? '#2e1015' : '#101820');
  gradient.addColorStop(1, snapshot.enteredBloodMode ? '#120609' : '#060a0f');
  context.fillStyle = gradient;
  context.fillRect(0, 0, viewport.width, viewport.height);

  context.save();
  context.globalAlpha = snapshot.enteredBloodMode ? 0.22 : 0.14;
  context.fillStyle = snapshot.enteredBloodMode ? '#ff6a6a' : '#d3b784';
  context.beginPath();
  context.ellipse(
    viewport.width / 2,
    viewport.height / 2,
    boardLayout.width * 0.6,
    boardLayout.height * 0.28,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}

function drawBoardSurface(
  context: CanvasRenderingContext2D,
  snapshot: BattleCanvasPlaybackSnapshot,
): void {
  context.save();
  context.shadowColor = 'rgba(0, 0, 0, 0.28)';
  context.shadowBlur = 28;
  context.shadowOffsetY = 16;
  context.fillStyle = 'rgba(6, 10, 15, 0.94)';
  drawRoundedRect(context, 0, 0, LOGICAL_BOARD_WIDTH, LOGICAL_BOARD_HEIGHT, 28);
  context.fill();
  context.restore();

  context.save();
  clipRoundedRect(context, 0, 0, LOGICAL_BOARD_WIDTH, LOGICAL_BOARD_HEIGHT, 28);

  const stageGradient = context.createLinearGradient(0, 0, 0, LOGICAL_BOARD_HEIGHT);
  stageGradient.addColorStop(0, snapshot.enteredBloodMode ? '#331116' : '#162430');
  stageGradient.addColorStop(0.58, snapshot.enteredBloodMode ? '#16080b' : '#0a1118');
  stageGradient.addColorStop(1, snapshot.enteredBloodMode ? '#100407' : '#070b10');
  context.fillStyle = stageGradient;
  context.fillRect(0, 0, LOGICAL_BOARD_WIDTH, LOGICAL_BOARD_HEIGHT);

  context.globalAlpha = snapshot.enteredBloodMode ? 0.12 : 0.08;
  context.fillStyle = snapshot.enteredBloodMode ? '#ff8d8d' : '#e8d0a0';
  context.beginPath();
  context.ellipse(LOGICAL_CENTER_X, LOGICAL_CENTER_Y, 156, 220, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.strokeStyle = snapshot.enteredBloodMode ? 'rgba(255, 135, 135, 0.34)' : 'rgba(238, 223, 188, 0.16)';
  context.lineWidth = 1.5;
  drawRoundedRect(context, 0, 0, LOGICAL_BOARD_WIDTH, LOGICAL_BOARD_HEIGHT, 28);
  context.stroke();
  context.restore();
}

function drawBoard(
  context: CanvasRenderingContext2D,
  snapshot: BattleCanvasPlaybackSnapshot,
): void {
  const laneTopY = LOGICAL_CENTER_Y - LOGICAL_LANE_HALF_DISTANCE;
  const laneBottomY = LOGICAL_CENTER_Y + LOGICAL_LANE_HALF_DISTANCE;

  context.save();
  context.strokeStyle = snapshot.enteredBloodMode ? 'rgba(255, 114, 114, 0.4)' : 'rgba(255, 231, 196, 0.2)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(LOGICAL_PANEL_PADDING * 2, LOGICAL_CENTER_Y);
  context.lineTo(LOGICAL_BOARD_WIDTH - LOGICAL_PANEL_PADDING * 2, LOGICAL_CENTER_Y);
  context.stroke();

  context.fillStyle = snapshot.enteredBloodMode ? 'rgba(255, 114, 114, 0.14)' : 'rgba(215, 196, 145, 0.11)';
  context.beginPath();
  context.ellipse(LOGICAL_CENTER_X, LOGICAL_CENTER_Y, 116, 28, 0, 0, Math.PI * 2);
  context.fill();

  drawBasePlate(context, LOGICAL_CENTER_X, laneTopY, LOGICAL_BASE_PLATE_RADIUS_X, '#bc7f6e');
  drawBasePlate(context, LOGICAL_CENTER_X, laneBottomY, LOGICAL_BASE_PLATE_RADIUS_X, '#6b8db9');
  context.restore();
}

function drawUnits(
  context: CanvasRenderingContext2D,
  snapshot: BattleCanvasPlaybackSnapshot,
): void {
  const positions = resolveUnitPositions(snapshot);

  drawUnitCard(context, {
    accent: '#c36c5e',
    cardHeight: LOGICAL_CARD_HEIGHT,
    cardWidth: LOGICAL_CARD_WIDTH,
    centerX: positions.defender.x,
    centerY: positions.defender.y,
    snapshot,
    side: 'defender',
  });
  drawUnitCard(context, {
    accent: '#628ec6',
    cardHeight: LOGICAL_CARD_HEIGHT,
    cardWidth: LOGICAL_CARD_WIDTH,
    centerX: positions.attacker.x,
    centerY: positions.attacker.y,
    snapshot,
    side: 'attacker',
  });
}

function drawFloatingTexts(
  context: CanvasRenderingContext2D,
  snapshot: BattleCanvasPlaybackSnapshot,
): void {
  const positions = resolveUnitPositions(snapshot);

  for (const floatingText of snapshot.floatingTexts) {
    const origin = floatingText.side === 'attacker' ? positions.attacker : positions.defender;
    const baseY = origin.y + (floatingText.side === 'attacker' ? -84 : 84);
    const riseY = baseY - 26 * floatingText.progress;
    context.save();
    context.globalAlpha = floatingText.opacity;
    context.fillStyle = TONE_COLORS[floatingText.tone] ?? TONE_COLORS.default;
    context.font = floatingText.tone === 'crit' ? '700 24px Georgia, serif' : '600 18px Georgia, serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(floatingText.text, origin.x, riseY);
    context.restore();
  }
}

function drawSideCallouts(
  context: CanvasRenderingContext2D,
  snapshot: BattleCanvasPlaybackSnapshot,
): void {
  const positions = resolveUnitPositions(snapshot);

  for (const callout of snapshot.sideCallouts) {
    const origin = callout.side === 'attacker' ? positions.attacker : positions.defender;
    const baseY = callout.side === 'attacker' ? origin.y - 116 : origin.y + 116;
    const floatOffset = callout.side === 'attacker' ? -10 : 10;
    const y = baseY + floatOffset * (1 - callout.progress);
    const width = Math.max(72, 24 + callout.text.length * 18);
    const height = 26;
    const x = origin.x - width / 2;

    context.save();
    context.globalAlpha = callout.opacity * (0.88 + 0.12 * (1 - callout.progress));
    context.fillStyle = resolveCalloutBackground(callout.tone);
    drawRoundedRect(context, x, y - height / 2, width, height, 13);
    context.fill();

    context.strokeStyle = resolveCalloutStroke(callout.tone);
    context.lineWidth = 1;
    drawRoundedRect(context, x, y - height / 2, width, height, 13);
    context.stroke();

    context.fillStyle = resolveCalloutTextColor(callout.tone);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = callout.tone === 'crit' ? '700 13px Georgia, serif' : '600 12px Georgia, serif';
    context.fillText(callout.text, origin.x, y);
    context.restore();
  }
}

function drawNotice(
  context: CanvasRenderingContext2D,
  snapshot: BattleCanvasPlaybackSnapshot,
): void {
  if (!snapshot.notice) {
    return;
  }

  const width = 280;
  const height = 74;
  const x = (LOGICAL_BOARD_WIDTH - width) / 2;
  const y = 96;

  context.save();
  context.globalAlpha = 0.95;
  context.fillStyle = snapshot.notice.tone === 'blood' ? 'rgba(90, 16, 20, 0.94)' : 'rgba(12, 19, 28, 0.94)';
  drawRoundedRect(context, x, y, width, height, 18);
  context.fill();

  context.strokeStyle = snapshot.notice.tone === 'blood' ? 'rgba(255, 125, 125, 0.65)' : 'rgba(234, 220, 189, 0.22)';
  context.lineWidth = 1.5;
  drawRoundedRect(context, x, y, width, height, 18);
  context.stroke();

  context.fillStyle = '#f7f0de';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '700 20px Georgia, serif';
  context.fillText(snapshot.notice.title, x + width / 2, y + 28);

  if (snapshot.notice.summary) {
    context.font = '500 12px Georgia, serif';
    context.fillStyle = snapshot.notice.tone === 'blood' ? '#ffd7d7' : '#d9ccb0';
    context.fillText(snapshot.notice.summary, x + width / 2, y + 50);
  }
  context.restore();
}

function drawResult(
  context: CanvasRenderingContext2D,
  snapshot: BattleCanvasPlaybackSnapshot,
): void {
  if (!snapshot.result.visible) {
    return;
  }

  const width = 320;
  const height = 126;
  const x = (LOGICAL_BOARD_WIDTH - width) / 2;
  const y = 304;

  context.save();
  context.globalAlpha = 0.92;
  context.fillStyle = 'rgba(8, 10, 15, 0.92)';
  drawRoundedRect(context, x, y, width, height, 22);
  context.fill();

  context.strokeStyle = snapshot.result.outcome === 'WIN' ? 'rgba(122, 208, 173, 0.55)' : 'rgba(255, 144, 144, 0.46)';
  context.lineWidth = 1.5;
  drawRoundedRect(context, x, y, width, height, 22);
  context.stroke();

  context.fillStyle = '#f7f0de';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '700 26px Georgia, serif';
  context.fillText(snapshot.result.title, x + width / 2, y + 34);

  context.font = '500 13px Georgia, serif';
  context.fillStyle = '#d2c5a7';
  drawWrappedText(context, snapshot.result.summary, x + width / 2, y + 76, width - 36, 18);
  context.restore();
}

function drawUnitCard(
  context: CanvasRenderingContext2D,
  input: {
    accent: string;
    cardHeight: number;
    cardWidth: number;
    centerX: number;
    centerY: number;
    snapshot: BattleCanvasPlaybackSnapshot;
    side: 'attacker' | 'defender';
  },
): void {
  const unit = input.side === 'attacker' ? input.snapshot.attacker : input.snapshot.defender;
  const x = input.centerX - input.cardWidth / 2;
  const y = input.centerY - input.cardHeight / 2;

  context.save();
  context.globalAlpha = unit.opacity;
  context.translate(input.centerX, input.centerY);
  context.scale(unit.scale, unit.scale);
  context.translate(-input.centerX, -input.centerY);

  context.fillStyle = 'rgba(15, 18, 27, 0.94)';
  drawRoundedRect(context, x, y, input.cardWidth, input.cardHeight, 20);
  context.fill();

  context.strokeStyle = input.accent;
  context.lineWidth = 2;
  drawRoundedRect(context, x, y, input.cardWidth, input.cardHeight, 20);
  context.stroke();

  const portraitHeight = input.cardHeight * 0.66;
  const portraitGradient = context.createLinearGradient(x, y, x, y + portraitHeight);
  portraitGradient.addColorStop(0, `${input.accent}cc`);
  portraitGradient.addColorStop(1, 'rgba(9, 11, 17, 0.18)');
  context.fillStyle = portraitGradient;
  drawRoundedRect(context, x + 10, y + 10, input.cardWidth - 20, portraitHeight, 15);
  context.fill();

  context.fillStyle = '#f7f0de';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '700 17px Georgia, serif';
  context.fillText(unit.displayName, input.centerX, y + portraitHeight + 12);

  drawHealthBar(context, {
    x: x + 14,
    y: y + input.cardHeight - 24,
    width: input.cardWidth - 28,
    current: unit.displayHp,
    max: unit.maxHp,
    accent: input.accent,
  });

  context.restore();
}

function drawHealthBar(
  context: CanvasRenderingContext2D,
  input: {
    x: number;
    y: number;
    width: number;
    current: number;
    max: number;
    accent: string;
  },
): void {
  const clampedRatio = input.max > 0 ? Math.min(Math.max(input.current / input.max, 0), 1) : 0;
  context.fillStyle = 'rgba(255,255,255,0.08)';
  drawRoundedRect(context, input.x, input.y, input.width, 10, 6);
  context.fill();

  context.fillStyle = input.accent;
  drawRoundedRect(context, input.x, input.y, input.width * clampedRatio, 10, 6);
  context.fill();
}

function resolveCalloutBackground(tone: string): string {
  if (tone === 'crit') return 'rgba(97, 64, 7, 0.92)';
  if (tone === 'element') return 'rgba(15, 62, 83, 0.92)';
  if (tone === 'blood') return 'rgba(95, 18, 24, 0.94)';
  return 'rgba(18, 24, 33, 0.9)';
}

function resolveCalloutStroke(tone: string): string {
  if (tone === 'crit') return 'rgba(255, 209, 102, 0.7)';
  if (tone === 'element') return 'rgba(122, 217, 255, 0.7)';
  if (tone === 'blood') return 'rgba(255, 122, 122, 0.7)';
  return 'rgba(226, 215, 190, 0.28)';
}

function resolveCalloutTextColor(tone: string): string {
  if (tone === 'crit') return '#ffe39b';
  if (tone === 'element') return '#b7ecff';
  if (tone === 'blood') return '#ffd0d0';
  return '#f6ede0';
}

function drawBasePlate(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusX: number,
  color: string,
): void {
  context.save();
  context.fillStyle = `${color}22`;
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, 20, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function resolveUnitPositions(
  snapshot: BattleCanvasPlaybackSnapshot,
): {
  attacker: LogicalPoint;
  defender: LogicalPoint;
} {
  const topY = LOGICAL_CENTER_Y - LOGICAL_LANE_HALF_DISTANCE;
  const bottomY = LOGICAL_CENTER_Y + LOGICAL_LANE_HALF_DISTANCE;

  return {
    attacker: {
      x: LOGICAL_CENTER_X,
      y: bottomY + (LOGICAL_CENTER_Y - bottomY) * snapshot.attacker.advance,
    },
    defender: {
      x: LOGICAL_CENTER_X,
      y: topY + (LOGICAL_CENTER_Y - topY) * snapshot.defender.advance,
    },
  };
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const clampedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + clampedRadius, y);
  context.arcTo(x + width, y, x + width, y + height, clampedRadius);
  context.arcTo(x + width, y + height, x, y + height, clampedRadius);
  context.arcTo(x, y + height, x, y, clampedRadius);
  context.arcTo(x, y, x + width, y, clampedRadius);
  context.closePath();
}

function clipRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  drawRoundedRect(context, x, y, width, height, radius);
  context.clip();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const chars = Array.from(text);
  let line = '';
  const lines: string[] = [];

  for (const char of chars) {
    const nextLine = `${line}${char}`;
    if (context.measureText(nextLine).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = char;
      continue;
    }
    line = nextLine;
  }

  if (line.length > 0) {
    lines.push(line);
  }

  lines.slice(0, 3).forEach((item, index) => {
    context.fillText(item, centerX, startY + index * lineHeight);
  });
}
