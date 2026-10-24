import { useMemo, useState } from 'react';
import Button from './Button';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';

/**
 * Reusable financial table.
 *  - columns: [{ key, header, render?(row), sortValue?(row), align?: 'num', searchText?(row) }]
 *  - Search, sort and paging all run on the full dataset passed in, so totals are never page-only.
 *  - `summarize(filteredRows)` receives EVERY row matching the search (not just the visible page)
 *    and returns a node, e.g. "Total KES 120,000.00". The footer also shows the result count.
 *  - On narrow screens rows become labelled records, so no column or status is hidden.
 */
export default function DataTable({ columns, rows, rowKey, caption, loading, error, onRetry, searchable = true, searchPlaceholder = 'Search', pageSize = 10, summarize, emptyTitle = 'Nothing here yet', emptyMessage, emptyAction }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => columns.some((c) => {
      const text = c.searchText ? c.searchText(r) : r[c.key];
      return text !== null && text !== undefined && String(text).toLowerCase().includes(q);
    }));
  }, [rows, query, columns]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    const val = (r) => (col.sortValue ? col.sortValue(r) : r[col.key]);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [filtered, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const visible = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (key) => { setPage(0); setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })); };

  if (error) {
    return (
      <div className="cs-card" role="alert">
        <EmptyState title="We couldn't load this" message={typeof error === 'string' ? error : 'Please check your connection and try again.'} action={onRetry && <Button variant="primary" onClick={onRetry}>Try again</Button>} />
      </div>
    );
  }

  return (
    <div className="cs-card cs-card--flush">
      {searchable && (
        <div className="cs-toolbar">
          <label className="cs-sr-only" htmlFor="cs-table-search">{searchPlaceholder}</label>
          <input id="cs-table-search" className="cs-input" type="search" placeholder={searchPlaceholder} value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
          {query && <Button variant="tertiary" size="sm" onClick={() => { setQuery(''); setPage(0); }}>Clear search</Button>}
        </div>
      )}
      {loading ? (
        <div style={{ padding: 16, display: 'grid', gap: 12 }} aria-busy="true" aria-label="Loading">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={20} />)}
        </div>
      ) : sorted.length === 0 ? (
        query ? <EmptyState title="No matches" message={`Nothing matches "${query}".`} action={<Button onClick={() => setQuery('')}>Clear search</Button>} />
              : <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />
      ) : (
        <div className="cs-table-wrap">
          <table className="cs-table cs-table--records">
            {caption && <caption className="cs-sr-only">{caption}</caption>}
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={c.align === 'num' ? 'cs-num' : undefined}
                      aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {c.sortable === false ? c.header : (
                      <button type="button" className="cs-sort" onClick={() => toggleSort(c.key)}>
                        {c.header}<span aria-hidden="true">{sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={rowKey(r)}>
                  {columns.map((c) => (
                    <td key={c.key} data-label={c.header} className={c.align === 'num' ? 'cs-num' : undefined}>
                      {c.render ? c.render(r) : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && sorted.length > 0 && (
        <div className="cs-table-foot">
          <span>
            {sorted.length === rows.length ? `${rows.length} records` : `${sorted.length} of ${rows.length} records`}
            {summarize && <> · <span className="cs-totals">{summarize(sorted)}</span></>}
          </span>
          {pages > 1 && (
            <span className="cs-pager">
              <Button size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</Button>
              <span aria-live="polite">Page {safePage + 1} of {pages}</span>
              <Button size="sm" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>Next</Button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
