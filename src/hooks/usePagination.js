import { useState, useMemo } from 'react';
import { ROWS_OPTIONS } from '../constants';

/**
 * usePagination — manages page + rows-per-page state and slices data.
 *
 * @param {Array} data — full (filtered) array to paginate
 * @param {number} [defaultLimit] — initial rows per page
 * @returns { page, setPage, limit, setLimit, totalPages, pageRows }
 */
export default function usePagination(data, defaultLimit = ROWS_OPTIONS[0]) {
  const [page,  setPage]  = useState(1);
  const [limit, setLimit] = useState(defaultLimit);

  const totalPages = Math.max(1, Math.ceil(data.length / limit));
  const safePage   = Math.min(page, totalPages);

  const pageRows = useMemo(
    () => data.slice((safePage - 1) * limit, safePage * limit),
    [data, safePage, limit]
  );

  function handleSetLimit(newLimit) {
    setLimit(newLimit);
    setPage(1);
  }

  return { page: safePage, setPage, limit, setLimit: handleSetLimit, totalPages, pageRows };
}
