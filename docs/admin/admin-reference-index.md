# TrinityWar 后台开发参考文档索引 v0.1

## 一、目标

这份文档用于确认后台管理系统开发需要依赖哪些文档，以及现在是否已经足够开工。

## 二、后台开发必须具备的参考文档

### 1. 后台职责范围说明

用途：

1. 防止后台和客户端功能边界混乱。
2. 确认后台是内部管理工具，不是对外 API 文档系统。

当前来源：

1. docs/design/wechat-minigame-tech-solution.md

状态：已具备

### 2. 后台要管理的业务对象清单

用途：

1. 确认需要哪些菜单和查询页。
2. 确认要能看哪些玩家、阵营、战报、活动和数值对象。

当前来源：

1. docs/design/simple-game-design.md
2. docs/design/launch-store-and-vip-table.md
3. docs/design/launch-monetization-and-payment-plan.md
4. docs/design/player-daily-task-rules.md

状态：部分具备

当前缺口：

1. 还没有把后台菜单按模块整理成单独文档。

### 3. 后台接口文档

用途：

1. 给后台前端联调。
2. 明确 overview、玩家查询、配置调整、公告发布等接口。

当前来源：

1. services/game-server 的 Swagger 文档
2. dev/ai-admin-api-contract-plan.md

状态：首批只读接口已具备规划，写操作接口仍未补齐

### 4. 审计与操作记录规则

用途：

1. 明确哪些后台操作必须留痕。
2. 明确哪些修改需要写操作日志和原因。

当前来源：暂无

状态：缺失

## 三、当前结论

后台文档已经足够支撑首批只读排障后台与第一批 admin 接口实现，但还不够直接做完整运营后台。

当前最需要补的是：

1. 审计日志规则。
2. 后台写操作权限与修正规则。
3. admin 页面信息架构与线框清单。
