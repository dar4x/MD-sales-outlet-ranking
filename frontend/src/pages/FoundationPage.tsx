import { useHttpPing } from '../api/useHttpPing';
import { ConnectionCard } from '../components/ConnectionCard';

export function FoundationPage() {
  const httpPing = useHttpPing();

  return (
    <main className="dashboard">
      <header className="page-header">
        <span className="eyebrow">Retail operations</span>
        <h1>Retail dashboard</h1>
        <p>Check the connections that keep your dashboard up to date.</p>
      </header>
      <div className="connections">
        <ConnectionCard
          title="HTTP ping"
          description="A response from your dashboard server."
          state={httpPing.state}
        />
      </div>
      <button className="check-button" onClick={httpPing.retry}>
        Check connections
      </button>
    </main>
  );
}
