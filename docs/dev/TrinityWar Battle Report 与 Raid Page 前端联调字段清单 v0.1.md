# TrinityWar Battle Report 与 Raid Page 前端联调字段清单 v0.1

## 一、文档目的

这份文档是给 AI 和开发执行用的 battle report 与 raid page 前端联调字段清单。

前面的文档已经把：

1. raid 玩法边界
2. raid order 与 settlement
3. raid target 接口契约
4. 读接口切换策略

都定得比较清楚了。

但真正开始联调 raid page 和 report page 时，还会立刻遇到一个问题：

1. 现在前端组件到底需要哪些字段。
2. 哪些字段是首批必须真实提供的。
3. 哪些字段可以先沿用当前 DTO 形状。
4. 哪些字段以后可以再拆细或补详情。

这份文档的目标，就是把 raid page、raid intel、report list 三块前端联调所需字段列成可执行清单，让后端和前端在第一轮联调时不要各自猜结构。

本文件默认与下面文档配套使用：

1. 接口契约：[dev/TrinityWar 首批真实接口契约清单 v0.1.md](dev/TrinityWar 首批真实接口契约清单 v0.1.md)
2. 读接口切换计划：[dev/TrinityWar 首批读接口联调切换计划 v0.1.md](dev/TrinityWar 首批读接口联调切换计划 v0.1.md)
3. 掠夺订单与异步结算：[dev/TrinityWar 掠夺订单与异步结算专项设计 v0.1.md](dev/TrinityWar 掠夺订单与异步结算专项设计 v0.1.md)
4. shared DTO 基线：[packages/shared/src/index.ts](packages/shared/src/index.ts)
5. 当前前端组件：[apps/game-client/src/ui/raid/RaidScene.tsx](apps/game-client/src/ui/raid/RaidScene.tsx)
6. 当前前端组件：[apps/game-client/src/ui/raid/RaidIntelScreen.tsx](apps/game-client/src/ui/raid/RaidIntelScreen.tsx)
7. 当前前端组件：[apps/game-client/src/ui/scenes/ReportScene.tsx](apps/game-client/src/ui/scenes/ReportScene.tsx)
8. 当前前端组件：[apps/game-client/src/ui/ReportCard.tsx](apps/game-client/src/ui/ReportCard.tsx)

## 二、先给结论：第一轮联调不要急着改 shared DTO 形状

首版最稳的策略是：

1. 先沿用当前 shared DTO 形状。
2. 后端尽量把真实数据库数据映射成现有字段。
3. 只在首批明确缺失、且前端已经确实需要时，才补少量新字段。

换句话说：

1. 先让 raid page 和 report page 真正吃到数据库数据。
2. 不要在第一轮联调时一边切真实库，一边大规模改 DTO。

## 三、当前页面结构实际分成 3 块

## 1. Raid Target List

当前主要由：

1. [apps/game-client/src/ui/raid/RaidScene.tsx](apps/game-client/src/ui/raid/RaidScene.tsx)
2. [apps/game-client/src/ui/raid/RaidTargetCard.tsx](apps/game-client/src/ui/raid/RaidTargetCard.tsx)

负责。

## 2. Raid Intel Screen

当前主要由：

1. [apps/game-client/src/ui/raid/RaidIntelScreen.tsx](apps/game-client/src/ui/raid/RaidIntelScreen.tsx)
2. [apps/game-client/src/ui/farm/FarmStatusCard.tsx](apps/game-client/src/ui/farm/FarmStatusCard.tsx)

负责。

## 3. Report List / Report Hub

当前主要由：

1. [apps/game-client/src/ui/scenes/ReportScene.tsx](apps/game-client/src/ui/scenes/ReportScene.tsx)
2. [apps/game-client/src/ui/ReportCard.tsx](apps/game-client/src/ui/ReportCard.tsx)

负责。

## 四、首批必须打通的 shared DTO

shared 里当前最关键的是这 4 个类型：

1. `ClientRaidTarget`
2. `ClientRaidTargetDetailResponse`
3. `ClientRaidActionResponse`
4. `ClientReportEntry`

第一轮真实联调时，后端至少要能稳定产出这 4 类对象。

## 五、ClientRaidTarget 首批字段清单

用于：

1. 目标列表卡片
2. report hub 中的可掠目标页签

### 首批必须有

1. id
2. playerName
3. faction
4. level
5. powerText
6. goldText
7. cropText
8. riskLabel
9. badge
10. action

### 建议后端真实来源

