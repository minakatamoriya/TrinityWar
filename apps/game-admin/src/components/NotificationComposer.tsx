import type { NotificationAttachmentKind, NotificationCategory } from '@trinitywar/shared';

export interface AdminNotificationAttachmentDraft {
  kind: NotificationAttachmentKind;
  quantity: string;
  seedId: string;
}

export interface AdminNotificationFormState {
  playerId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  expiresAt: string;
  attachments: AdminNotificationAttachmentDraft[];
}

export const notificationCategoryOptions: Array<{ value: NotificationCategory; label: string }> = [
  { value: 'system', label: '系统' },
  { value: 'announcement', label: '公告' },
  { value: 'maintenance', label: '维护' },
  { value: 'reward', label: '奖励' },
  { value: 'compensation', label: '补偿' },
];

export const attachmentKindOptions: Array<{ value: NotificationAttachmentKind; label: string }> = [
  { value: 'gold', label: '金币' },
  { value: 'seed', label: '种子' },
  { value: 'tianjiTalisman', label: '天机符' },
  { value: 'spiritSoul', label: '兽魂' },
];

export function createEmptyNotificationForm(overrides: Partial<AdminNotificationFormState> = {}): AdminNotificationFormState {
  return {
    playerId: '',
    title: '',
    body: '',
    category: 'system',
    expiresAt: '',
    attachments: [],
    ...overrides,
  };
}

export function NotificationComposer(props: {
  actionLabel: string;
  busy: boolean;
  eyebrow: string;
  form: AdminNotificationFormState;
  seedOptions: Array<{ value: string; label: string }>;
  submitBusyLabel: string;
  title: string;
  onAddAttachment: () => void;
  onAttachmentChange: (index: number, field: keyof AdminNotificationAttachmentDraft, value: string) => void;
  onChange: (field: keyof AdminNotificationFormState, value: string) => void;
  onRemoveAttachment: (index: number) => void;
  onSubmit: () => void;
  playerIdDisabled?: boolean;
  showPlayerId?: boolean;
}): JSX.Element {
  const showPlayerId = props.showPlayerId ?? false;

  return (
    <section className="notification-form-card">
      <div>
        <p className="eyebrow">{props.eyebrow}</p>
        <h3>{props.title}</h3>
      </div>

      {showPlayerId ? (
        <label className="field-stack">
          <span>玩家 ID</span>
          <input
            disabled={props.playerIdDisabled}
            onChange={(event) => props.onChange('playerId', event.target.value)}
            placeholder="输入 playerId"
            value={props.form.playerId}
          />
        </label>
      ) : null}

      <label className="field-stack">
        <span>标题</span>
        <input
          maxLength={80}
          onChange={(event) => props.onChange('title', event.target.value)}
          placeholder="可选；不填时后端会自动生成默认标题"
          value={props.form.title}
        />
      </label>

      <label className="field-stack">
        <span>分类</span>
        <select onChange={(event) => props.onChange('category', event.target.value)} value={props.form.category}>
          {notificationCategoryOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <label className="field-stack">
        <span>过期时间</span>
        <input
          onChange={(event) => props.onChange('expiresAt', event.target.value)}
          type="datetime-local"
          value={props.form.expiresAt}
        />
      </label>

      <label className="field-stack">
        <span>消息正文</span>
        <textarea
          maxLength={1000}
          onChange={(event) => props.onChange('body', event.target.value)}
          placeholder="可选；消息与物品可以同时发送，也可以只发其中一种。"
          value={props.form.body}
        />
      </label>

      <div className="field-stack">
        <div className="notification-attachment-head">
          <span>附件</span>
          <button className="small-button" onClick={props.onAddAttachment} type="button">添加物品</button>
        </div>
        {props.form.attachments.length <= 0 ? <div className="notification-attachment-empty">当前未添加附件，可只发送消息。</div> : null}
        {props.form.attachments.map((attachment, index) => (
          <div className="notification-attachment-row" key={`${attachment.kind}-${index}`}>
            <select onChange={(event) => props.onAttachmentChange(index, 'kind', event.target.value)} value={attachment.kind}>
              {attachmentKindOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {attachment.kind === 'seed' ? (
              <select onChange={(event) => props.onAttachmentChange(index, 'seedId', event.target.value)} value={attachment.seedId}>
                <option value="">选择种子</option>
                {props.seedOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : <input disabled value={attachmentKindOptions.find((option) => option.value === attachment.kind)?.label ?? attachment.kind} />}
            <input min="1" onChange={(event) => props.onAttachmentChange(index, 'quantity', event.target.value)} type="number" value={attachment.quantity} />
            <button className="small-button danger-button" onClick={() => props.onRemoveAttachment(index)} type="button">移除</button>
          </div>
        ))}
      </div>

      <div className="notification-form-actions">
        <button className="primary-button" disabled={props.busy} onClick={props.onSubmit} type="button">
          {props.busy ? props.submitBusyLabel : props.actionLabel}
        </button>
      </div>
    </section>
  );
}