# TrinityWar 后端初始建档与首批测试账号方案 v0.1

## 一、文档目的

这份文档是给 AI 和开发执行用的后端初始建档与首批测试账号方案。

前面的文档已经把下面这些问题定住了：

1. 数据表怎么拆。
2. migration 怎么分批。
3. 哪些主数据走 Prisma seed。
4. 哪些玩家状态应该由 PlayerInitializationService 创建。

但在真正开始做登录、建档和联调时，还会立刻碰到三个非常实际的问题：

1. 玩家第一次登录后，到底要初始化哪些表，顺序是什么。
2. 哪些字段必须显式写初值，哪些可以依赖默认值。
3. 本地和测试环境要准备哪几类账号，才能支撑后续 AI 自己联调与验收。

这份文档的目标，就是把“初始建档”和“首批测试账号准备”一次写清楚，避免后面 AI 一边写 auth，一边临时拼玩家初始状态。

本文件默认与下面文档配套使用：

1. Prisma seed 与静态数据：[dev/ai-backend-prisma-seed-and-static-data-plan.md](dev/ai-backend-prisma-seed-and-static-data-plan.md)
2. Migration 切分计划：[dev/ai-backend-migration-splitting-plan.md](dev/ai-backend-migration-splitting-plan.md)
3. 接口契约：[dev/ai-backend-api-contract-plan.md](dev/ai-backend-api-contract-plan.md)
4. Service 分层：[dev/ai-backend-service-plan.md](dev/ai-backend-service-plan.md)
5. 命令链路事务与幂等：[dev/ai-backend-command-transaction-idempotency-plan.md](dev/ai-backend-command-transaction-idempotency-plan.md)

## 二、先给结论：建档必须是独立 use case，不要散落到登录流程里

建议明确一个：

1. BootstrapPlayerUseCase
2. PlayerInitializationService

职责拆分建议如下：

1. LoginUseCase 只负责身份校验、查找或创建 player root、签发 token。
2. BootstrapPlayerUseCase 负责判断“这个 player 是否已经完成初始化”。
3. PlayerInitializationService 负责真正写入所有玩家私有初始状态。

不要把下面这些逻辑直接塞进 auth controller：

1. 直接写 PlayerWallet。
2. 直接写 PlayerBuilding。
3. 直接批量插 PlayerFieldSlot。
4. 直接塞 starter seed。

## 三、首次登录建档的推荐生命周期

首版建议按下面顺序处理。

## 1. 接受登录请求

输入可能来自：

1. 微信 code 登录。
2. dev-login。

## 2. 查找或创建 PlayerAuthIdentity

规则：

1. provider + providerUserId 命中时，直接拿现有 player。
2. 没命中时，进入新玩家创建流程。

## 3. 创建 Player 根记录

至少创建：

1. Player
2. PlayerAuthIdentity

## 4. 进入 BootstrapPlayerUseCase

职责：

1. 检查该玩家是否已完成初始化。
2. 如果没有，则调用 PlayerInitializationService。
3. 如果已有完整状态，则直接返回。

## 5. 返回最小身份信息或 bootstrap 摘要

后续客户端再走：

1. `/api/client/me`
2. `/api/client/bootstrap`
3. `/api/client/home-summary`

## 四、PlayerInitializationService 必须初始化哪些表

首批至少应初始化下面这些玩家私有状态表。

## 1. PlayerWallet

建议初始字段：

1. vaultGold
2. vaultCapacity
3. walletGold
4. walletCapacity
5. walletProtectedRatio
6. pendingTaxGold = 0
7. pendingDividendGold = 0
8. pendingRaidOverflowGold = 0
9. pendingRaidOverflowExpiresAt = null
10. balanceVersion = 1

### 原则

1. 不要依赖数据库默认值把一半字段省掉。
2. 需要前端马上读取的字段应显式写入。

## 2. PlayerBuilding

建议初始字段：

1. castleLevel = 1
2. vaultLevel = 1
3. fieldSlotLevel = 1
4. populationLevel = 1
5. watchtowerLevel = 1
6. protectionTechLevel = 0 或 1，按最终规则定
7. farmYieldTechLevel = 0 或 1
8. ripeWindowTechLevel = 0 或 1
9. pendingClaimTechLevel = 0 或 1
10. buildingVersion = 1

### 原则

1. 基础建筑与扩展线初值都必须明确。
2. 不允许部分字段 null，靠业务层猜默认值。

## 3. PlayerArmy

建议初始字段：

1. totalCount
2. availableCount
3. frozenCount = 0
4. woundedCount = 0
5. capacity
6. armyVersion = 1

