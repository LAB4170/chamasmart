
export default function EmptyState({ title, message, action }) {
  return (
    <div className="cs-empty">
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
