export function buildActionMessage(label: string, context?: string): string {
  const subject = context ? `当前目标：${context}。` : '';

  if (label.includes('领取')) {
    return `${subject}该操作会先走收益确认，再把可承接的部分并入当前库存。`;
  }

  if (label.includes('升级') || label.includes('修习')) {
    return `${subject}验证版先只确认入口、消耗文案和收益预期，具体数值以后端结算为准。`;
  }

  if (label.includes('上缴')) {
    return `${subject}上缴后会立即累积贡献值，并影响每日俸禄档位。`;
  }

  if (label.includes('说明') || label.includes('详情')) {
    return `${subject}这里先保留为说明弹窗，后续可以替换成更完整的二级信息面板。`;
  }

  if (label.includes('刷新')) {
    return `${subject}验证版先模拟目标刷新入口，后续再接真实目标池刷新接口。`;
  }

  return `${subject}该入口已经接入前端交互壳，后续可以继续补确认弹窗、接口联调和状态回写。`;
}
