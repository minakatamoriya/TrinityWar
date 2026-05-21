import { formatColumnLabel, formatValue } from '../domain/labels';
import type { AdminRecord } from '../types';
import type { ReactNode } from 'react';

export function DataTable(props: {
  columns: Array<{ label: string; key: string }>;
  rows: AdminRecord[];
  emptyText: string;
  getRowKey: (row: AdminRecord, index: number) => string;
  rowAction?: (row: AdminRecord) => ReactNode;
}): JSX.Element {
  return (
    <div className="table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {props.columns.map((column) => <th key={column.key}>{formatColumnLabel(column.label)}</th>)}
            {props.rowAction ? <th>操作</th> : null}
          </tr>
        </thead>
        <tbody>
        {props.rows.length <= 0 ? (
          <tr>
            <td className="empty-cell" colSpan={props.columns.length + (props.rowAction ? 1 : 0)}>{props.emptyText}</td>
          </tr>
        ) : props.rows.map((row, index) => (
          <tr className={Boolean(row.isMain) ? 'highlight-row' : undefined} key={props.getRowKey(row, index)}>
            {props.columns.map((column) => <td key={column.key}>{formatValue(row[column.key])}</td>)}
            {props.rowAction ? <td>{props.rowAction(row)}</td> : null}
          </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
