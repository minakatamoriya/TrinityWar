# Trinity War 前端角色对话系统说明 v0.1

## 1. 目标

前端角色对话系统用于在事件开始、事件结束、场景进入、流程节点等位置弹出底部角色对话框。

当前实现目标：

- 对话文案由前端统一维护，不在业务调用点直接写文字。
- 对话角色、图片、场景、出现几率、播放模式、关闭方式都由 JSON 配置。
- 支持一个场景配置多句对话，既可以随机抽一句，也可以按顺序播放剧情段。
- 支持多个对话同时触发时的优先级、队列与打断策略。
- 对话框从屏幕底部弹出，满屏宽，占用约 1/3 屏高，并通过最高层级覆盖在所有 UI 之上。

## 2. 关键文件

- `apps/game-client/src/dialog/dialogScenes.json`
  - 对话角色、场景和文案池配置。
- `apps/game-client/src/dialog/dialogLibrary.ts`
  - JSON 配置的 TypeScript 类型、默认值读取和配置导出。
- `apps/game-client/src/dialog/useCharacterDialog.ts`
  - 对话播放控制器，负责几率、冷却、队列、序列推进。
- `apps/game-client/src/dialog/CharacterDialogProvider.tsx`
  - 全局 Provider 和渲染入口。
- `apps/game-client/src/ui/common/CharacterDialog.tsx`
  - 底部角色对话框组件。
- `apps/game-client/src/styles.css`
  - 对话框样式。

## 3. 配置结构

配置入口为 `dialogScenes.json`。

### 3.1 defaults

`defaults` 是所有场景的默认行为。

```json
{
  "mode": "random",
  "advance": "auto",
  "priority": 0,
  "interrupt": "queue",
  "showCloseButton": true,
  "closeOnMaskClick": true,
  "enterDelayMs": 0,
  "autoCloseMs": 3600,
  "holdMs": 0
}
```

字段说明：

- `mode`: 默认播放模式。
- `advance`: 默认推进方式。
- `priority`: 默认队列优先级。
- `interrupt`: 默认打断策略。
- `showCloseButton`: 是否显示关闭按钮。
- `closeOnMaskClick`: 点击遮罩时是否关闭或推进。
- `enterDelayMs`: 场景触发后延迟多少毫秒再真正弹出。
- `autoCloseMs`: 自动推进或关闭时间。
- `holdMs`: 最短停留时间。

### 3.2 actors

`actors` 定义可出场角色。

```json
{
  "fox": {
    "name": "狐狸",
    "imageUrl": "/assets/character/fox.png",
    "imageAlt": "狐狸宠物"
  },
  "tudi": {
    "name": "土地公",
    "imageUrl": "/assets/character/tudi.png",
    "imageAlt": "土地公"
  }
}
```

新增角色时，需要：

1. 把图片放入 `apps/game-client/public/assets/character`。
2. 在 `actors` 中新增角色 ID。
3. 在场景 `steps` 中引用该角色 ID。

### 3.3 scenes

`scenes` 定义具体对话场景。

示例：

```json
{
  "home.welcome.fox": {
    "mode": "sequence",
    "chance": 1,
    "priority": 10,
    "interrupt": "queue",
    "advance": "auto",
    "options": {
      "showCloseButton": false,
      "closeOnMaskClick": true,
      "autoCloseMs": 3600
    },
    "steps": [
      {
        "actorId": "fox",
        "text": "主人，欢迎你回来。"
      }
    ]
  }
}
```

## 4. 场景字段说明

- `mode`
  - `random`: 从 `steps` 中随机抽一条播放。
  - `sequence`: 按 `steps` 顺序逐条播放。
  - `shuffle`: 将 `steps` 洗牌后逐条播放。

- `chance`
  - 场景触发后的实际出现几率，范围 `0` 到 `1`。
  - `1` 表示必定出现，`0.75` 表示 75% 概率出现。

- `cooldownMs`
  - 同一场景的冷却时间。
  - 冷却内再次触发会被忽略。

- `enterDelayMs`
  - 场景命中后延迟弹出的时间。
  - 适合登录、切换场景等需要先让页面稳定显示的场景。

- `priority`
  - 队列优先级。
  - 同时有多个对话等待播放时，数字越大越先播放。

- `interrupt`
  - 当前已有对话播放时，新对话如何处理。
  - `queue`: 加入队列。
  - `replace`: 替换当前对话。
  - `ignore`: 如果当前有对话，则忽略本次触发。