1. id：RaidTargetPool.id 或稳定 target row id
2. playerName：target player snapshot
3. faction：target faction snapshot
4. level：castle snapshot
5. powerText：target battle power snapshot
6. goldText：当前可抢金币展示值
7. cropText：当前可抢田地收益展示值
8. riskLabel：由后端按当前风控规则计算
9. badge：如“高价值”“可复仇”“保护中即将结束”等展示标签

### 首批可以不加

1. 详细掉落概率
2. 复杂战斗系数拆解
3. 全资产明细

## 六、ClientRaidTargetDetailResponse 首批字段清单

用于：

1. Raid intel 二级详情页
2. 发起 raid/revenge 前确认

### 首批必须有

1. targetId
2. playerName
3. faction
4. castleLevel
5. battlePower
6. raidableGold
7. fieldPreviewTone
8. raidRule
9. protectedUntil 或 protectionStatus
10. revengeAvailable
11. fields 预览数组
12. actionLabel / actionState

### fields 预览数组首批必须有

每块田至少应有：

1. id
2. tone
3. title
4. badge
5. cropName
6. progressRemainingSeconds
7. progressTotalSeconds
8. yieldGold
9. description

### 建议后端真实来源

1. 来自 RaidTargetPool 快照 + defender 当前可见字段
2. 不要求读取防守方全部真实内部状态
3. 但必须与订单发起时可见信息基本一致

### 首批必须保证的语义

1. 玩家看到的详情必须和可发起 raid 的资格一致。
2. 不能出现详情说可打，但提交时立即变成完全无关状态。
3. 如果目标刚过期，应该明确返回错误，不是假详情。

## 七、ClientRaidActionResponse 首批字段清单

用于：

1. raid 提交后的结果反馈
2. 首页与场景刷新

### 当前已存在核心字段

1. targetId
2. targetName
3. goldLoot
4. depositedGold
5. overflowGold
6. temporaryClaimExpiresAt
7. casualties
8. rewards
9. protectedUntil
10. reportSummary

### 首批建议新增但不强制

1. orderId
2. settlementStatus
3. reportIdList 或 primaryReportId
4. settleMode

### 为什么建议补

因为后续如果你要从同步 QUICK_SETTLE 过渡到 ASYNC_SETTLE，没有 orderId 和 settlementStatus 会很难串起来。

## 八、ClientReportEntry 首批字段清单

用于：

1. 战报列表卡片
2. report hub
3. 复仇入口

### 首批必须有

1. id
2. title
3. summary
4. tone
5. tag
6. timeText
7. action

### 强烈建议补的字段

1. reportType
2. result
3. opponentName
4. opponentFaction
5. goldDelta
6. casualties
7. revengeAvailable
8. raidOrderId

### 为什么建议补

因为当前前端卡片虽然能先只靠 title/summary 渲染，但后续如果要做：

1. 筛选 attack / defense
2. 高亮胜负
3. 复仇快捷入口

这些字段迟早都会要。

## 九、ReportScene 首批联调字段清单

当前 report hub 至少分成：

1. targets
2. follows
3. reports
4. warrants

### 第一轮联调建议

只保证下面三块真实可用：

1. `targets`
2. `reports`
3. `revenge` 入口所需最小字段

### 可以暂时继续 mock 或后补

1. follows
2. warrants 的完整社交扩展内容

### 原因

1. `targets` 和 `reports` 是主循环刚需。
2. `follows` 和 `warrants` 更偏二阶段增强。

### 目标列表的关注按钮口径

1. `targets` 页的每张目标卡都应显示关注按钮。
2. 未关注时按钮文案为“关注”；已关注时按钮文案为“取消关注”，并在卡片上标明“已关注”。
3. 点击关注只切换本地关注状态，不等同于刷新整个目标列表。
4. 关注列表只展示已关注目标的汇总行，方便二次进入详情。

## 十、战报页首批展示与后端字段映射建议

## 1. 卡片标题

建议后端直接产出 title。

例如：

1. 你成功掠夺了 烬牙
2. 玄潮掠夺了你的丰熟田

### 原因

首版不值得让前端再拼复杂文案。

## 2. 摘要

建议后端直接产出 summary。

例如：

1. 掠得 320 金币，阵亡 2 灵宠，目标进入保护期。

## 3. 标签

建议首批统一后端产出 tag。

例如：

1. 单人抢夺
2. 复仇成功
3. 通缉结算
4. 防守失利

## 4. 颜色语义

建议保留当前 `tone`，后端根据结果给出：

1. success
2. danger
3. warning
4. neutral

具体命名以现有 shared 为准。

## 十一、raid page 首批联调顺序

建议顺序如下：

