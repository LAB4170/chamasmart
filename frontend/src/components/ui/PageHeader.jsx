
/** Page title, one-line purpose, and the page's primary action(s) on the right. */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="cs-page-header">
      <div>
        <h1 className="cs-page-title">{title}</h1>
        {subtitle && <p className="cs-page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="cs-actions">{actions}</div>}
    </header>
  );
}