### 原则

1. 首批 capacity 应与当前 populationLevel 对得上。
2. 不要建档后再靠第一次首页读取时临时修 capacity。

## 4. PlayerFieldSlot

建议一次性初始化当前开放上限内所有 slot。

例如：

1. slotIndex 1..N
2. 前几块 `isUnlocked = true`
3. 后续块 `isUnlocked = false`

每块田至少应写：

1. status
2. unlockCastleLevel
3. statusVersion = 1
4. seedDefinitionId = null
5. 所有时序字段 = null

### 原则

1. 不建议“用户第一次点到第 3 块田时才补插记录”。
2. 首版直接把可预见田位初始化完，更利于前端和后台排障。

## 5. PlayerSeedInventory

建议初始化：

1. starter seed 对应库存
2. 初始已解锁种子条目

### 原则

1. 这是玩家私有状态，不属于全局 seed。
2. 只初始化需要的条目，不必一次为全部 13 个种子都插零值，除非你希望查询更稳定。

### 我的建议

首版更稳的做法是：

1. 对所有“首批可能展示到图鉴与背包”的种子都插一条 inventory 记录。
2. 数量可以为 0。
3. unlockedAt 仅对已解锁种子写值。

这样好处是：

1. 背包与图鉴查询更简单。
2. 不需要一边查定义，一边猜玩家是否“尚无记录但其实数量为 0”。

## 6. PlayerDailyTaskState

建议：

1. 如果首版每日任务就是按“登录时当天生成”，则初始化时直接生成当天任务。
2. 如果后续准备由 DailyTaskRefreshWorker 统一生成，也至少要明确首次登录那天怎么补首日任务。

### 原则

1. 不要让新玩家首登后首页 dailyTasks 为空，而是靠第二天刷新才出现。

## 7. 其他玩家级标记

至少要明确落点：

1. starterSeedClaimed
2. tianjiTalismanClaimed
3. 新手奖励领取状态
4. 新手引导状态

### 建议

首版如果不想单独建 PlayerRewardState / PlayerBootstrapState 表，也至少要有一张轻量玩家引导/奖励状态表来承载这些字段。

不要把这几个字段长期硬塞在接口拼装层或内存变量里。

## 五、推荐初始化顺序

PlayerInitializationService 建议在单事务里按下面顺序执行：

1. Player 根信息补齐摘要字段
2. PlayerWallet
3. PlayerBuilding
4. PlayerArmy
5. PlayerFieldSlot
6. PlayerSeedInventory
7. 玩家奖励/引导状态
8. PlayerDailyTaskState

### 为什么是这个顺序

1. Wallet、Building、Army 是所有页面摘要的最小基础。
2. Field 和 SeedInventory 要依赖种子主数据已存在。
3. DailyTaskState 可能依赖当前城堡、田地、阵营等初始化结果。

## 六、初始化必须保持幂等

建档初始化必须满足：

1. 同一个 player 重复调用不会重复发 starter 资源。
2. 同一个 player 不会重复插入 PlayerWallet 等唯一状态表。
3. 初始化半途失败时，下次可以安全重试。

### 推荐策略

1. 用事务包裹整个初始化。
2. 对一对一状态表依赖 playerId 唯一约束。
3. 引入 `playerInitializedAt` 或等价标记字段。
4. 初始化完成后再标记为 initialized。

### 不推荐策略

1. 先插一半表，依赖“代码约定认为已经建档完成”。

## 七、建议明确一张初始化状态表或标记字段

首版至少二选一：

## 做法 A：Player 表加初始化标记

例如：

1. initializationStatus
2. initializedAt

## 做法 B：单独 PlayerBootstrapState

例如：

1. playerId
2. initializedAt
3. starterSeedClaimed
4. tianjiTalismanClaimed
5. onboardingStep

### 我的建议

如果你后面还会继续扩展：

1. 新手引导
2. 新手奖励
3. 一次性礼包

那更推荐做法 B。

## 八、首批测试账号方案

为了让 AI 后面能稳定联调，不要只准备一个账号。

建议至少准备下面 4 类测试账号。

## 1. 新手账号

用途：

1. 验证首次登录建档。
2. 验证 starter seed。
3. 验证初始建筑、初始田地、初始任务。

建议状态：

1. 主城低级
2. 只有前几块田开放
3. 只有基础种子解锁
4. 无训练队列
5. 无掠夺历史

## 2. 主循环账号

用途：

1. 验证 building / farm / army 主循环。
2. 验证 claim-pending、collect-field、start-cultivation、upgrade-building。

