import { useEffect, useRef, useId } from 'react';

/** Modal sheet (bottom sheet on phones). Closes on Escape or scrim tap; focus moves in on open and returns on close. */
export default function Dialog({ open, title, onClose, children, actions }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="cs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="cs-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <h2 id={titleId}>{title}</h2>
        <div>{children}</div>
        {actions && <div className="cs-dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}
