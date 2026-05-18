# TrinityWar 首批读接口联调切换计划 v0.1

## 一、文档目的

这份文档是给 AI 和开发执行用的首批读接口联调切换计划。

前面的几份文档已经把下面这些东西分别定住了：

1. 后端总体阶段计划。
2. Prisma schema 与 migration 切分。
3. 接口契约。
4. service 分层。
5. 模块骨架。
6. 命令链路事务与幂等。

但在真正开始前后端联调时，还缺一份最实际的执行文档：

1. 先切哪个读接口。
2. 哪些页面在什么阶段继续允许 mock fallback。
3. 哪个阶段必须改成“真实接口失败就显式报错”。
4. 前端一次加载 3 个读接口时，如何避免“半真半假”状态长期存在。
5. 每切一批接口后，应该怎么验证。

这份文档的目标，就是让后面 AI 不只是会建表、会写 controller，而是知道如何把当前 Web 验证前端稳妥地从 mock/fallback 迁到真实数据库读接口。

本文件默认与下面文档配套使用：

1. 总计划：[dev/TrinityWar AI 后端总计划 v0.1.md](dev/TrinityWar AI 后端总计划 v0.1.md)
2. 接口契约：[dev/TrinityWar 首批真实接口契约清单 v0.1.md](dev/TrinityWar 首批真实接口契约清单 v0.1.md)
3. 模块骨架：[dev/TrinityWar 首批 NestJS 模块拆分与目录骨架规划 v0.1.md](dev/TrinityWar 首批 NestJS 模块拆分与目录骨架规划 v0.1.md)
4. Migration 切分计划：[dev/TrinityWar 首批数据库 Migration 切分计划 v0.1.md](dev/TrinityWar 首批数据库 Migration 切分计划 v0.1.md)
5. 命令链路事务与幂等：[dev/TrinityWar 首批写链路事务与幂等策略清单 v0.1.md](dev/TrinityWar 首批写链路事务与幂等策略清单 v0.1.md)

## 二、当前前端真实现状

当前前端读模型加载方式，核心在 [apps/game-client/src/api.ts](apps/game-client/src/api.ts)。

已确认的当前行为是：

1. `loadClientViewModel()` 会并行请求：
   `/api/client/bootstrap`
   `/api/client/home-summary`
   `/api/client/scene-content`
2. 三个接口当前都包在统一的 `fetchWithFallback()` 里。
3. 任意一个接口请求失败，当前前端就会回退到对应 mock snapshot。
4. 最终 `usingMock` 只要其中任意一个来源是 mock，就会被置为 true。

这意味着当前前端的优点是：

1. 演示稳定，不容易白屏。

但缺点也很明确：

1. 很容易长期处于“bootstrap 走真接口，scene-content 走 mock”的混合状态。
2. 用户看到的页面可能不是同一时刻、同一来源的真实状态。
3. 如果不制定切换规则，AI 很容易一直保留 fallback，不会真正完成切库。

## 三、首批读接口切换总原则

### 1. 先切聚合读，不先拆细读

第一阶段不要急着把 `scene-content` 拆成很多小接口。

原因：

1. 当前前端已经按 `bootstrap + home-summary + scene-content` 工作。
2. 如果一开始就拆细，联调面会指数增长。
3. 第一目标是先把现有页面稳定接到真实库，而不是先做接口美化。

因此首批切换顺序应保持：

1. `GET /api/client/bootstrap`
2. `GET /api/client/home-summary`
3. `GET /api/client/scene-content`
4. `GET /api/client/raid-targets/:targetId`

## 2. 先允许按接口级 fallback，后切到整组强一致

切换早期可以允许：

1. bootstrap 真，home mock，scene mock
2. bootstrap 真，home 真，scene mock

但这只能是过渡状态，不能长期保留。

一旦进入“主循环真实联调阶段”，就必须从“单接口 fallback”切到“整组读接口一致性要求”。

### 3. 先切读，不动写

在写链路正式接库之前，读接口应该先能稳定从数据库读出来。

否则后面会出现：

1. 写请求打到真实库。
2. 读页面还是 mock。
3. 用户操作后看不到真实结果。

### 4. 一个阶段只解决一类读模型

