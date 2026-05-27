import type { AdminListResponse } from '@trinitywar/shared';
import { ConfigEditorPanel } from '../components/ConfigForm';
import { Modal } from '../components/Modal';
import { TableSection } from '../components/TableSection';
import { taskConfigFields } from '../domain/config';
import type { AdminRecord } from '../types';

export type TaskConfigGroup = 'starter' | 'daily' | 'daily-faction';

const groupOptions: Array<{ key: TaskConfigGroup; label: string }> = [
  { key: 'starter', label: '新手任务' },
  { key: 'daily', label: '普通每日任务' },
  { key: 'daily-faction', label: '每日阵营任务' },
];
const editableTaskConfigFields = taskConfigFields.filter((field) => field.key !== 'taskGroup');

export function TaskConfigView(props: {
  busy: string;
  definitions: AdminListResponse<AdminRecord> | null;
  editingId: string;
  form: Record<string, string>;
  group: TaskConfigGroup;
  isEditorOpen: boolean;
  onCancelEdit: () => void;
  onEdit: (row: AdminRecord) => void;
  onFieldChange: (field: string, value: string) => void;
  onGroupChange: (group: TaskConfigGroup) => void;
  onRefresh: () => void;
  onSave: () => void;
}): JSX.Element {
  const rows = (props.definitions?.items ?? []).map((item) => ({
    ...item,
    taskGroupLabel: groupOptions.find((option) => option.key === item.taskGroup)?.label ?? item.taskGroup,
    sourceLabel: item.source === 'override' ? '已覆盖' : '默认',
    enabledLabel: item.isEnabled ? '启用' : '停用',
  }));
  const isBusy = props.busy === 'task-list' || props.busy === 'task-save';

  return (
    <>
      <div className="view-stack">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Task Config</p>
              <h3>任务配置</h3>
            </div>
            <div className="action-group">
              <select value={props.group} onChange={(event) => props.onGroupChange(event.target.value as TaskConfigGroup)}>
                {groupOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
              <button disabled={isBusy} type="button" onClick={props.onRefresh}>刷新列表</button>
            </div>
          </div>
        </section>

        <TableSection
          title="任务列表"
          columns={[
            { label: '分类', key: 'taskGroupLabel' },
            { label: '任务 ID', key: 'taskId' },
            { label: '标题', key: 'title' },
            { label: '目标类型', key: 'objectiveType' },
            { label: '目标数量', key: 'targetCount' },
            { label: '金币', key: 'rewardGold' },
            { label: '贡献', key: 'rewardContribution' },
            { label: '状态', key: 'enabledLabel' },
            { label: '来源', key: 'sourceLabel' },
          ]}
          rows={rows}
          rowAction={(row) => (
            <div className="action-group">
              <button className="small-button" type="button" onClick={() => props.onEdit(row)}>编辑</button>
            </div>
          )}
        />
      </div>

      {props.isEditorOpen ? (
        <Modal
          title="编辑任务配置"
          subtitle={props.editingId || 'task config'}
          onClose={props.onCancelEdit}
        >
          <ConfigEditorPanel
            busy={props.busy}
            fields={editableTaskConfigFields}
            form={props.form}
            idKey="taskId"
            isEditing
            onCancel={props.onCancelEdit}
            onFieldChange={props.onFieldChange}
            onSave={props.onSave}
          />
        </Modal>
      ) : null}
    </>
  );
}
