import { useHttpPing } from '../api/useHttpPing';
import { ConnectionChecks } from '../components/ConnectionChecks';
import { useSocketPong } from '../realtime/useSocketPong';

export function FoundationPage() {
  const httpPing = useHttpPing();
  const socketPong = useSocketPong();

  function checkConnections(): void {
    httpPing.retry();
    socketPong.retry();
  }

  return (
    <main className="dashboard">
      <header className="page-header">
        <span className="eyebrow">Retail operations</span>
        <h1>Retail dashboard</h1>
        <p>Check the connections that keep your dashboard up to date.</p>
      </header>
      <ConnectionChecks
        httpState={httpPing.state}
        socketState={socketPong.state}
      />
      <button className="check-button" onClick={checkConnections}>
        Check connections
      </button>
    </main>
  );
}