建议按下面顺序推进：

1. 启动引导读模型。
2. 首页总览读模型。
3. 场景聚合读模型。
4. 掠夺目标详情读模型。

不要一轮同时改所有页面的所有读取行为。

## 四、当前 4 个首批读接口的角色定位

## 1. GET /api/client/bootstrap

### 作用

1. 客户端启动引导。
2. 服务时间。
3. 赛季信息。
4. 背包最小引导状态。

### 切换优先级

最高。

### 原因

1. 结构相对稳定。
2. 依赖面最小。
3. 很适合作为“第一个真实读接口”打样。

## 2. GET /api/client/home-summary

### 作用

1. 首页资源条。
2. 待领取收益。
3. 每日任务摘要。
4. 首页状态总览。

### 切换优先级

第二。

### 原因

1. 它能最早验证 wallet、building、task 基础聚合是否读对。
2. 用户最容易观察它是否正确。

## 3. GET /api/client/scene-content

### 作用

1. 建筑、农场、部队、掠夺、战报、阵营六大页面聚合读取。

### 切换优先级

第三。

### 原因

1. 它依赖的表最多。
2. 它最容易出现“部分字段已真实、部分字段仍 mock”的混合状态。
3. 但第一阶段仍然不建议拆细，先保留大聚合更稳。

## 4. GET /api/client/raid-targets/:targetId

### 作用

1. 掠夺目标详情页读取。

### 切换优先级

第四。

### 原因

1. 它依赖 raid target pool 和目标快照。
2. 必须等 Migration 006 后再切最稳。

## 五、从当前 fallback 到真实联调的 4 个阶段

## 阶段 A：统一保留 fallback，但开始记录来源

### 目标

1. 不影响当前 demo 稳定性。
2. 明确知道每个读接口到底来自 api 还是 mock。

### 当前已具备的基础

1. `DataEnvelope<T>`
2. `source: 'api' | 'mock'`
3. `usingMock` 总开关

### 本阶段建议

1. 保留现有 `fetchWithFallback()`。
2. 增加更细粒度来源标记，而不是只有一个 `usingMock`。
3. 至少能分辨：
   `bootstrapSource`
   `homeSource`
   `scenesSource`
4. UI 可以只在开发模式显示来源，不必在正式界面显眼展示。

### 为什么必须先做这一步

因为如果连当前页面到底是哪一段在 fallback 都看不清，后续联调会非常低效。

### 本阶段验收

1. 开发环境能看到 3 个读接口各自来源。
2. 能明确知道“当前是全真、半真半假还是全 mock”。

## 阶段 B：先让 bootstrap 和 home-summary 真实化

### 目标

1. 让启动引导和首页资源条优先来自真实数据库。
2. 允许 scene-content 暂时继续 fallback。

### 前置条件

1. Migration 001 完成。
2. Migration 003 完成。
3. `bootstrap` query service 可用。
4. `home-summary` query service 可用。

### 切换策略

1. `bootstrap` 保持接口优先，失败可 fallback，但需要明显记录。
2. `home-summary` 保持接口优先，失败可 fallback，但需要明显记录。
3. `scene-content` 暂时仍允许 fallback。

### 本阶段不应该做

1. 不要强迫 scene-content 一起接真。
2. 不要开始切掠夺详情。

### 本阶段验收

1. 刷新页面后，顶部资源条来自真实数据库。
2. 首页待领取收益来自真实数据库。
3. 每日任务摘要至少结构上来自真实数据库。
4. 开发环境可以确认 bootstrap/home 已经是 `api` 来源。

## 阶段 C：scene-content 分模块真实化，但接口形状仍保持大聚合

### 目标

1. 继续维持 `GET /api/client/scene-content` 这一个大接口。
2. 但在后端内部逐步把 building、army、field、faction、report、raid 各块接到真实表。

### 前置条件

1. Migration 004 完成，field/seed/task 已就绪。
2. building/army/field query service 已可用。
3. 能接受 scene-content 在早期“部分 section 真、部分 section 临时拼接”的过渡状态。

### 推荐内部切换顺序

1. building section
2. army section
3. farm section
4. faction section
5. report section
6. raid section

