# TrinityWar Prisma Seed 与初始静态数据装载计划 v0.1

## 一、文档目的

这份文档是给 AI 和开发执行用的 Prisma seed 与初始静态数据装载计划。

前面的规划已经把 schema、migration、接口、service 分层、读接口切换、mock 退场、raid 订单这些主干都定得比较清楚了。

接下来真正开始落数据库时，最容易卡住 AI 的问题不是表结构，而是下面这些：

1. 哪些数据应该直接写在 migration 里。
2. 哪些数据应该通过 Prisma seed 装载。
3. 哪些数据属于玩家初始建档数据，不应该混进全局 seed。
4. 哪些数据适合继续保留在代码配置，不适合进数据库。
5. 种子定义、阵营基础配置、测试账号、starter reward、静态掉落池之间应该怎么分层。

这份文档的目标，就是把“静态数据”和“玩家运行态数据”的边界一次写清楚，避免后面 AI 把所有常量都塞进 migration，或者反过来把本该数据库持久化的东西继续硬编码在代码里。

本文件默认与下面文档配套使用：

1. Prisma/schema 规划：[dev/2026-05-18 首批数据库表与 Prisma Schema 草案 v0.1.md](dev/2026-05-18 首批数据库表与 Prisma Schema 草案 v0.1.md)
2. Migration 切分计划：[dev/2026-05-18 首批数据库 Migration 切分计划 v0.1.md](dev/2026-05-18 首批数据库 Migration 切分计划 v0.1.md)
3. 读接口切换计划：[dev/2026-05-18 首批读接口联调切换计划 v0.1.md](dev/2026-05-18 首批读接口联调切换计划 v0.1.md)
4. 前端 mock 退场计划：[dev/2026-05-18 前端 Mock 数据退场计划 v0.1.md](dev/2026-05-18 前端 Mock 数据退场计划 v0.1.md)
5. 农场设计主文档：[docs/design/2026-05-18 首发农场与金币曲线首稿 v0.1.md](docs/design/2026-05-18 首发农场与金币曲线首稿 v0.1.md)

## 二、先给结论：不要把所有静态数据都混成一种“配置”

首版至少要分成下面 4 层：

1. schema 结构层
2. 全局静态主数据层
3. 玩家建档初始化层
4. 开发/测试专用样例数据层

### 1. schema 结构层

例如：

1. SeedDefinition 表结构
2. Faction 表结构
3. PlayerSeedInventory 表结构

### 2. 全局静态主数据层

例如：

1. 种子定义
2. 阵营基础条目
3. 全局物品定义
4. 固定掉落池定义

### 3. 玩家建档初始化层

例如：

1. 新玩家初始种子库存
2. starterSeedClaimed 初始值
3. 天机符初始值
4. 初始建筑等级
5. 初始田地状态

### 4. 开发/测试样例数据层

例如：

1. 开发测试账号
2. 本地快速联调用高等级账号
3. 演示场景专用高价值 seed 库存

这 4 层不要混。

## 三、哪些数据必须走 Prisma seed

Prisma seed 最适合承载“环境初始化时必须存在，但不是某个玩家私有状态”的数据。

首版建议下面这些必须走 seed。

## 1. SeedDefinition

这是最应该走 seed 的一类。

### 原因

1. 它是全局主数据。
2. 会被图鉴、播种、收取、掉落、背包展示共同引用。
3. 当前前端临时种子表和设计文档里的种子经济表已经比较稳定。

### 首批建议字段来源

建议优先从 [docs/design/2026-05-18 首发农场与金币曲线首稿 v0.1.md](docs/design/2026-05-18 首发农场与金币曲线首稿 v0.1.md) 的首发种子表整理，而不是继续直接抄 [apps/game-client/src/api.ts](apps/game-client/src/api.ts) 里的临时常量。

### 首批建议至少装载 14 个种子

1. qinglingmai / 青灵麦
2. xunyamai / 风云稻
3. ninglucao / 凝露草
4. suixinhua / 碎心花
5. baiyulian / 白玉莲
6. yingyuezhu / 影月竹
7. qianjiteng / 牵机藤
8. huichuncao / 回春草
9. xueyuehua / 雪月花
10. jingdaosong / 劲道松
11. hundunguo / 混沌果
12. zhanqingsi / 斩情丝
13. wangchuanying / 忘川影
14. zhaoyouming / 照幽冥

