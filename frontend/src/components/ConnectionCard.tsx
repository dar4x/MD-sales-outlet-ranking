import type { ConnectionState } from '../types/connections';

interface ConnectionCardProps {
  title: string;
  description: string;
  state: ConnectionState;
}

export function ConnectionCard({
  title,
  description,
  state,
}: ConnectionCardProps) {
  return (
    <section className={`connection-card ${state.status}`} aria-label={title}>
      <div className="card-heading">
        <h2>{title}</h2>
        <span className="status-dot" aria-hidden="true" />
      </div>
      <output className="result" aria-live="polite">
        {state.message}
      </output>
      <p className="card-description">{description}</p>
    </section>
  );
}
