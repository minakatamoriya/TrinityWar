# Trinity War Demo 整合规格 v0.1

## 一、文档目标

这份文档只服务一件事：

让 Trinity War 的第一版 demo 可以直接进入开发。

它不是完整产品说明书，而是把当前已经确定的玩法、技术、页面和开发边界压成一份可执行规格。

## 二、Demo 的一句话定义

做一个后端权威结算的微信小游戏 demo，验证下面这条最小闭环是否成立：

1. 玩家上线领取待领取收益。
2. 玩家处理外场收获、建筑升级、训练和补兵。
3. 玩家查看匿名目标并发起异步掠夺。
4. 玩家收到战报并决定是否复仇。
5. 玩家上缴金币，影响后续阵营分红与贡献榜。
6. 玩家因为分红、战报和榜单再次回流。

## 三、Demo 成功标准

本次 demo 主要验证五件事：

1. 玩家是否理解“金库保底，外场赚钱，余额冒险”这套经济心智。
2. 玩家是否愿意为了外场成熟、战报和分红反复上线。
3. 玩家是否能理解匿名掠夺、复仇、上缴和分红之间的关系。
4. 三阵营的首发差异是否足够有感知，但不至于破坏公平。
5. 小程序端是否能用较低成本跑通三阵营经营策略战争的核心闭环。

## 四、Demo 范围边界

### 1. 必做内容

1. 微信登录与玩家建档。
2. 三阵营选择。
3. 主城首页与领主简报。
4. 金币四态中的三种玩家直观状态：金库、外场、余额。
5. 主城税收与阵营分红的待领取机制。
6. 主城、金库、外场位、防守建筑升级。
7. 单兵种训练、伤兵恢复、基础防守配置。
8. 外场成长、成熟、收取和被掠夺结算。
9. 匿名掠夺、战报、免费复仇。
10. 金币上缴、贡献值、小时分红。
11. 掠夺榜、发展榜、贡献榜。

### 2. 暂不做内容

1. 多兵种体系。
2. 大地图与领土争夺。
3. 赛季大事件与复杂周战。
4. 复杂社交和聊天。
5. 复杂商城和完整付费系统。
6. 重战斗表现与长动画。
7. 复杂后台权限与运营系统。

## 五、Demo 版本切分

### 1. v0.1 跑通闭环版

目标：先让玩家可以登录、收取、升级、训练、掠夺、看战报。

包含：

1. 登录建档。
2. 阵营选择。
3. 主城首页。
4. 外场成长与收取。
5. 主城、金库、外场位升级。
6. 单兵种训练。
7. 匿名掠夺。
8. 基础战报。
9. 待领取税收与待领取分红。

### 2. v0.2 回流增强版

目标：把“被打后还会回来”和“上缴后还会持续关注”补齐。

新增：

1. 免费复仇。
2. 金币上缴。
3. 贡献值。
4. 小时分红领取记录。
5. 三张排行榜。
6. 新手保护与每日被掠夺上限。

建议开发时把 v0.1 和 v0.2 放在同一套架构里，但先按 v0.1 优先级实现。

## 六、核心玩法口径

### 1. 资产状态

玩家感知层只保留下面四种：

1. 金库：安全资金，负责升级、上缴和长期成长。
2. 外场：高收益暴露资金，承担成熟窗口与被掠风险。
3. 余额：战备暴露资金，训练和补兵前必须主动转入。
4. 待领取收益：税收和分红的未入账记录，不可消费、不可被掠夺。

### 2. 收益入账规则

1. 主城税收和阵营分红先进入待领取收益。
2. 待领取收益最多保留 24 小时。
3. 玩家主动领取后才进入金库。
4. 若金库空间不足，弹二次确认。
5. 点击取消则不领取。
6. 点击确认则按可承接部分入库，超出部分损失。

### 3. 扣费规则

