import { useMemo, useState } from 'react';
import { buildSpiritCollisionBattleReplay } from '@trinitywar/shared';
import { BattleCanvasPlayer, getDefaultBattleCanvasTiming } from '../battle-canvas-web';
import { BATTLE_CANVAS_DEMO_SCENARIOS } from './demoScenarios';

const DEMO_TIMING = getDefaultBattleCanvasTiming();
const DEVICE_PRESETS = [
  { id: 'compact', label: '紧凑屏', width: 360, height: 680 },
  { id: 'standard', label: '标准屏', width: 390, height: 760 },
  { id: 'tall', label: '高屏', width: 430, height: 932 },
] as const;

export function BattleCanvasDemoApp(): JSX.Element {
  const [scenarioId, setScenarioId] = useState(BATTLE_CANVAS_DEMO_SCENARIOS[0]?.id ?? '');
  const [runSeed, setRunSeed] = useState(0);
  const [playbackNonce, setPlaybackNonce] = useState(0);
  const [devicePresetId, setDevicePresetId] = useState<typeof DEVICE_PRESETS[number]['id']>('standard');

  const scenario = BATTLE_CANVAS_DEMO_SCENARIOS.find((item) => item.id === scenarioId) ?? BATTLE_CANVAS_DEMO_SCENARIOS[0];
  const devicePreset = DEVICE_PRESETS.find((item) => item.id === devicePresetId) ?? DEVICE_PRESETS[1];
  const replay = useMemo(() => {
    if (!scenario) {
      return null;
    }

    return buildSpiritCollisionBattleReplay({
      orderId: `canvas-demo-${scenario.id}-${runSeed}`,
      seed: scenario.seed + runSeed,
      goldPool: 1000,
      attacker: scenario.attacker,
      defender: scenario.defender,
    });
  }, [runSeed, scenario]);

  if (!scenario || !replay) {
    return (
      <main className="battle-canvas-demo-shell">
        <section className="battle-canvas-empty">没有可用的战斗样例。</section>
      </main>
    );
  }

  return (
    <main className="battle-canvas-demo-shell">
      <section className="battle-canvas-demo-header">
        <div>
          <p className="battle-canvas-eyebrow">TrinityWar</p>
          <h1>Canvas Battle Demo</h1>
          <p className="battle-canvas-subtitle">
            这是独立于主游戏流程的 canvas2D 战斗实验页，只用于验证节奏、可读性和后续微信小游戏嵌入边界。
          </p>
        </div>
        <div className="battle-canvas-timing-card">
          <strong>当前默认节奏</strong>
          <span>前摇 {DEMO_TIMING.readyMs}ms</span>
          <span>冲刺 {DEMO_TIMING.dashMs}ms</span>
          <span>停顿 {DEMO_TIMING.impactFreezeMs}ms</span>
          <span>回合间隔 {DEMO_TIMING.roundGapMs}ms</span>
          <span>棋盘逻辑尺寸 390 × 760</span>
        </div>
      </section>

      <section className="battle-canvas-demo-layout">
        <aside className="battle-canvas-sidebar">
          <div className="battle-canvas-panel">
            <strong>样例列表</strong>
            <div className="battle-canvas-scenario-list">
              {BATTLE_CANVAS_DEMO_SCENARIOS.map((item) => (
                <button
                  className={item.id === scenario.id ? 'selected' : undefined}
                  key={item.id}
                  onClick={() => {
                    setScenarioId(item.id);
                    setRunSeed(0);
                    setPlaybackNonce(0);
                  }}
                  type="button"
                >
                  <span>{item.name}</span>
                  <small>{item.description}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="battle-canvas-panel">
            <strong>当前样例</strong>
            <p>{scenario.description}</p>
            <p className="battle-canvas-seed">回放种子：{scenario.seed + runSeed}</p>
            <div className="battle-canvas-device-list">
              {DEVICE_PRESETS.map((item) => (
                <button
                  className={item.id === devicePreset.id ? 'selected' : undefined}
                  key={item.id}
                  onClick={() => setDevicePresetId(item.id)}
                  type="button"
                >
                  {item.label}
                  <small>{item.width} × {item.height}</small>
                </button>
              ))}
            </div>
            <div className="battle-canvas-side-summary">
              <section>
                <span>我方</span>
                <strong>{scenario.attacker.spiritName}</strong>
                <small>攻 {scenario.attacker.attack} / 血 {scenario.attacker.maxHp}</small>
              </section>
              <section>
                <span>敌方</span>
                <strong>{scenario.defender.spiritName}</strong>
                <small>攻 {scenario.defender.attack} / 血 {scenario.defender.maxHp}</small>
              </section>
            </div>
            <div className="battle-canvas-actions">
              <button
                onClick={() => setPlaybackNonce((current) => current + 1)}
                type="button"
              >
                重播当前回放
              </button>
              <button
                onClick={() => setRunSeed((current) => current + 1)}
                type="button"
              >
                重新生成回放
              </button>
              <button
                onClick={() => {
                  const nextIndex = (BATTLE_CANVAS_DEMO_SCENARIOS.findIndex((item) => item.id === scenario.id) + 1) % BATTLE_CANVAS_DEMO_SCENARIOS.length;
                  setScenarioId(BATTLE_CANVAS_DEMO_SCENARIOS[nextIndex]?.id ?? scenario.id);
                  setRunSeed(0);
                  setPlaybackNonce(0);
                }}
                type="button"
              >
                下一个样例
              </button>
            </div>
          </div>
        </aside>

        <section className="battle-canvas-stage-panel">
          <div className="battle-canvas-stage-card">
            <BattleCanvasPlayer
              autoPlay
              height={devicePreset.height}
              playbackKey={`${scenario.id}-${runSeed}-${playbackNonce}`}
              replay={replay}
              width={devicePreset.width}
            />
          </div>
          <div className="battle-canvas-notes">
            <strong>当前页面的定位</strong>
            <ul>
              <li>不接主游戏路由，不读主流程状态。</li>
              <li>只验证 replay 播放、对撞节奏和低耦合模块边界。</li>
              <li>后续迁微信小游戏时，优先迁 `battle-canvas-core`，再换宿主层。</li>
              <li>高屏和矮屏下，棋盘用固定逻辑尺寸居中适配，不让对撞距离被屏幕高度拉长。</li>
            </ul>
          </div>
        </section>
      </section>
    </main>
  );
}
