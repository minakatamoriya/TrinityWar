# TrinityWar Cocos 页面拆分方案 v0.1

## 一、目标

这份文档只解决一件事：

把当前客户端的 6 个主模块拆成一套适合 Cocos Creator 3.8 LTS 落地的场景、Prefab、节点层级和组件挂载方案。

这不是视觉稿，也不是接口文档。

它的作用是让你打开 Cocos Creator 以后，不需要再思考“场景怎么搭、Prefab 怎么拆、脚本挂哪里”，可以直接开始搭工程。

## 二、当前推荐范围

当前先不做多场景切换。

建议首版只保留 1 个主场景：

1. `Main.scene`

所有主模块都在这个场景内切换页面 Prefab：

1. 主城
2. 建筑
3. 农场
4. 掠夺
5. 战报
6. 阵营

这样做的原因很直接：

1. 首发客户端是重 UI、轻场景表现。
2. 这 6 个模块本质上是同一套主界面容器内的切页，不值得一开始拆成 6 个独立场景。
3. 用 1 个场景 + 多个页面 Prefab，更适合微信小游戏首版快速迭代。

## 三、主场景层级

`Main.scene` 建议采用下面的节点结构：

1. `Main`
2. `Canvas`
3. `BgLayer`
4. `TopBarLayer`
5. `PageLayer`
6. `OverlayLayer`
7. `DockLayer`

建议说明：

1. `BgLayer` 只放背景图、氛围光、静态装饰，不挂业务脚本。
2. `TopBarLayer` 只放顶部模块标题和设置按钮。
3. `PageLayer` 是页面切换容器，只挂当前活动页面 Prefab。
4. `OverlayLayer` 统一放弹窗、确认框、浮层、红点提示、加载态。
5. `DockLayer` 固定放底部 6 个主入口。

不要让页面 Prefab 自己创建顶部栏和底部 dock。

## 四、主场景脚本挂载

主场景建议只挂一个总控脚本：

1. `AppRoot`

`AppRoot` 负责：

1. 初始化客户端接口请求。
2. 挂载顶部栏和底部 dock。
3. 维护当前模块 key。
4. 负责页面 Prefab 的创建与销毁。
5. 后续接入弹窗管理器和全局提示管理器。

当前仓库里已经有脚本骨架：

1. `assets/scripts/core/AppRoot.ts`
2. `assets/scripts/ui/TopBarController.ts`
3. `assets/scripts/ui/BottomDockController.ts`
4. `assets/scripts/data/ClientApi.ts`

## 五、Prefab 拆分

建议按三层拆分。

### 1. 全局 Prefab

建议创建：

1. `TopBar.prefab`
2. `BottomDock.prefab`
3. `DialogRoot.prefab`
4. `Toast.prefab`
5. `Loading.prefab`

### 2. 通用 UI Prefab

建议创建：

1. `TwButtonPrimary.prefab`
2. `TwButtonSecondary.prefab`
3. `TwTabButton.prefab`
4. `TwMetricRow.prefab`
5. `TwInfoCard.prefab`
6. `TwListItem.prefab`
7. `TwSectionHeader.prefab`
8. `TwEmptyState.prefab`

### 3. 页面 Prefab

建议创建：

1. `HomePage.prefab`
2. `BuildingPage.prefab`
3. `FarmPage.prefab`
4. `RaidPage.prefab`
5. `ReportPage.prefab`
6. `FactionPage.prefab`

## 六、TopBar 拆分

`TopBar.prefab` 建议只保留下列节点：

1. `TitleLabel`
2. `SettingsButton`

不要在顶部栏里放：

1. 资源条
2. 战报入口
3. 主城大标题背景图
4. 多余装饰面板

原因：

1. 你已经明确要顶部更轻、更窄。
2. 这套产品首版信息重心应该在页面主体，不该被顶部吃掉高度。

建议尺寸：

1. 高度 `88`
2. 左右安全边距 `24`
3. 标题字号 `28`
4. 设置图标触发区 `44 x 44`

## 七、BottomDock 拆分

`BottomDock.prefab` 建议固定 6 个入口：

1. `Home`
2. `Building`
3. `Farm`
4. `Raid`
5. `Report`
6. `Faction`

每个入口节点统一结构：

1. `HitArea`
2. `Icon`
3. `Label`
4. `SelectedLine`

布局规则：

1. 整体宽度均分 6 份。
2. 每个按钮的可点击区单独占 `1/6`。
3. 图标和文字都在各自按钮内居中。
4. 选中态只做底线、描边或色彩变化，不做复杂大底板。

不要在 dock 里放复杂卡片式按钮。

原因：

1. dock 的职责是稳定导航，不是视觉主角。
2. 过厚的按钮形态会显得粗，且更容易造成点按误差感。

## 八、页面 Prefab 通用结构

每个页面 Prefab 建议统一结构：

1. `PageRoot`
2. `ScrollView` 或 `StaticContent`
3. `Header`
4. `Body`
5. `FooterActions`

通用要求：

