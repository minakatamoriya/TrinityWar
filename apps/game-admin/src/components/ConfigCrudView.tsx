import { ConfigForm } from './ConfigForm';
import { TableSection } from './TableSection';
import type { ConfigField, ConfigViewProps } from '../types';

export function ConfigCrudView(props: ConfigViewProps & {
  fields: ConfigField[];
  idKey: string;
  title: string;
  columns: Array<{ label: string; key: string }>;
  useModalEditor?: boolean;
}): JSX.Element {
  const isBusy = props.busy.endsWith('-save') || props.busy.endsWith('-delete') || props.busy.endsWith('-list');

  return (
    <div className="view-stack">
      {!props.useModalEditor ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Config</p>
              <h3>{props.editingId ? `编辑${props.title}` : `新增${props.title}`}</h3>
            </div>
            <div className="action-group">
              <button className="primary-button" disabled={isBusy} onClick={props.onSave} type="button">
                {props.editingId ? '保存修改' : '新增'}
              </button>
              {props.editingId ? <button type="button" onClick={props.onCancelEdit}>取消编辑</button> : null}
              <button type="button" disabled={isBusy} onClick={props.onRefresh}>刷新列表</button>
            </div>
          </div>
          <ConfigForm fields={props.fields} form={props.form} idKey={props.idKey} isEditing={Boolean(props.editingId)} onFieldChange={props.onFieldChange} />
        </section>
      ) : (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Config</p>
              <h3>{props.title}列表</h3>
            </div>
            <div className="action-group">
              <button className="primary-button" type="button" onClick={props.onAdd ?? props.onSave}>新增</button>
              <button type="button" disabled={isBusy} onClick={props.onRefresh}>刷新列表</button>
            </div>
          </div>
        </section>
      )}

      <TableSection
        title={`${props.title}列表`}
        columns={props.columns}
        rows={props.definitions?.items ?? []}
        rowAction={(row) => (
          <div className="action-group">
            <button className="small-button" type="button" onClick={() => props.onEdit(row)}>编辑</button>
            <button className="small-button danger-button" type="button" onClick={() => props.onDelete(String(row[props.idKey]))}>删除</button>
          </div>
        )}
      />
    </div>
  );
}
