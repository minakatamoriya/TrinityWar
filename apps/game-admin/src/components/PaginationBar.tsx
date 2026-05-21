import type { AdminPagination } from '@trinitywar/shared';

export function PaginationBar(props: {
  busy: boolean;
  pagination: AdminPagination | null;
  onPageChange: (page: number) => void;
}): JSX.Element | null {
  if (!props.pagination || props.pagination.total <= 0) {
    return null;
  }

  const { page, pageSize, total } = props.pagination;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  return (
    <div className="pagination-bar">
      <span>
        第 {currentPage} / {totalPages} 页，{start}-{end} / {total} 条
      </span>
      <div className="pagination-actions">
        <button
          className="small-button"
          disabled={props.busy || currentPage <= 1}
          onClick={() => props.onPageChange(currentPage - 1)}
          type="button"
        >
          上一页
        </button>
        <button
          className="small-button"
          disabled={props.busy || currentPage >= totalPages}
          onClick={() => props.onPageChange(currentPage + 1)}
          type="button"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
