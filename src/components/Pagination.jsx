import { ROWS_OPTIONS as DEFAULT_ROWS } from '../constants';

/**
 * Pagination — rows-per-page selector + page number buttons.
 *
 * Props:
 *   page              — current page (1-indexed)
 *   totalPages        — total number of pages
 *   onPageChange      — (newPage: number) => void
 *   rowsPerPage       — current rows-per-page value
 *   onRowsPerPageChange — (newRows: number) => void
 *   total?            — total record count (used for "Showing X–Y of Z" label)
 *   rowsOptions?      — array of number options (defaults to ROWS_OPTIONS)
 *   showRowsSelector? — whether to show the rows-per-page select (default true)
 */
export default function Pagination({
  page,
  totalPages,
  onPageChange,
  rowsPerPage,
  onRowsPerPageChange,
  total,
  rowsOptions = DEFAULT_ROWS,
  showRowsSelector = true,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
      {showRowsSelector && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={e => { onRowsPerPageChange(+e.target.value); onPageChange(1); }}
            className="border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none bg-white cursor-pointer"
          >
            {rowsOptions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}

      <div className="flex items-center gap-1">
        <PageBtn onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>‹</PageBtn>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <PageBtn key={p} onClick={() => onPageChange(p)} active={p === page}>{p}</PageBtn>
        ))}
        <PageBtn onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>›</PageBtn>
        {total != null && (
          <span className="text-xs text-slate-400 ml-2">
            Showing {(page - 1) * rowsPerPage + 1}–{Math.min(page * rowsPerPage, total)} of {total}
          </span>
        )}
      </div>
    </div>
  );
}

function PageBtn({ children, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center cursor-pointer transition-colors
        ${active ? 'bg-green-700 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}
