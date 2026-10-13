import { randomUUID } from 'node:crypto';
import type { TransactionRunner } from '../../shared/application/ports/transaction-runner.js';
import type { Clock } from '../../shared/application/ports/clock.js';
import type { AlertEvaluationQuery } from './ports/alert-evaluation-query.js';
import type { RankingRefreshRequester } from '../../rankings/application/ports/ranking-ports.js';

export class EvaluateStaleAlerts {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly query: AlertEvaluationQuery,
    private readonly clock: Clock,
    private readonly timeoutSeconds: number,
    private readonly refresh: RankingRefreshRequester,
  ) {}
  async execute(asOf = this.clock.now()): Promise<void> {
    for (const candidate of await this.query.list(asOf)) {
      const changed = await this.transactions.run(async (ports) => {
        const outlet = await ports.outlets.findForUpdate(candidate.outlet_id);
        if (outlet === null) return false;
        // Read again under the same outlet lock ingestion uses; accepted activity cannot race this decision.
        const current = (
          await ports.alertEvaluation.list(asOf, outlet.outlet_id)
        )[0];
        if (current === undefined) return false;
        const open = await ports.alerts.findOpenForUpdate(
          outlet.outlet_id,
          'stale',
        );
        const stale =
          Date.parse(asOf) - Date.parse(current.last_activity_at) >=
          this.timeoutSeconds * 1000;
        if (!stale && open !== null) {
          await ports.alerts.resolve(open.episode_id, asOf);
          return true;
        }
        if (!stale || open !== null) return false;
        const episodeId = randomUUID();
        const jobId = randomUUID();
        const inserted = await ports.alerts.insert({
          episode_id: episodeId,
          outlet_id: outlet.outlet_id,
          local_date: null,
          opened_at: asOf,
          resolved_at: null,
          facts: {
            kind: 'stale',
            last_activity_at: current.last_activity_at,
            timeout_seconds: this.timeoutSeconds,
            recipient: outlet.responsible_person,
          },
        });
        if (inserted === 'episode_conflict') return false;
        await ports.outbox.insert({
          job_id: jobId,
          episode_id: episodeId,
          notification_key: 'alert:' + episodeId,
          message: {
            recipient: outlet.responsible_person.email,
            subject: 'Inactive outlet: ' + outlet.name,
            text:
              outlet.name +
              ' has no accepted activity since ' +
              current.last_activity_at +
              '. Timeout: ' +
              this.timeoutSeconds +
              ' seconds.',
            message_id: '<' + jobId + '@sales-ranking.local>',
          },
          status: 'pending',
          attempts: 0,
          next_attempt_at: asOf,
          created_at: asOf,
          sent_at: null,
          last_error: null,
        });
        return true;
      });
      if (changed) this.refresh.request();
    }
  }
}