### 为什么是这个顺序

1. building/army 依赖的表最早稳定。
2. farm 次之，但状态机更复杂。
3. faction 依赖阵营关系和贡献信息。
4. report/raid 最后，因为依赖 Migration 006。

### 前端策略

这一阶段不要改前端页面结构。

前端只做两件事：

1. 继续消费 `ClientSceneContentResponse`
2. 开发态能看出哪一块还是 mock 拼接，哪一块已经是真数据

### 本阶段验收

1. building 页全部来自真实数据库。
2. farm 页全部来自真实数据库。
3. army 页全部来自真实数据库。
4. scene-content 即使仍保留大接口，也不再依赖主 mock snapshot 来拼前 3 个核心页面。

## 阶段 D：读接口进入“主循环强一致模式”

### 目标

1. 对 bootstrap、home-summary、scene-content 三个主读接口，不再接受静默 fallback。
2. 一旦真实接口失败，开发环境要明确报错，而不是继续悄悄展示 mock。

### 为什么必须有这一阶段

如果一直保留静默 fallback，项目会长期看起来“能跑”，但你永远无法确认是否已经真正切库成功。

### 切换规则

当满足下面条件时，进入强一致模式：

1. Migration 003、004、005 已完成。
2. bootstrap、home-summary、scene-content 三个读接口都已有真实 query service。
3. building、farm、army 三个核心页面读数据都已来自真实数据库。

### 进入强一致模式后的行为建议

1. 开发环境：真实接口失败直接显示来源错误和失败原因。
2. 测试环境：不允许自动 fallback 到 mock。
3. 本地演示环境：可以保留一个显式的 `FORCE_MOCK_READS` 开关，但默认关闭。

### 本阶段验收

1. 正常联调时 `usingMock` 应长期为 false。
2. 人工关闭后端时，前端应明确展示读接口失败，而不是默默用 mock 顶上。
3. 团队可以明确宣布：主循环读链路已完成真实库切换。

## 六、针对当前前端 api.ts 的切换建议

当前关键位置在 [apps/game-client/src/api.ts](apps/game-client/src/api.ts)。

已确认：

1. `fetchWithFallback()` 是统一入口。
2. `loadClientViewModel()` 当前并行读 `bootstrap`、`home-summary`、`scene-content`。
3. `usingMock` 只要任意一个接口走 mock 就会为 true。

### 推荐改造方向

不是立刻删掉 fallback，而是分三步改：

### 第一步：保留统一包装，但暴露单接口来源

目标：

1. 让切换过程可观测。

建议：

1. `ClientViewModel` 增加按接口来源字段。
2. 保留总开关 `usingMock`，但不再只靠它判断状态。

### 第二步：引入“允许 fallback 的接口名单”

目标：

1. 避免所有读接口永远默认允许 fallback。

建议思路：

1. `bootstrap`、`home-summary`、`scene-content` 各自有独立 fallback policy。
2. 某接口切库完成后，就把它从允许 fallback 名单里移除。

### 第三步：切到“主读接口整组失败显式暴露”

目标：

1. 避免主循环长期半真半假。

建议：

1. 当 bootstrap/home/scene 三者被标记为“必须真实”后，只要其中之一失败，就直接返回明确错误态。
2. mock 只保留给显式开发模式或单独调试按钮使用。

## 七、按 migration 节点对齐读接口切换

## 在 Migration 001 后

可切：

1. `GET /api/client/bootstrap` 的最小真实版本

暂不切：

1. `home-summary`
2. `scene-content`
3. `raid-targets/:targetId`

## 在 Migration 003 后

可切：

1. `GET /api/client/home-summary`
2. `GET /api/client/scene-content` 的 building/army 基础部分

暂不完全切：

1. farm section
2. faction section
3. raid section
4. report section

## 在 Migration 004 后

可切：

1. `GET /api/client/scene-content` 的 farm section
2. `home-summary` 中与任务、农场摘要相关的字段

## 在 Migration 005 后

这不是新增读表为主的一批，但它意味着：

1. 可以开始让真实写链路回写真实状态。
2. 此后读接口切真才有意义，因为写后刷新才会看到真实结果。

## 在 Migration 006 后

可切：

