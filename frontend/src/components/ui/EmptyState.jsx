import { Inbox } from 'lucide-react';

export default function EmptyState({ title, message, action, icon }) {
  return (
    <div className="cs-empty">
      <span className="cs-empty-icon" aria-hidden="true">{icon || <Inbox size={26} strokeWidth={1.75} />}</span>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
