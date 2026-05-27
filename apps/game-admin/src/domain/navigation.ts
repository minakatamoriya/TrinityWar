import type { NavItem } from '../types';

export const navItems: NavItem[] = [
  { key: 'dashboard', label: '总览', description: '后台入口与关键状态' },
  { key: 'player', label: '玩家信息', description: '身份、钱包、领地、田地' },
  { key: 'order', label: '订单排查', description: '单个掠夺订单详情' },
  { key: 'notifications', label: '系统通知', description: '全服通知和单玩家站内信' },
  { key: 'spiritConfig', label: '灵宠管理', description: '新增、编辑、删除灵宠定义' },
  { key: 'seedConfig', label: '灵植管理', description: '新增、编辑、删除灵植定义' },
  { key: 'taskConfig', label: '任务模块', description: '新手、每日和阵营任务配置' },
  { key: 'castleLevels', label: '轻量规则', description: '查看地契、俸禄和法术配置' },
  { key: 'system', label: '系统状态', description: '环境、依赖与开关' },
];