1. 页面内容不直接贴边，左右安全边距建议 `24`。
2. 卡片内边距统一，建议 `16` 到 `20`。
3. 所有列表和内容块默认上对齐。
4. 页面说明性大段文案默认不保留。
5. 超长标题和超长标签必须裁切或省略。

## 九、六个页面的具体拆分

### 1. HomePage

建议结构：

1. `Header`
2. `ResourceSummaryCard`
3. `CastleStatusCard`
4. `QuickActionGrid`

说明：

1. 主城页是摘要页，不要堆太多说明文本。
2. 主城页负责承接资源、状态、快捷入口三件事。
3. 快捷入口建议做成 2 列或 3 列栅格，而不是一整列长按钮。

### 2. BuildingPage

建议结构：

1. `Header`
2. `UpgradeGrid`
3. `ConditionSummary`
4. `FooterActions`

说明：

1. `UpgradeGrid` 建议 2 列。
2. 每个升级项是一个统一 `TwInfoCard`，里面只有标题、当前等级、升级消耗、升级按钮。
3. 不保留长描述，解锁条件用短句或 tag 表示。

### 3. FarmPage

建议结构：

1. `Header`
2. `FieldList`
3. `IncomeCard`
4. `FooterActions`

说明：

1. 地块建议做成垂直列表，避免首版做复杂田块排布。
2. 每个地块项包含编号、状态、收益、按钮。
3. 倒计时单独做一行，不要塞进标题行里。

### 4. RaidPage

建议结构：

1. `Header`
2. `RaidTabs`
3. `TargetFilterBar`
4. `TargetList`
5. `TargetDetailCard`
6. `RallyList`
7. `FooterActions`

说明：

1. `RaidTabs` 首发建议至少包含 `可偷目标`、`围猎大厅`、`我的求助`、`复仇记录`。
2. 目标列表建议放上半区。
3. 当前选中目标的详情固定在下半区。
4. 目标项不要再只显示模糊收益，应该直接显示可抢果实值、暴露金币、守备风险和热度。
5. 目标卡需要预留 `单抢`、`围猎`、`表情` 三个操作入口。
6. `RallyList` 用于展示玩家发起的围猎令，包括目标、预计收益、参与人数和倒计时。
7. 结果反馈应优先播放入账和战损变化，不要把长文本战报放在第一层。

### 5. ReportPage

建议结构：

1. `Header`
2. `ReportTabs`
3. `ReportList`
4. `FooterActions`

说明：

1. 页签只保留 `防守` 和 `进攻`。
2. 每条战报项统一为标题、标签、摘要、按钮。
3. 红点和未读角标不要做得太大。

### 6. FactionPage

建议结构：

1. `Header`
2. `FactionTabs`
3. `OverviewPanel`
4. `DonatePanel`
5. `RankingPanel`

说明：

1. `FactionTabs` 只在同页内部切换，不走场景切换。
2. 总览、上缴、排行建议共用一个内容容器，只替换内部节点。
3. 排行面板优先做简单列表，不要首版做复杂图表。

## 十、建议的组件挂载关系

建议关系如下：

1. `Main.scene` 根节点挂 `AppRoot`
2. `TopBar.prefab` 根节点挂 `TopBarController`
3. `BottomDock.prefab` 根节点挂 `BottomDockController`
4. 各页面根节点挂 `ScenePage` 或其子类

后续如果继续细化，建议每页再加自己的控制器：

1. `HomePageController`
2. `BuildingPageController`
3. `FarmPageController`
4. `RaidPageController`
5. `ReportPageController`
6. `FactionPageController`

这些页面控制器只负责：

1. 接受 DTO 数据。
2. 刷新本页 UI。
3. 处理本页按钮事件。

不要负责：

1. 全局切页。
2. 顶部栏状态。
3. 弹窗总管理。

## 十一、资源目录建议

建议在 `assets` 下先按下面方式建目录：

1. `assets/art/common`
2. `assets/art/topbar`
3. `assets/art/dock`
4. `assets/art/cards`
5. `assets/art/buttons`
6. `assets/art/icons`
7. `assets/prefabs/common`
8. `assets/prefabs/layout`
9. `assets/prefabs/pages`
10. `assets/scenes`
11. `assets/scripts/core`
12. `assets/scripts/data`
13. `assets/scripts/pages`
14. `assets/scripts/ui`

## 十二、首周落地顺序

建议第一周按下面顺序推进：

1. 建 `Main.scene`
2. 做 `TopBar.prefab`
3. 做 `BottomDock.prefab`
4. 做 `HomePage.prefab`
5. 跑通 6 个模块切页
6. 抽 `TwButtonPrimary` 和 `TwInfoCard`
7. 再开始做建筑页和农场页

## 十三、当前结论

对于 TrinityWar 首发客户端，当前最佳做法不是“每个模块一个场景”，而是：

1. 1 个主场景
2. 6 个页面 Prefab
3. 2 个全局导航 Prefab
4. 1 套通用卡片和按钮 Prefab

这套结构最适合你现在这个阶段：

1. 刚迁移到 Cocos。
2. 需要快速重做 UI。
3. 希望界面更规整，而不是继续手写渲染细节。
