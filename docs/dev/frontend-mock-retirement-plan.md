# TrinityWar 前端 Mock 数据退场计划 v0.1

## 一、文档目的

这份文档是给 AI 和开发执行用的前端 mock 数据退场计划。

前面的规划已经把后端 schema、migration、接口契约、读接口切换、写链路事务与幂等这些关键问题基本定住了。

接下来最容易拖慢真实联调的一块，不是后端本身，而是前端 mock 体系如果长期不收口，会造成下面这些问题：

1. 页面看起来能跑，但其实读的是 mock。
2. 写接口已经接到真实库，读刷新却仍然来自本地 snapshot。
3. 后端出错时被 fallback 掩盖，排查方向完全错误。
4. AI 后续改代码时，不知道应该改真实链路还是改 mock 模拟链路。
5. 同一份业务规则在真实后端和前端本地模拟里各有一套，越来越漂移。

这份文档的目标，就是把当前前端 mock 体系按组件拆开，明确：

1. 哪些 mock 必须优先退场。
2. 哪些 mock 可以短期保留，但必须变成显式开关。
3. 哪些 mock 属于开发辅助数据，可以长期保留但不能再参与默认主链路。
4. 退场顺序应该和哪些 migration、哪些真实接口切换节点对齐。

本文件默认与下面文档配套使用：

1. 读接口联调切换计划：[dev/ai-backend-read-api-cutover-plan.md](dev/ai-backend-read-api-cutover-plan.md)
2. Migration 切分计划：[dev/ai-backend-migration-splitting-plan.md](dev/ai-backend-migration-splitting-plan.md)
3. 命令链路事务与幂等：[dev/ai-backend-command-transaction-idempotency-plan.md](dev/ai-backend-command-transaction-idempotency-plan.md)
4. 接口契约：[dev/ai-backend-api-contract-plan.md](dev/ai-backend-api-contract-plan.md)

## 二、当前 mock 体系真实现状

当前前端 mock 体系主要集中在 [apps/game-client/src/api.ts](apps/game-client/src/api.ts) 和 [apps/game-client/src/mockData.ts](apps/game-client/src/mockData.ts)。

已确认当前至少有 4 层 mock 结构：

## 1. 静态基线 mock 数据

来源：

1. [apps/game-client/src/mockData.ts](apps/game-client/src/mockData.ts)

职责：

1. 提供 bootstrap、home-summary、scene-content、raid detail 的初始快照。
2. 提供页面初次渲染可用的默认结构。

### 风险

如果这层长期继续作为默认回退源，前端就很容易一直“看上去有数据”，但并不代表真实后端已经接通。

## 2. api.ts 内的可变 mock snapshot

来源：

1. `mockBootstrapSnapshot`
2. `mockHomeSnapshot`
3. `mockSceneSnapshot`

职责：

1. 在前端内存里维护一套可被修改的“伪真实状态”。
2. 让命令操作后页面立即刷新，而不依赖真实后端。

### 风险

这是最危险的一层，因为它会让前端具备一套本地状态机。

一旦真实后端开始接入，如果这层还默认参与主链路，就会出现：

1. 后端改对了，页面却还按本地 snapshot 显示。
2. 后端失败了，但本地 snapshot 继续推进，导致假成功。

## 3. 本地生命周期模拟器

来源：

1. `syncMockFieldLifecycle()`
2. `syncMockArmyTrainingQueue()`
3. `syncMockFactionScene()`
4. `updateMockFieldStatus()`
5. 一系列 `setMock...` / `applyMock...` 方法

职责：

1. 在前端本地模拟时间推进。
2. 在前端本地推进农场成熟、训练完成、阵营分红说明、任务变化。

### 风险

这是“规则漂移”最大来源。

因为这些逻辑本质上已经是一个前端版小后端。

## 4. 本地命令处理器

来源：

1. `applyMockClaimPending(...)`
2. 以及同类 mock action handlers
3. `buildMockMutation(...)`
4. `buildMockCollectResponse(...)`

职责：

1. 在真实接口失败或未接入时，直接在前端完成扣钱、加钱、改地块、改任务、改兵力。

