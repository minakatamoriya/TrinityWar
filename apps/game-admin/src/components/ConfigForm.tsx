import type { ConfigField } from '../types';

export function ConfigEditorPanel(props: {
  busy: string;
  fields: ConfigField[];
  form: Record<string, string>;
  idKey: string;
  isEditing: boolean;
  onCancel: () => void;
  onFieldChange: (field: string, value: string) => void;
  onSave: () => void;
}): JSX.Element {
  const isBusy = props.busy.endsWith('-save');

  return (
    <div className="view-stack">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Editor</p>
          <h3>{props.isEditing ? '编辑配置' : '新增配置'}</h3>
        </div>
        <div className="action-group">
          <button className="primary-button" disabled={isBusy} type="button" onClick={props.onSave}>保存</button>
          <button type="button" onClick={props.onCancel}>取消</button>
        </div>
      </div>
      <ConfigForm
        fields={props.fields}
        form={props.form}
        idKey={props.idKey}
        isEditing={props.isEditing}
        onFieldChange={props.onFieldChange}
      />
    </div>
  );
}

export function ConfigForm(props: {
  fields: ConfigField[];
  form: Record<string, string>;
  idKey: string;
  isEditing: boolean;
  onFieldChange: (field: string, value: string) => void;
}): JSX.Element {
  return (
    <div className="config-form">
      {props.fields.map((field) => (
        <label className={field.inputType === 'textarea' ? 'field-span-2' : ''} key={field.key}>
          <span>{field.label}</span>
          {field.inputType === 'select' ? (
            <select
              disabled={props.isEditing && field.key === props.idKey}
              value={props.form[field.key] ?? ''}
              onChange={(event) => props.onFieldChange(field.key, event.target.value)}
            >
              {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : field.inputType === 'textarea' ? (
            <textarea
              value={props.form[field.key] ?? ''}
              onChange={(event) => props.onFieldChange(field.key, event.target.value)}
              placeholder={field.nullable ? '可为空' : undefined}
            />
          ) : (
            <input
              disabled={props.isEditing && field.key === props.idKey}
              type={field.inputType === 'number' ? 'number' : 'text'}
              value={props.form[field.key] ?? ''}
              onChange={(event) => props.onFieldChange(field.key, event.target.value)}
            />
          )}
        </label>
      ))}
    </div>
  );
}