1. `GET /api/client/raid-targets/:targetId`
2. `scene-content` 的 raid/report section

## 在 Migration 007 后

可补强：

1. 阵营分红展示
2. 训练完成、跨天刷新后的稳定读模型
3. admin/debug 只读查询

## 八、每个读接口的切换验收清单

## 1. bootstrap

至少检查：

1. 服务时间正确。
2. season 信息正确。
3. backpack 与全局物品结构完整。
4. 断开 mock 后页面仍能启动。

## 2. home-summary

至少检查：

1. 顶部资源条正确。
2. 待领取收益正确。
3. 每日任务摘要正确。
4. 建筑/农场/兵力摘要正确。

## 3. scene-content

至少检查：

1. building section 正确。
2. farm section 正确。
3. army section 正确。
4. raid section 在未接库前不会伪装成真数据。
5. report/faction section 来源清晰。

## 4. raid-targets/:targetId

至少检查：

1. 目标存在时可读。
2. 目标过期时返回正确错误。
3. 非可见目标不能读取。
4. 详情数据与目标池快照一致。

## 九、哪些情况必须禁止静默 fallback

下面这些情况一旦发生，不能再默默回退到 mock：

1. 测试环境联调。
2. 已声明“主循环读链路已切真”之后。
3. 写接口已经开始接真实数据库之后。
4. raid 详情已切到真实 target pool 之后。

原因很简单：

1. 否则会掩盖真实后端错误。
2. 前端看到的数据不再可信。
3. 排错时很难知道问题是在读、在写、还是在 fallback。

## 十、推荐 AI 执行顺序

如果后面让 AI 开始逐步执行这份计划，推荐顺序是：

1. 先补前端读接口来源可观测性。
2. 再补 bootstrap 真实读取。
3. 再补 home-summary 真实读取。
4. 再补 scene-content 的 building/army/farm 分段真实化。
5. 再移除主读接口的静默 fallback。
6. 最后补 raid-targets/:targetId 真实读取。

### 为什么 raid 详情放最后

因为它依赖的 target pool、订单、快照和保护期校验最复杂，不适合作为第一批联调打样接口。

## 十一、AI 执行模板

### 1. 切换单个读接口

你现在只负责把 [接口名] 读接口接入真实数据库读取链路，并按 [dev/TrinityWar 首批读接口联调切换计划 v0.1.md](dev/TrinityWar 首批读接口联调切换计划 v0.1.md) 保留当前前端 DTO 形状。不要顺手改写接口，不要顺手拆 scene-content。

### 2. 改造前端 fallback 策略

你现在只负责调整 [apps/game-client/src/api.ts](apps/game-client/src/api.ts) 的读接口 fallback 策略。目标是让 [接口名] 的来源可观测，并支持从“允许 fallback”切换到“必须真实”。不要改写命令接口逻辑。

### 3. 验证读接口切换

你现在只负责验证 [接口名] 是否已经完成真实库切换。请逐项检查：数据来源、fallback 行为、DTO 兼容性、页面渲染结果、失败时表现。

## 十二、验收清单

当“首批读接口切换”被认为完成时，至少要满足：

1. bootstrap、home-summary、scene-content 三个主读接口都可从真实数据库稳定读取。
2. 前端能明确知道各接口来源，而不是只知道一个总布尔值。
3. 核心页面不会长期处于半真半假状态。
4. scene-content 在第一阶段仍保持大聚合接口，不急着拆细。
5. 写接口一旦切真，读接口刷新结果也来自真实数据库。
6. 测试环境不再静默 fallback 到 mock。
7. 本地如需 mock，必须是显式开关，而不是默认兜底。

## 十三、最自然的下一份规划文档

如果还继续只写规划，不落代码，那么下一份最自然的是：

1. 掠夺订单与异步结算专项设计。
2. Prisma seed 与初始静态数据装载计划。
3. 前端 mock 数据退场计划。

如果仍然以 AI 实操优先，我更建议先写第 3 个。

因为读接口切换计划定下来后，下一步最容易让 AI 真正把 mock 体系收口的，就是把哪些 mock 要保留、哪些 snapshot 要删除、哪些 fallback 要变成显式开关单独写出来。