### 风险

这是最应该优先退场的部分。

因为它直接和真实命令链路竞争“谁是唯一结算源”。

## 三、退场总原则

### 1. 默认主链路必须逐步从“静默 mock”变成“显式真实”

任何默认用户路径，只要已经声明进入真实联调阶段，就不应该再静默落回 mock。

### 2. 先退本地命令处理器，再退本地生命周期模拟器，最后再整理静态样例数据

原因：

1. 最危险的是前端本地结算。
2. 第二危险的是前端本地时间推进。
3. 静态样例数据本身并不危险，只要它不再参与默认生产式路径。

### 3. mock 可以保留，但必须从“默认兜底”变成“显式调试模式”

允许长期保留的 mock，只能存在于下面这些场景：

1. 开发演示。
2. 视觉回归。
3. 无后端条件下的页面布局开发。

但不能再作为主链路默认兜底。

### 4. mock 退场必须和接口切换节点绑定，而不是单独无限延期

例如：

1. `bootstrap` 切真后，对应的 bootstrap mock fallback 就要收口。
2. `home-summary` 切真后，对应的 home snapshot 默认不再参与主链路。
3. `scene-content` 的 building/farm/army 切真后，本地生命周期模拟器必须逐块停用。

## 四、把 mock 分成 3 类处理

## A 类：必须优先退场

包括：

1. 本地命令处理器
2. 本地资产结算模拟
3. 本地地块收取/播种结算
4. 本地训练完成结算
5. 本地任务奖励结算

判定标准：

1. 任何会改钱、改等级、改地块、改兵力、改奖励到账结果的本地逻辑，都属于 A 类。

### 处理原则

1. 一旦对应真实命令链路接通，A 类 mock 必须立即退出默认主链路。
2. 最多保留为 `FORCE_MOCK_COMMANDS` 之类的显式开发开关。
3. 测试环境禁止启用。

## B 类：可以阶段性保留，但必须显式标记

包括：

1. 读接口 fallback
2. 本地 scene-content 大快照拼装
3. 还没切真的 report/raid/faction section 临时 mock section

判定标准：

1. 它本身不决定结算结果，但会影响页面展示。

### 处理原则

1. 在读接口切换阶段可暂时保留。
2. 必须有来源标记。
3. 一旦主循环读链路切真，就不能继续静默 fallback。

## C 类：可以长期保留的开发样例数据

包括：

1. 用于无后端场景的静态 UI 样例数据。
2. 用于 Storybook 或纯视觉开发的演示数据。
3. 用于截图和交互演示的固定 mock fixture。

### 处理原则

1. 不删除也可以。
2. 但必须脱离默认运行主链路。
3. 最好从 `api.ts` 搬到专门的 fixtures 或 demo-data 目录，而不是继续和真实数据流混放。

## 五、当前文件级退场目标

## 1. [apps/game-client/src/api.ts](apps/game-client/src/api.ts)

### 当前问题

1. 同时承担真实接口层、fallback 层、本地状态层、本地规则模拟层。
2. 文件职责过重。
3. 非常容易让 AI 在这里继续堆更多“临时补丁”。

### 退场目标

最终它只应该负责：

1. 调用真实 HTTP 接口。
2. 处理显式 fallback policy。
3. 做响应 normalize。
4. 在必要时读取“显式 mock 模式”的数据源。

### 最终不应该再负责

1. 本地结算。
2. 本地生命周期推进。
3. 本地训练完成模拟。
4. 本地收菜结果计算。
5. 本地阵营分红规则计算。

## 2. [apps/game-client/src/mockData.ts](apps/game-client/src/mockData.ts)

### 当前问题

1. 既像页面 fixture，又像运行时 fallback 数据源。

### 退场目标

最终保留方向应是：

1. 只作为显式 demo fixture。
2. 不再被默认主链路自动引用。

## 六、按阶段推进的退场计划

## 阶段 A：来源可观测，不动默认行为

### 目标

1. 先看清当前哪些路径在吃 mock。
2. 不立即大删，避免演示能力瞬间丢失。

