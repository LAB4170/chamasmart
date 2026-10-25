import { ChevronLeft, ChevronRight } from "lucide-react";

/** Previous / next for a server-paged list. `page` is zero-based. */
export default function Pager({ page, totalPages, total, size, onPage, label = "entries" }) {
  if (!total) return null;
  const from = page * size + 1;
  const to = Math.min(total, (page + 1) * size);
  return (
    <nav className="cs-pager" aria-label="Pages">
      <span className="cs-pager-info">{from}–{to} of {total} {label}</span>
      <span className="cs-pager-buttons">
        <button type="button" className="cs-btn cs-btn--secondary cs-btn--sm" onClick={() => onPage(page - 1)} disabled={page <= 0} aria-label="Previous page"><ChevronLeft size={16} /></button>
        <span className="cs-pager-page">Page {page + 1} of {Math.max(1, totalPages)}</span>
        <button type="button" className="cs-btn cs-btn--secondary cs-btn--sm" onClick={() => onPage(page + 1)} disabled={page + 1 >= totalPages} aria-label="Next page"><ChevronRight size={16} /></button>
      </span>
    </nav>
  );
}
