import type { ConnectionState } from '../types/connections';
import { ConnectionCard } from './ConnectionCard';

interface ConnectionChecksProps {
  httpState: ConnectionState;
  socketState: ConnectionState;
}

export function ConnectionChecks({
  httpState,
  socketState,
}: ConnectionChecksProps) {
  return (
    <div className="connections">
      <ConnectionCard
        title="HTTP ping"
        description="A response from your dashboard server."
        state={httpState}
      />
      <ConnectionCard
        title="WebSocket pong"
        description="A live response for this browser tab."
        state={socketState}
      />
    </div>
  );
}
