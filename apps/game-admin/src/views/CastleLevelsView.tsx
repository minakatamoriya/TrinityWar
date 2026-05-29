import type { AdminListResponse } from '@trinitywar/shared';
import { TableSection } from '../components/TableSection';
import type { AdminRecord } from '../types';

type LightweightRuleTab = 'land-deed' | 'faction-stipend';

const ruleTabs: Array<{ key: LightweightRuleTab; label: string; description: string }> = [
  { key: 'land-deed', label: '地契任务', description: '按累计收菜、成功掠夺、阵营上缴和个人贡献推进开田，不再要求法术或建筑升级。' },
  { key: 'faction-stipend', label: '俸禄等级', description: '按个人阵营贡献分档，发放植物精华、兽魂和高贡献灵宠精魄。' },
];

export function CastleLevelsView(props: {
  busy: string;
  levels: AdminListResponse<AdminRecord> | null;
  activeTab: LightweightRuleTab;
  onTabChange: (tab: LightweightRuleTab) => void;
  onRefresh: () => void;
}): JSX.Element {
  const activeTab = ruleTabs.find((tab) => tab.key === props.activeTab) ?? ruleTabs[0];
  const rows = (props.levels?.items ?? []).filter((item) => item.ruleGroup === activeTab.key || item.type === activeTab.key);

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Readonly</p>
            <h3>首发轻量规则</h3>
          </div>
          <button className="primary-button" disabled={props.busy === 'castle-levels'} onClick={props.onRefresh} type="button">刷新</button>
        </div>
        <div className="tab-list admin-section-tabs" role="tablist" aria-label="轻量规则分类">
          {ruleTabs.map((tab) => (
            <button
              className={`tab-button${activeTab.key === tab.key ? ' active' : ''}`}
              key={tab.key}
              onClick={() => props.onTabChange(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="panel-note">{activeTab.description}</p>
      </section>
      <TableSection
        title={activeTab.label}
        columns={[
          { label: '键 / key', key: 'key' },
          { label: '名称 / title', key: 'title' },
          { label: '条件 / requirements', key: 'requirements' },
          { label: '成本 / cost', key: 'cost' },
          { label: '效果 / effect', key: 'effect' },
          { label: '奖励 / rewards', key: 'rewards' },
        ]}
        rows={rows}
      />
    </div>
  );
}