建议状态：

1. 主城中等级
2. 有多块田开放
3. 有成熟田、成长田、空闲田混合状态
4. 有一定金币和灵宠
5. 有 1 到 2 条已完成或可领任务

## 3. 掠夺目标账号

用途：

1. 验证 raid target pool。
2. 验证单人抢夺和通缉。
3. 验证战报读取。

建议状态：

1. 暴露收益较高
2. 有可掠田地
3. 战力清晰高于/低于主循环账号一档
4. 可用于生成保护期和复仇场景

## 4. 后台排障账号

用途：

1. 验证 admin/debug 页面。
2. 验证异常状态排查。

建议状态：

1. 带有待领取分红
2. 带有训练队列
3. 带有近期掠夺记录
4. 带有一条可复现问题的混合状态

## 九、测试账号生成策略

建议分两层。

## 1. dev-login 账号声明层

例如：

1. `dev-newbie`
2. `dev-main-loop`
3. `dev-raid-target-a`
4. `dev-admin-debug`

## 2. 账号状态装载层

建议由：

1. dev-only seed scripts
2. 或 dev-only account bootstrap service

来负责把这些账号初始化成预期状态。

### 原则

1. 这些账号只在 development / test 环境可生成。
2. 生产环境不自动创建。

## 十、测试账号不要和正式 seed 混在一起

这是必须分开的。

### 全局 seed 负责

1. Faction
2. SeedDefinition
3. GlobalItemDefinition

### 测试账号脚本负责

1. 创建 dev 身份
2. 初始化指定 player 状态
3. 批量插入示例 field / army / raid 状态

### 原因

1. 全局 seed 应允许线上重复执行。
2. 测试账号数据只服务本地和测试联调。

## 十一、推荐最小验收路径

当“建档与测试账号方案”进入可执行状态时，至少要能验证下面 4 条路径：

1. 新玩家第一次 dev-login 后，自动完成初始化，能正常打开 bootstrap + home-summary + scene-content。
2. 重复登录同一账号，不会重复发 starter 资源。
3. 主循环账号可以直接验证 building、farm、army 三个页面和关键写链路。
4. 掠夺目标账号能够出现在 raid target pool，并能生成战报与保护期场景。

## 十二、AI 执行顺序建议

如果后面让 AI 开始落这块，推荐顺序是：

1. 先补初始化状态表或标记字段方案。
2. 再生成 PlayerInitializationService 规划或实现。
3. 再生成新手账号初始化路径。
4. 再生成主循环与掠夺测试账号脚本。
5. 最后补 admin/debug 专用异常样例账号。

## 十三、AI 执行模板

### 1. 生成 PlayerInitializationService

你现在只负责生成 PlayerInitializationService 或等价方案。请严格按 [dev/ai-backend-player-initialization-and-test-accounts-plan.md](dev/ai-backend-player-initialization-and-test-accounts-plan.md) 初始化玩家私有状态。不要顺手生成全局 seed 主数据。

### 2. 生成新手账号初始化路径

你现在只负责完成首次登录后的新手账号初始化闭环，包括 player root、wallet、building、army、field、seed inventory、starter reward 标记和当日任务。不要扩展到 raid 样例账号。

### 3. 生成 dev/test 测试账号脚本

你现在只负责生成 development/test 环境测试账号脚本。请区分新手账号、主循环账号、掠夺目标账号和后台排障账号，不要把这些逻辑塞进 prisma 全局 seed。

## 十四、验收清单

当这份方案被认为“足够支撑初始开发”时，至少应满足：

1. 玩家初始化由独立服务负责，而不是散落在登录流程里。
2. 必要的一对一状态表都有明确初值。
3. 首次建档支持事务与重试。
4. starter seed 和天机符标记有明确落点。
5. 新手任务不会在首登时缺失。
6. 至少有 4 类测试账号支撑后续联调。
7. 测试账号数据与全局 seed 主数据分离。
8. 后续 AI 能直接据此开始 auth + player root + player init 的第一批实现。

## 十五、最自然的下一份规划文档

如果还继续只写规划，不落代码，那么下一份最自然的是：

1. battle report 与 raid page 前端联调字段清单。
2. 管理后台首批只读视图与排障面板规划。
3. 首批 admin API 清单。

如果仍以 AI 实操优先，我更建议先写第 1 个。

因为 raid 订单和异步结算已经定了，接下来最容易卡住前后端联调的就是：战报页和掠夺页到底该以哪些字段为准，哪些是首批必出，哪些可以后补。