### 要做的事

1. 按接口显示 `bootstrapSource`、`homeSource`、`scenesSource`。
2. 按动作显示 `mutationSource`，区分 `api` 与 `mock`。
3. 保留 `usingMock`，但不再只依赖它做判断。

### 此阶段不做

1. 不强行删除 mock handler。
2. 不强行关闭 fallback。

### 验收

1. 开发环境能一眼看出当前页面哪些部分还在吃 mock。

## 阶段 B：读接口 mock 收口

### 目标

1. 让主读链路逐步切到真实接口。
2. 缩小默认 fallback 面。

### 要做的事

1. `bootstrap` 切真后，bootstrap fallback 改为开发模式专用。
2. `home-summary` 切真后，home snapshot 不再默认参与主链路。
3. `scene-content` 的 building/army/farm section 切真后，不再从 `mockSceneSnapshot` 读取这些核心 section。

### 验收

1. 三个主读接口的核心 section 已可不依赖默认 mock snapshot。
2. 开发环境如发生 fallback，来源可见且可定位。

## 阶段 C：核心命令 mock 退场

### 目标

1. 一旦真实写链路接通，就让前端失去本地结算能力。

### 要优先退的内容

1. `applyMockClaimPending(...)`
2. 本地 building 升级处理器
3. 本地播种处理器
4. 本地收菜处理器
5. 本地训练处理器
6. 本地任务奖励处理器
7. 本地阵营捐献处理器

### 退场方式

1. 默认主链路直接调用真实命令接口。
2. mock command handler 如果还保留，只允许在显式 mock 模式下启用。
3. 测试环境和正式联调环境一律禁用。

### 验收

1. 用户操作是否成功，只由真实后端决定。
2. 页面刷新结果来自真实读接口，而不是本地 snapshot 改写。

## 阶段 D：生命周期模拟器退场

### 目标

1. 前端不再本地推进农场成熟、训练剩余时间、阵营状态说明。

### 要优先退的内容

1. `syncMockFieldLifecycle()`
2. `syncMockArmyTrainingQueue()`
3. `syncMockFactionScene()`
4. `updateMockFieldStatus()`

### 为什么放在命令 mock 后面退

因为只要主写链路和主读链路已经接真，这些本地模拟器留下来的价值就只剩开发演示，不再是主流程必需。

### 验收

1. 农场阶段变化由真实返回字段驱动。
2. 训练剩余时间由真实 queue 字段驱动。
3. 阵营说明来自真实 summary/scene，而不是本地重算。

## 阶段 E：静态 fixture 归档

### 目标

1. 把还需要保留的 demo 数据从主运行文件中拆出去。

### 要做的事

1. 把继续保留的样例数据归入单独 fixtures 目录。
2. `mockData.ts` 不再作为默认 api fallback 直接入口。
3. 如需要演示模式，改成显式切换到 fixture provider。

### 验收

1. 主应用默认启动不再隐式依赖 `mockData.ts`。
2. mock 仅在显式 demo 模式下生效。

## 七、和后端切换节点的对齐关系

## 在 Migration 001 后

可以开始收口：

1. bootstrap 的默认 fallback 范围

仍然保留：

1. home/scene 的 mock
2. 命令 mock

## 在 Migration 003 后

可以开始收口：

1. home-summary 的默认 fallback
2. building/army 相关本地读模拟

仍然保留：

1. farm 生命周期模拟
2. raid/report mock
3. 命令 mock

## 在 Migration 004 后

可以开始收口：

1. farm section 的默认 mock snapshot
2. 种子库存本地演进逻辑
3. 与地块状态相关的本地生命周期模拟

## 在 Migration 005 后

可以开始收口：

1. 核心命令 mock handler
2. 本地资产结算逻辑
3. 本地任务奖励结算逻辑

这是最关键的退场节点。

## 在 Migration 006 后

可以开始收口：

1. raid target detail mock
2. report/raid section mock
3. 与 raid 相关的本地快照拼装

## 在 Migration 007 后

可以开始收口：