### 这些字段建议直接入库

1. seedId
2. label
3. rarity 或 tier
4. supplyWeight
5. earlyHarvestGold
6. matureYieldGold
7. fullRipeYieldGold
8. witheredYieldGold
9. seedSeconds
10. growSeconds
11. matureWindowSeconds
12. harvestSeedReturnMature
13. harvestSeedReturnFullRipe
14. harvestSeedReturnWithered
15. strategyNote
16. lore
17. unlockOrder
18. enabled

### 说明

当前 schema 草案里的 SeedDefinition 还偏简。后续如果要让它真正替代前端临时种子表，建议把上面这些字段补齐，而不是只保留总时间和单个 harvestSeedReturn。

## 2. Faction 基础条目

Faction 也建议走 seed。

### 首批建议装载

1. 人界
2. 仙界
3. 魔界

### 建议入库字段

1. code
2. name
3. 初始 treasuryGold
4. hourlyBaseDividend
5. hourlyContributionDividendPerTen
6. enabled
7. sortOrder

### 原因

1. 阵营是全局主数据，不应该靠建档时临时创建。
2. 后面排行榜、分红、阵营页都依赖它。

## 3. GlobalItemDefinition 或等价全局物品定义

当前 shared DTO 已经有：

1. `globalItemInventory`
2. `starterSeedClaimed`
3. `tianjiTalismanClaimed`

这说明系统已经存在“种子之外的全局背包物品”概念。

### 首批建议

如果第一版不想把物品系统做很重，也至少要有一份全局物品定义主数据。

最少建议包含：

1. tianji_talisman
2. 未来扩展用的 reward token / debug token 占位

### 作用

1. 避免后面背包字段里出现“只有 string key，没有主数据定义”的松散结构。

## 4. TaskDefinition 或等价每日任务定义

当前 schema 草案只有 PlayerDailyTaskState，没有单独 TaskDefinition。

从首版实现速度看，这可以先不进数据库。

但如果你希望 AI 后面不要一直把任务定义硬编码在 service 里，我建议尽早补一个轻量静态定义层。

### 两种做法都可以

#### 做法 A：第一版先保留代码配置

适合：

1. 想更快推进主循环。
2. 任务类型仍在频繁调整。

#### 做法 B：第一版就做 TaskDefinition seed

适合：

1. 想让任务系统也尽快摆脱硬编码。
2. 希望每日任务刷新逻辑直接基于数据库主数据。

### 我的建议

第一版可以先保留代码配置，不必强推入库。

因为和种子相比，任务定义还更容易变。

## 四、哪些数据不应该走全局 seed，而应该走建档初始化

下面这些内容不要混进 Prisma 全局 seed，因为它们不是“系统固定主数据”，而是“每个新玩家都要生成一份自己的初始状态”。

## 1. 新玩家初始种子库存

例如：

1. 青灵麦 x3
2. 风云稻 x3

### 原因

1. 这是玩家私有状态。
2. 应该在建档 use case 中写入 PlayerSeedInventory，而不是在 seed 脚本中全局生成。

## 2. starterSeedClaimed 初始值

应属于：

1. PlayerRewardState
2. PlayerBootstrapState
3. 或先临时放在玩家背包/状态初始化逻辑中

### 原因

它是玩家级标记，不是全局主数据。

## 3. tianjiTalismanClaimed 初始值

同理，它应该是玩家级状态，不是全局 seed。

## 4. 初始建筑等级、初始田地状态、初始兵力

这些都应由建档逻辑负责创建：

1. PlayerBuilding
2. PlayerWallet
3. PlayerArmy
4. PlayerFieldSlot
5. PlayerSeedInventory

而不是由 seed 脚本替玩家批量插入。

## 5. 新手任务进度

这也应属于玩家初始化，不应属于全局静态数据。

## 五、哪些数据首版适合继续保留代码配置

不是所有静态东西都必须进数据库。

下面这些首版可以继续放在代码配置层，而不是强行建表。

## 1. battle formula 参数

例如：

1. 单人抢夺收益比例区间
2. 战损系数
3. 风险评级阈值

### 原因