1. 建设、外场投入、上缴默认从金库扣费。
2. 训练、补兵、强化必须先从金库转入余额，再从余额扣费。
3. 普通建设不会自动消耗余额。
4. 待领取收益不会自动抵扣任何花费。

### 4. 掠夺规则

1. 首发以匿名掠夺为主。
2. 复仇只针对最近 24 小时内攻击过自己的玩家。
3. 每日成功被掠夺次数有上限。
4. 同一目标有冷却。
5. 外场不是整块打空，而是掠走当前可收价值的一部分。
6. 余额可被掠夺，但有保护比例。

## 七、首批固定数值建议

这部分的作用不是一次做满 20 级，而是先给程序和测试一套能跑的首批值。

### 1. 主城首批等级范围

1. Demo 先开放主城 1 到 8 级。
2. 主城升级成本大于金库升级成本。
3. 主城 4 级后开始明显要求更高的金库容量和外场产出效率。

### 2. 金库首批等级范围

1. Demo 先开放金库 1 到 8 级。
2. 金库升级成本略低于主城升级成本。
3. 金库必须明显影响“能否一次领完待领取收益”和“能否承接大额外场收获”。

### 3. 外场首批规则

1. Demo 默认开放 1 个外场位。
2. 第二个外场位通过升级解锁。
3. 外场成长总时长先按短周期实现。
4. 成熟是默认最佳性价比，丰熟更赚但更危险，过熟开始衰减。

### 4. 战备首批规则

1. Demo 只做 1 种掠夺兵。
2. 训练成本高于恢复成本。
3. 恢复成本约为训练成本的一半。
4. 兵力不足时，先限制出征，不做复杂自动补位。

### 5. 阵营首批差异

直接采用当前最稳的一套：

1. 仙界：被掠损失 -10%，掠夺收益 -5%。
2. 魔界：掠夺收益 +10%，掠夺战损 +10%。
3. 人界：上缴贡献 +10%，贡献分红 +5%。

## 八、后端模块划分

后端建议保持单体 NestJS，但按模块拆分：

1. auth：微信登录、建档、会话。
2. player：玩家基础资料、阵营、新手保护。
3. economy：金库、余额、待领取收益、上缴、分红。
4. field：外场位、成长、成熟、收取、被掠。
5. building：主城、金库、外场位、防守建筑升级。
6. army：训练、伤兵恢复、可出征兵力。
7. raid：目标池、发起掠夺、复仇、冷却与保护。
8. report：战报生成、复仇资格、已读状态。
9. leaderboard：三榜刷新与读取。
10. job：小时分红、目标刷新、恢复结算、保护状态过期。
11. admin：最小后台和参数配置。

## 九、核心数据对象

### 1. player

至少包含：

1. playerId
2. nickname
3. faction
4. mainCityLevel
5. newbieProtectEndAt
6. createdAt

### 2. player_economy

至少包含：

1. vaultGold
2. vaultCapacity
3. balanceGold
4. balanceProtectedRatio
5. pendingIncomeGold
6. pendingIncomeExpireAt
7. lastTaxSettleAt
8. lastDividendSettleAt

### 3. player_field_slot

至少包含：

1. slotId
2. playerId
3. status
4. investedGold
5. currentHarvestValue
6. plantedAt
7. matureAt
8. peakAt
9. rottenAt

### 4. player_army

至少包含：

1. raiderTotal
2. raiderIdle
3. raiderMarching
4. raiderWounded
5. woundedRecoverEndAt

### 5. player_building

至少包含：

1. mainCityLevel
2. vaultLevel
3. fieldLevel
4. defenseLevel

### 6. raid_report

至少包含：

1. reportId
2. attackerId
3. defenderId
4. targetTypeSummary
5. lootGold
6. attackerLoss
7. defenderLoss
8. revengeAvailable
9. createdAt

### 7. contribution_log

至少包含：

1. logId
2. playerId
3. faction
4. donateGold
5. contributionPoint
6. createdAt

### 8. dividend_log

至少包含：