1. faction dividend 的本地描述生成
2. 训练完成/跨天任务的本地兜底模拟
3. admin/debug 相关本地替代逻辑

## 八、显式 mock 模式建议

如果项目仍然需要保留“无后端也能演示”的能力，建议改成显式模式，而不是默认 fallback。

### 推荐开关

1. `VITE_FORCE_MOCK_READS`
2. `VITE_FORCE_MOCK_COMMANDS`
3. `VITE_MOCK_SCENE_SECTIONS=building,farm,army,...`

### 使用原则

1. 默认全部关闭。
2. 本地开发手动开启。
3. 测试环境禁用。
4. CI 联调禁用。

### 好处

1. mock 仍可用于视觉开发。
2. 真实联调不会再被静默污染。
3. AI 后续修改时，边界更清楚。

## 九、建议的文件整理方向

### 1. 短期

1. 继续允许 [apps/game-client/src/api.ts](apps/game-client/src/api.ts) 保留过渡逻辑。
2. 但要把“真实接口层”和“mock 模式层”逐步分离。

### 2. 中期

建议拆成：

1. `api/client-read-api.ts`
2. `api/client-command-api.ts`
3. `api/mock/mock-read-provider.ts`
4. `api/mock/mock-command-provider.ts`
5. `api/mock/mock-fixtures.ts`

### 3. 长期

1. 主应用只依赖真实 api provider。
2. mock provider 只在显式 demo/dev 模式下挂载。

## 十、AI 执行顺序建议

如果后面让 AI 逐步执行这份计划，推荐顺序是：

1. 先补来源可观测性。
2. 再把读接口 fallback 改成按接口控制。
3. 再停掉核心命令 mock handler 的默认路径。
4. 再停掉农场/训练/阵营的本地生命周期模拟器。
5. 最后再把静态 fixture 从主运行链路中拆走。

### 为什么不要先删 mockData.ts

因为最外层静态数据本身并不是最大风险。

真正的风险，是它现在还通过 api.ts 参与默认运行时逻辑。

所以应该先切断运行时依赖，再做文件清理。

## 十一、AI 执行模板

### 1. 收口单类 mock

你现在只负责收口 [mock 类型名]，范围仅限 [apps/game-client/src/api.ts](apps/game-client/src/api.ts) 中对应逻辑。请按照 [dev/frontend-mock-retirement-plan.md](dev/frontend-mock-retirement-plan.md) 把它从默认主链路移出，但保留显式 mock 模式能力。不要顺手改其他 mock 类别。

### 2. 验证 mock 是否已退出主链路

你现在只负责验证 [页面/接口/动作] 是否已经不再依赖默认 mock。请逐项检查：数据来源、fallback 条件、显式 mock 开关行为、真实接口失败时表现。

### 3. 拆分 mock provider

你现在只负责把 [apps/game-client/src/api.ts](apps/game-client/src/api.ts) 中的 mock provider 逻辑拆出主文件。不要改真实接口契约，不要改页面组件。

## 十二、验收清单

当前端 mock 体系被认为“基本完成退场”时，至少要满足：

1. 主读接口默认不再静默依赖 mock snapshot。
2. 主写链路默认不再调用本地命令处理器。
3. 农场、训练、阵营等本地生命周期模拟器已退出默认主链路。
4. mock 仍可在显式开发模式下启用，但默认关闭。
5. 测试环境和真实联调环境禁用 mock command 模式。
6. 页面如果仍出现 mock 数据，开发者能明确知道来源和开关原因。
7. `mockData.ts` 不再是主应用默认运行路径的一部分。

## 十三、最自然的下一份规划文档

如果还继续只写规划，不落代码，那么下一份最自然的是：

1. 掠夺订单与异步结算专项设计。
2. Prisma seed 与初始静态数据装载计划。
3. 后端初始建档与首批测试账号方案。

如果仍以 AI 实操优先，我更建议先写第 1 个。

因为主循环、migration、读接口、mock 退场这些主干已经差不多了，下一块真正复杂且最容易让 AI 一次写乱的，就是掠夺订单和异步结算。