1. 这部分仍然是平衡频繁调整区。
2. 第一版先放 domain/config 层更稳。

## 2. 某些掉落概率细节

例如 raid 额外掉种的概率表。

### 原因

1. 它们经常会在验证期快速改。
2. 第一版不一定值得马上进数据库。

### 但要注意

这不代表可以继续散落在前端 mock 里。

建议至少迁到后端统一配置文件或 domain 常量里。

## 3. UI 推荐语、说明文案

例如：

1. strategyNote 可进库。
2. 更偏页面运营文案的描述，不必强行都进库。

## 六、首批推荐装载内容清单

如果以“尽快支撑真实数据库联调”为目标，首批 Prisma seed 建议只装下面 4 类。

## 必装 1：Faction

条数：

1. 3 条

## 必装 2：SeedDefinition

条数：

1. 13 条

## 必装 3：GlobalItemDefinition 或最小物品定义

条数：

1. 1 到 3 条都可以

## 必装 4：可选的 SystemConfig / SeedPoolConfig 占位

如果你希望后面不再硬编码某些“全局开关”，可以先有一张非常轻量的配置表。

### 例如可放

1. starter_seed_pack_enabled
2. tianji_talisman_daily_enabled
3. raid_seed_drop_enabled

### 但也可以暂时不做

如果你想压缩首版复杂度，这一项可延后。

## 七、推荐 seed 文件分层

首版不要把所有插入语句都堆到一个巨大的 seed.ts 里。

建议至少分成下面几层。

## 1. seed-data/factions.ts

职责：

1. 只导出阵营主数据。

## 2. seed-data/seeds.ts

职责：

1. 只导出 13 个种子定义。
2. 成为后续替换前端临时种子常量的唯一后端主源。

## 3. seed-data/global-items.ts

职责：

1. 导出最小物品定义。

## 4. seed-data/dev-accounts.ts

职责：

1. 仅开发/测试环境下启用。
2. 不应默认在生产 seed 里运行。

## 5. prisma/seed.ts

职责：

1. 组织执行顺序。
2. 处理 upsert。
3. 按环境决定是否导入 dev-only 数据。

## 八、推荐 seed 执行策略

### 1. 全局主数据用 upsert

例如：

1. faction
2. seed definition
3. global item definition

### 原因

1. 重复执行安全。
2. 方便本地反复重建环境。
3. 方便 AI 后续增量追加字段。

### 2. 玩家测试账号不要默认全环境执行

建议：

1. 只在 development 和 test 环境下执行。
2. 生产环境默认跳过。

### 3. 种子定义不要依赖前端 mock 文件

当前 [apps/game-client/src/api.ts](apps/game-client/src/api.ts) 里已有临时种子收益和时间常量。

后续正确方向应是：

1. 后端 SeedDefinition 成为主源。
2. 前端改从真实 bootstrap / scene / codex 接口读取。
3. 前端临时常量逐步退场。

## 九、和 migration 的对齐建议

### 在 Migration 001 后

建议可执行：

1. faction seed

### 在 Migration 003 后

建议可执行：

1. 不需要新增太多主数据 seed
2. 重点是 player root + wallet/building/army 结构 ready

### 在 Migration 004 后

这是种子主数据 seed 的关键节点。

建议执行：

1. SeedDefinition seed
2. GlobalItemDefinition seed 如已建表

### 在 Migration 005 后

不以 seed 为主，但可以补：

1. starter reward config 占位
2. 任务奖励配置占位

### 在 Migration 006 后

可选补：

1. raid 掉落池配置
2. rare seed drop table

但这部分首版也可以仍保留在后端配置层。

## 十、建档初始化建议

为了避免 seed 和 player init 混淆，建议明确一个 PlayerInitializationService。

### 它负责创建

1. PlayerWallet 初始值
2. PlayerBuilding 初始值
3. PlayerArmy 初始值
4. PlayerFieldSlot 初始值
5. PlayerSeedInventory 初始值
6. starter reward / tianji talisman 初始标记
7. 玩家默认阵营挂载或待选阵营状态

### 它不负责创建

1. 全局种子定义
2. 全局阵营定义
3. 全局物品定义

## 十一、推荐首批测试账号与样例数据策略

