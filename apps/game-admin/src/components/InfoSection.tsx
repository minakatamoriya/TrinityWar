import { formatValue } from '../domain/labels';
import type { FieldRow } from '../types';

export function InfoSection(props: { title: string; rows: FieldRow[] }): JSX.Element {
  return (
    <section className="panel">
      <div className="panel-head compact">
        <h3>{props.title}</h3>
      </div>
      <KeyValueTable rows={props.rows} />
    </section>
  );
}

export function KeyValueTable(props: { rows: FieldRow[] }): JSX.Element {
  const rows = props.rows.length > 0 ? props.rows : [{ label: '状态', field: 'empty', value: '暂无数据' }];
  return (
    <div className="table-wrap">
      <table className="admin-table key-table">
        <thead>
          <tr>
            <th>中文字段</th>
            <th>英文字段</th>
            <th>值</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.field}>
              <td>{row.label}</td>
              <td><code>{row.field}</code></td>
              <td>{formatValue(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