1. logId
2. playerId
3. hourBucket
4. baseDividendGold
5. contributionDividendGold
6. totalDividendGold
7. claimedAt

## 十、首批接口清单

### 1. 登录与初始化

1. POST /auth/wechat-login
2. POST /player/create
3. POST /player/select-faction
4. GET /player/home

### 2. 经济与收益

1. POST /economy/claim-pending-income
2. POST /economy/transfer-vault-to-balance
3. POST /economy/transfer-balance-to-vault
4. POST /economy/donate-gold
5. GET /economy/pending-income-history

### 3. 建筑与外场

1. POST /building/upgrade-main-city
2. POST /building/upgrade-vault
3. POST /building/upgrade-field
4. POST /building/upgrade-defense
5. POST /field/start-cultivation
6. POST /field/harvest
7. GET /field/list

### 4. 部队与战备

1. POST /army/train-raider
2. POST /army/recover-wounded
3. GET /army/status

### 5. 掠夺与战报

1. GET /raid/targets
2. POST /raid/attack
3. POST /raid/revenge
4. GET /report/list
5. POST /report/read

### 6. 分红与排行榜

1. GET /faction/status
2. GET /leaderboard/raid
3. GET /leaderboard/develop
4. GET /leaderboard/contribution

## 十一、前端页面清单

Demo 前端建议只保留下面 11 个页面：

1. 启动页
2. 登录授权页
3. 角色创建页
4. 阵营选择页
5. 主城首页
6. 建筑页
7. 农场页
8. 部队页
9. 掠夺页
10. 战报页
11. 阵营与排行榜页

更细的按钮、功能和跳转见独立文档 demo-ui-scene-flow.md。

## 十二、定时任务清单

### 1. 高频短周期

1. 刷新匿名目标池。
2. 处理伤兵恢复。
3. 处理保护状态到期。

### 2. 每小时

1. 结算主城税收至待领取收益。
2. 结算阵营分红至待领取收益。
3. 刷新三张排行榜快照。

### 3. 每日

1. 重置免费掠夺次数。
2. 重置免费复仇资格。
3. 清理过期目标与部分日志缓存。

## 十三、最小后台要求

内部后台首发只需要能做下面几件事：

1. 查看玩家当前状态。
2. 查看战报与分红日志。
3. 手动修正金币、兵力、建筑等级。
4. 调整基础参数。
5. 重跑定时任务或查看任务失败情况。

## 十四、开发顺序建议

### 1. 第一周

1. 登录建档。
2. 玩家主状态接口。
3. 主城首页骨架。
4. 主城、金库、外场基础表结构。

### 2. 第二周

1. 外场成长和收取。
2. 主城与金库升级。
3. 待领取收益和领取逻辑。
4. 单兵种训练。

### 3. 第三周

1. 匿名目标池。
2. 掠夺结算。
3. 战报。
4. 新手保护和基础冷却。

### 4. 第四周

1. 上缴与贡献。
2. 小时分红。
3. 三张榜单。
4. 数据埋点和后台最小功能。

## 十五、埋点与验证指标

首批必须埋的事件：

1. 登录成功。
2. 领取待领取收益。
3. 外场开始培育。
4. 外场收取。
5. 主城升级。
6. 金库升级。
7. 训练兵力。
8. 发起掠夺。
9. 掠夺成功。
10. 点击复仇。
11. 上缴金币。
12. 领取分红。

首批必须看的指标：

1. 小时分红领取率。
2. 人均每日掠夺次数。
3. 被掠夺后次日回流率。
4. 上缴行为发生率。
5. 金库升级率。
6. 全服金币净增长率。

## 十六、Demo 开工前最后拍板项

真正会卡开发的只剩下面四件事：

1. 主城 1 到 8 级固定数值表。
2. 金库 1 到 8 级固定数值表。
3. 训练与恢复成本表。
4. 上缴转贡献与小时分红的第一版固定公式。

如果这四项拍板，demo 就可以正式进入程序开发。