import type { NavItem } from '../types';

export const navItems: NavItem[] = [
  { key: 'dashboard', label: '总览', description: '后台入口与关键状态' },
  { key: 'player', label: '玩家信息', description: '身份、钱包、灵宠、田地' },
  { key: 'order', label: '订单排查', description: '单个掠夺订单详情' },
  { key: 'notifications', label: '系统通知', description: '全服通知和单玩家站内信' },
  { key: 'season', label: '赛季', description: '赛季状态、快照与历史记录' },
  { key: 'shareAssist', label: '助力记录', description: '邀请、助力和奖励绑定只读排查' },
  { key: 'robotTest', label: '机器人测试', description: '日常操作模拟与动作日志' },
  { key: 'spiritConfig', label: '灵宠管理', description: '新增、编辑、删除灵宠定义' },
  { key: 'seedConfig', label: '植物管理', description: '新增、编辑、删除植物定义' },
  { key: 'taskConfig', label: '任务模块', description: '新手任务与贡献值设定' },
  { key: 'castleLevels', label: '轻量规则', description: '查看俸禄等级' },
  { key: 'system', label: '系统状态', description: '环境、依赖与开关' },
];
