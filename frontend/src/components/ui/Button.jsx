
/**
 * Variants: primary (one per screen), secondary, tertiary, danger (destructive).
 * `loading` disables the button and announces busy state so double submits are blocked.
 */
export default function Button({ variant = 'secondary', size, block, loading = false, disabled, type = 'button', className = '', children, ...rest }) {
  const classes = ['cs-btn', `cs-btn--${variant}`, size === 'sm' && 'cs-btn--sm', block && 'cs-btn--block', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} data-loading={loading} {...rest}>
      {loading && <span className="cs-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
