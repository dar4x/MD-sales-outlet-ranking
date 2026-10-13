import assert from 'node:assert/strict';
import { it } from 'node:test';
import { GetRankings } from '../src/rankings/application/get-rankings.js';
import { PublishRankings } from '../src/rankings/application/publish-rankings.js';
import type { RankingWindow } from '../src/shared/domain/value-types.js';
import type { RankingSnapshot } from '../src/rankings/application/read-models/ranking.js';

await it('reads and publishes once for each subscribed window only', async () => {
  const reads: RankingWindow[] = [];
  const published: RankingSnapshot[] = [];
  let windows: RankingWindow[] = [];
  const useCase = new PublishRankings(
    new GetRankings({
      get: (window) => {
        reads.push(window);
        return Promise.resolve({
          snapshot_id: window,
          as_of: '2026-10-13T06:00:00Z',
          window,
          currency: 'KGS',
          rows: [],
        });
      },
    }),
    {
      subscribedWindows: () => windows,
      publish: (snapshot) => {
        published.push(snapshot);
        return Promise.resolve();
      },
    },
  );
  await useCase.execute();
  assert.deepEqual(reads, []);
  windows = ['hour'];
  await useCase.execute();
  assert.deepEqual(reads, ['hour']);
  assert.equal(published.length, 1);
  windows = ['hour', 'business_day'];
  await useCase.execute();
  assert.deepEqual(reads, ['hour', 'hour', 'business_day']);
  assert.deepEqual(
    published.map((snapshot) => snapshot.window),
    reads,
  );
});