- `advance`
  - 多句对话如何推进。
  - `auto`: 自动按 `autoCloseMs` 推进。
  - `click`: 等玩家点击继续。
  - `auto-or-click`: 自动推进，也允许玩家点击提前继续。

- `options`
  - 场景级 UI 与时间配置。
  - 可被单个 step 覆盖。

- `steps`
  - 该场景的对话池。
  - 每条 step 至少包含 `actorId` 和 `text`。

## 5. step 字段说明

```json
{
  "actorId": "tudi",
  "text": "小神在此守候多时了，麦子都熟了。",
  "advance": "auto-or-click",
  "autoCloseMs": 4200,
  "showCloseButton": false
}
```

字段说明：

- `actorId`: 出场角色 ID。
- `text`: 对话内容。
- `advance`: 覆盖场景推进方式。
- `autoCloseMs`: 覆盖场景自动推进时间。
- `holdMs`: 覆盖最短停留时间。
- `showCloseButton`: 覆盖关闭按钮显示。
- `closeOnMaskClick`: 覆盖遮罩点击行为。

## 6. 当前已配置场景

### 6.1 登录后欢迎

场景 ID：`home.welcome.fox`

触发时机：登录后进入主页。

文案：

```text
主人，欢迎你回来。
```

### 6.2 进入农场成熟作物提示

场景 ID：`farm.enter.ripe-crop`

触发时机：进入农场时，如果存在成熟或枯萎作物。

文案：

```text
小神在此守候多时了，麦子都熟了。
```

当前配置：

- 出现几率：`0.75`
- 冷却时间：`120000ms`
- 优先级：`20`

## 7. 调用方式

组件必须位于 `CharacterDialogProvider` 下。

在组件中调用：

```ts
const dialog = useCharacterDialogController();

dialog.playDialogScene('home.welcome.fox');
```

当前 `App.tsx` 中已经创建全局 controller，并用 `CharacterDialogProvider` 包住主应用。

业务调用点只允许传场景 ID，不直接传入对话文字。

## 8. 对话队列规则

当新场景触发时：

1. 先检查场景是否存在。
2. 根据 `mode` 展开要播放的 steps。
3. 检查 `chance`。
4. 检查 `cooldownMs`。
5. 如果当前没有对话，立即播放。
6. 如果当前已有对话，根据 `interrupt` 决定：
   - `queue`: 加入等待队列。
   - `replace`: 立刻替换当前对话。
   - `ignore`: 忽略本次触发。
7. 队列按 `priority` 从高到低排序，同优先级按触发顺序播放。

## 9. UI 行为

- 对话框通过 portal 渲染到 `document.body`。
- 层级为全局最高层级，避免被其他 modal、场景、浮层覆盖。
- 弹窗从屏幕最底部进入，宽度等于屏幕宽度。
- 弹出时从屏幕底部滑入，关闭或自动结束时向屏幕底部滑出。
- 左侧显示角色名与文字，右侧显示角色图片。
- 多句对话时显示进度，例如 `1 / 3`。
- `click` 或 `auto-or-click` 时显示“点击继续”。

## 10. 后续扩展建议

建议下一阶段继续补齐以下能力：

1. `oncePerSession` / `oncePerPlayer`
   - 新手引导、剧情首次触发等场景只出现一次。

2. 配置化 trigger registry
   - 当前 `trigger` 已预留结构，但实际触发仍由前端代码判断。
   - 后续可以建立统一触发器，把“进入场景”“作物成熟”“掠夺胜利”等条件映射到对话场景。

3. 条件表达扩展
   - 支持 `minCastleLevel`、`faction`、`hasItem`、`spiritLevelAtLeast` 等条件。

4. 文案池分组
   - 可以增加 `tags`，例如 `farm`、`guide`、`battle`、`idle`。

5. 本地播放记录
   - 将冷却、已播放状态写入 localStorage 或玩家设置，避免刷新页面后重复触发同一引导。

6. 调试面板
   - 开发环境提供对话场景选择器，方便直接预览每个场景。

## 11. 文案添加规范

新增对话时优先按以下命名方式组织场景 ID：

```text
场景.事件.细分
```

示例：

- `home.welcome.fox`
- `farm.enter.ripe-crop`
- `raid.win.small`
- `raid.lose.heavy`
- `spirit.upgrade.success`

文案建议：

- 单句提示控制在一到两句话。
- 系统引导优先用 `sequence`。
- 日常闲聊优先用 `random`。
- 同一池子多句都想看但不想固定顺序时用 `shuffle`。
- 关键剧情不要设置过低 `chance`。
- 高频事件必须设置 `cooldownMs`。