1. 先打通 ClientRaidTarget 列表
2. 再打通 ClientRaidTargetDetailResponse
3. 再打通 ClientRaidActionResponse
4. 最后打通 ClientReportEntry 与 report list

### 原因

1. 先有目标列表，才能选人。
2. 先有 intel detail，才能确认是否打。
3. 先有 action response，才能闭合操作反馈。
4. 最后补 report list，才能形成完整沉淀。

## 十二、和 QUICK_SETTLE / ASYNC_SETTLE 的前端联调边界

## QUICK_SETTLE

前端首批最简单路径：

1. 点击掠夺
2. 立刻返回结果
3. 刷新 home + scenes
4. 战报列表立即可见新条目

## ASYNC_SETTLE

前端必须预留：

1. orderId
2. settlementStatus
3. 等待中态文案
4. 重新拉取 reports / raid section 的刷新入口

### 建议

即使首版先启用 QUICK_SETTLE，也建议 response 中尽早预留 orderId。

## 十三、battle report 与 raid page 的首批缺口清单

如果只看当前 shared 与前端现状，后端首轮联调最容易缺的字段是：

1. orderId
2. settlementStatus
3. reportType
4. revengeAvailable
5. protectionStatus / protectedUntil
6. 目标详情页的可见字段一致性

这几个字段建议优先补齐。

## 十四、AI 执行模板

### 1. 联调 RaidTarget 列表

你现在只负责把 `ClientRaidTarget[]` 对接到真实数据库读取链路。请严格按 [dev/TrinityWar Battle Report 与 Raid Page 前端联调字段清单 v0.1.md](dev/TrinityWar Battle Report 与 Raid Page 前端联调字段清单 v0.1.md) 的字段清单提供首批必要字段。不要顺手改 report list。

### 2. 联调 Raid Intel

你现在只负责把 `ClientRaidTargetDetailResponse` 对接到真实数据库读取链路。目标是让 [apps/game-client/src/ui/raid/RaidIntelScreen.tsx](apps/game-client/src/ui/raid/RaidIntelScreen.tsx) 不依赖 mock 也能完整渲染。不要顺手改 raid action。

### 3. 联调 battle report

你现在只负责把 `ClientReportEntry[]` 对接到真实数据库读取链路，并补齐首批推荐字段。不要顺手改 admin 接口。

## 十五、验收清单

当 raid page 与 battle report 的前端联调被认为“可开工”时，至少应满足：

1. RaidTarget 列表首批字段清晰。
2. Raid intel 首批字段清晰。
3. raid action response 与 order / settlement 结构能接上。
4. battle report 列表不再只依赖标题和摘要猜语义。
5. QUICK_SETTLE 和 ASYNC_SETTLE 两种模式下的前端最小所需字段都已明确。
6. 哪些 tabs 首批必须真、哪些可后补已经明确。

## 十六、最自然的下一份规划文档

如果还继续只写规划，不落代码，那么下一份最自然的是：

1. 管理后台首批只读视图与排障面板规划。
2. 首批 admin API 清单。
3. 运营修正与审计留痕规则。

如果仍以 AI 实操优先，我更建议先写第 1 个。

因为后台当前还只有一个非常薄的 overview 接口，而一旦真实数据库开始跑起来，你很快就会需要一组只读排障视图来帮你看玩家状态、订单状态和日志链路。

## 十七、Raid 详情与图鉴刷新规则

为了避免前端把“列表刷新”“当前目标刷新”“图鉴解锁”“属性窥视”混成一条链路，首版统一按下面口径执行：

1. 点击 raid 二级详情页的关闭按钮时，只刷新当前正在看的那个目标，不刷新整个目标列表。
2. 目标列表右上角的“刷新目标”按钮，才负责整表重拉与重新排序。
3. 深度窥视成功后，前端要立刻把当前目标的主宠卡面回写到详情和列表，避免左侧仍显示 unknown。
4. 如果关闭详情页时目标在后台已发生变化，则只回流刷新这个目标；其他目标不受影响。
5. 单目标刷新失败时，保留当前旧缓存，不打断列表浏览；下次重新打开该目标时再重新读取。

图鉴与属性的语义也一并固定如下：

1. 灵宠图鉴按“灵宠种类”全局解锁，一旦通过掉落或窥视解锁，同种灵宠以后都不再显示 unknown。
2. 深度窥视只负责本次对手的属性情报，退出后再次查看仍然按次数消耗。
3. 如果同一玩家换了阵容，出现了新的主宠，而该灵宠未解锁，则列表仍应显示 unknown，直到再次获得该灵宠图鉴或重新窥视。