如果后面要支持 AI 自己做联调验证，建议单独保留开发测试数据层，但不要混进正式 seed 主路径。

### 推荐三类 dev 账号

1. 新手账号
2. 中期运营账号
3. 高价值掠夺目标账号

### 作用

1. 新手账号验证建档和 starter seed。
2. 中期账号验证 building/field/army 主循环。
3. 高价值掠夺目标账号验证 raid 和 rare seed 掉落。

### 原则

1. 只在 dev/test 环境生成。
2. 不和正式 seed 主数据混在同一执行分支里。

## 十二、当前前端临时种子表的退场建议

当前 [apps/game-client/src/api.ts](apps/game-client/src/api.ts) 里至少存在：

1. seedLabelMap
2. mockSeedStageGold
3. mockSeedStageSeconds
4. target raid seed rewards 的临时掉落表

这些数据当前能说明：

1. 前端已经有一套“近似正式”的种子定义。
2. 但它还属于 mock/runtime 层，不应该继续作为长期主源。

### 正确退场顺序

1. 先在后端 SeedDefinition 中建立正式主数据。
2. 再让真实接口把种子相关字段吐给前端。
3. 最后按 [dev/2026-05-18 前端 Mock 数据退场计划 v0.1.md](dev/2026-05-18 前端 Mock 数据退场计划 v0.1.md) 逐步移除前端临时种子表。

## 十三、AI 执行顺序建议

如果后面让 AI 逐步落这部分，推荐顺序是：

1. 先确定 SeedDefinition 最终字段清单。
2. 再生成 faction / seed / global-item 的主数据 seed 文件。
3. 再生成 PlayerInitializationService 规划或实现。
4. 再补 dev/test 专用账号与样例数据。
5. 最后再清理前端临时种子常量依赖。

## 十四、AI 执行模板

### 1. 生成 SeedDefinition seed 数据

你现在只负责生成 SeedDefinition 的主数据 seed 文件。请以 [docs/design/2026-05-18 首发农场与金币曲线首稿 v0.1.md](docs/design/2026-05-18 首发农场与金币曲线首稿 v0.1.md) 为主来源，以 [dev/2026-05-23 Prisma Seed 与初始静态数据装载计划 v0.1.md](dev/2026-05-23 Prisma Seed 与初始静态数据装载计划 v0.1.md) 为执行边界。不要顺手生成 PlayerSeedInventory 初始化逻辑。

### 2. 生成全局主数据 seed

你现在只负责生成 faction、global item 等全局主数据 seed。要求使用 upsert，允许重复执行，不要生成开发测试账号。

### 3. 生成玩家初始化方案

你现在只负责生成 PlayerInitializationService 或等价方案，负责创建玩家私有初始状态。不要把这些逻辑塞进 prisma seed.ts。

### 4. 校验静态数据分层

你现在只负责检查当前静态数据是否分对层了。请逐项判断：哪些应进 seed，哪些应留代码配置，哪些应放 player init，哪些只是 dev fixture。

## 十五、验收清单

当 Prisma seed 与初始静态数据方案被认为“可执行”时，至少要满足：

1. SeedDefinition 已明确属于全局 seed 主数据。
2. Faction 已明确属于全局 seed 主数据。
3. 玩家初始种子库存不再被误归类为全局 seed。
4. starterSeedClaimed / tianjiTalismanClaimed 被明确归为玩家初始化状态。
5. 首批不必入库的配置项已经明确，不再继续混在前端 mock 中长期存在。
6. seed 执行支持重复运行，不依赖一次性人工插入。
7. dev/test 样例账号数据和正式主数据分离。
8. 后续前端临时种子表具备可退场路径。

## 十六、最自然的下一份规划文档

如果还继续只写规划，不落代码，那么下一份最自然的是：

1. 后端初始建档与首批测试账号方案。
2. battle report 与 raid page 前端联调字段清单。
3. 管理后台首批只读视图与排障面板规划。

如果仍以 AI 实操优先，我更建议先写第 1 个。

因为静态主数据、migration、接口、mock、raid 这些骨架都已经逐步齐了，接下来 AI 真正落地时，第一个会频繁碰到的就是：玩家第一次登录后，到底要初始化哪些状态、怎样准备测试账号、怎样快速做联调验证。