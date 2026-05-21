import type { AdminPagination } from '@trinitywar/shared';
import { DataTable } from './DataTable';
import { PaginationBar } from './PaginationBar';
import type { AdminRecord } from '../types';
import type { ReactNode } from 'react';

export function TableSection(props: {
  title: string;
  columns: Array<{ label: string; key: string }>;
  rows: AdminRecord[];
  rowAction?: (row: AdminRecord) => ReactNode;
  pagination?: AdminPagination | null;
  paginationBusy?: boolean;
  onPageChange?: (page: number) => void;
}): JSX.Element {
  return (
    <section className="panel">
      <div className="panel-head compact">
        <h3>{props.title}</h3>
        <span className="result-count">{props.rows.length} 条</span>
      </div>
      <DataTable
        columns={props.columns}
        emptyText="暂无数据。"
        getRowKey={(row, index) => String(row.id ?? row.orderId ?? row.playerId ?? index)}
        rows={props.rows}
        rowAction={props.rowAction}
      />
      {props.pagination && props.onPageChange ? (
        <PaginationBar
          busy={Boolean(props.paginationBusy)}
          pagination={props.pagination}
          onPageChange={props.onPageChange}
        />
      ) : null}
    </section>
  );
}
