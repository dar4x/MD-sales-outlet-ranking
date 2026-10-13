import { randomUUID } from 'node:crypto';
import type { TransactionRunner } from '../../shared/application/ports/transaction-runner.js';
import type { Clock } from '../../shared/application/ports/clock.js';
import type { AlertEvaluationQuery } from './ports/alert-evaluation-query.js';
import type { RankingRefreshRequester } from '../../rankings/application/ports/ranking-ports.js';
export class EvaluateMiddayAlerts {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly query: AlertEvaluationQuery,
    private readonly clock: Clock,
    private readonly refresh: RankingRefreshRequester,
  ) {}
  async execute(asOf = this.clock.now()): Promise<void> {
    // Midnight expiry also runs before today's noon has become due.
    for (const candidate of await this.query.list(asOf)) {
      const expired = await this.transactions.run(async (ports) => {
        if ((await ports.outlets.findForUpdate(candidate.outlet_id)) === null)
          return false;
        const open = await ports.alerts.findOpenForUpdate(
          candidate.outlet_id,
          'behind_plan',
        );
        if (
          open === null ||
          open.local_date === candidate.local_date ||
          open.local_date === null
        )
          return false;
        const previous = (
          await ports.alertEvaluation.list(
            asOf,
            candidate.outlet_id,
            open.local_date,
          )
        )[0]!;
        await ports.alerts.resolve(open.episode_id, previous.next_midnight_at);
        return true;
      });
      if (expired) this.refresh.request();
    }
    for (const candidate of await this.query.missedNoons(asOf)) {
      const changed = await this.transactions.run(async (ports) => {
        const outlet = await ports.outlets.findForUpdate(candidate.outlet_id);
        if (
          outlet === null ||
          (await ports.assessments.find(
            candidate.outlet_id,
            candidate.local_date,
          )) !== null
        )
          return false;
        const current = (
          await ports.alertEvaluation.list(
            asOf,
            candidate.outlet_id,
            candidate.local_date,
          )
        )[0];
        if (current === undefined || !current.noon_due) return false;
        const behind =
          current.noon_net_revenue_minor * 2n < current.daily_plan_minor;
        const inserted = await ports.assessments.insert({
          outlet_id: outlet.outlet_id,
          local_date: current.local_date,
          cutoff_at: current.cutoff_at,
          assessed_at: asOf,
          daily_plan_minor: current.daily_plan_minor,
          net_revenue_minor: current.noon_net_revenue_minor,
          behind_plan: behind,
        });
        if (inserted === 'assessment_conflict' || !behind) return false;
        const episodeId = randomUUID();
        const jobId = randomUUID();
        // Catch-up incidents start at civil noon and historical ones are already expired.
        await ports.alerts.insert({
          episode_id: episodeId,
          outlet_id: outlet.outlet_id,
          local_date: current.local_date,
          opened_at: current.cutoff_at,
          resolved_at:
            Date.parse(asOf) >= Date.parse(current.next_midnight_at)
              ? current.next_midnight_at
              : null,
          facts: {
            kind: 'behind_plan',
            daily_plan_minor: current.daily_plan_minor,
            net_revenue_minor: current.noon_net_revenue_minor,
            cutoff_at: current.cutoff_at,
            recipient: outlet.responsible_person,
          },
        });
        await ports.outbox.insert({
          job_id: jobId,
          episode_id: episodeId,
          notification_key: 'alert:' + episodeId,
          message: {
            recipient: outlet.responsible_person.email,
            subject: 'Behind plan: ' + outlet.name,
            text:
              outlet.name +
              ' noon net revenue ' +
              current.noon_net_revenue_minor.toString() +
              ' is below half the captured plan ' +
              current.daily_plan_minor.toString() +
              '. Local date: ' +
              current.local_date,
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
