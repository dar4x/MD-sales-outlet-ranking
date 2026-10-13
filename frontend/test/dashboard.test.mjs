import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Use the existing Vite TypeScript/JSX transform; no new test dependencies.
const vite = await createServer({
  mode: 'test',
  server: { middlewareMode: true },
  appType: 'custom',
});
after(() => vite.close());
const { isRankingSnapshot } = await vite.ssrLoadModule(
  '/src/types/rankings.ts',
);
const { formatMoney } = await vite.ssrLoadModule('/src/rankings/money.ts');
const { acceptSnapshot, rankMovement } = await vite.ssrLoadModule(
  '/src/rankings/snapshots.ts',
);
const { getRankings } = await vite.ssrLoadModule('/src/api/rankings.ts');
const { RankingTable } = await vite.ssrLoadModule(
  '/src/components/RankingTable.tsx',
);
const { subscribeToRankings } = await vite.ssrLoadModule(
  '/src/realtime/rankings-subscription.ts',
);

function snapshot(overrides = {}) {
  return {
    snapshot_id: '00000000-0000-4000-8000-000000000001',
    as_of: '2026-10-13T10:00:00.000Z',
    window: 'hour',
    currency: 'KGS',
    rows: [
      {
        outlet_id: '00000000-0000-4000-8000-000000000001',
        outlet_name: 'Outlet A',
        time_zone: 'Asia/Bishkek',
        local_date: '2026-10-13',
        starts_at: '2026-10-13T09:00:00.000Z',
        ends_at: '2026-10-13T10:00:00.000Z',
        rank: 1,
        net_revenue_minor: '900719925474099301',
        receipt_count: 2,
        average_check_minor: '450359962737049651',
        previous_revenue_minor: null,
        dynamics_bps: null,
        is_leader: true,
        is_laggard: false,
        stale: true,
        behind_plan: false,
      },
    ],
    ...overrides,
  };
}

test('validates both contract windows, empty rows and exact money strings', () => {
  assert.equal(isRankingSnapshot(snapshot()), true);
  assert.equal(
    isRankingSnapshot(snapshot({ window: 'business_day', rows: [] })),
    true,
  );
  for (const invalid of [
    null,
    {},
    snapshot({ window: 'day' }),
    snapshot({ as_of: 'invalid' }),
    snapshot({ currency: 'bad' }),
  ]) {
    assert.equal(isRankingSnapshot(invalid), false);
  }
  for (const overrides of [
    { net_revenue_minor: 123 },
    { net_revenue_minor: '1.5' },
    { stale: 'yes' },
    { rank: 0 },
    { receipt_count: -1 },
    { dynamics_bps: 1.5 },
  ]) {
    assert.equal(
      isRankingSnapshot(
        snapshot({ rows: [{ ...snapshot().rows[0], ...overrides }] }),
      ),
      false,
    );
  }
});

test('formats large and negative money exactly with the currency minor-unit scale', () => {
  assert.equal(
    formatMoney('900719925474099301', 'KGS'),
    '9,007,199,254,740,993.01 KGS',
  );
  assert.equal(formatMoney('-1', 'KGS'), '-0.01 KGS');
  assert.equal(formatMoney('0', 'KGS'), '0.00 KGS');
  assert.equal(formatMoney('123', 'JPY'), '123 JPY');
  assert.equal(formatMoney('1234', 'KWD'), '1.234 KWD');
});

test('ignores late HTTP/duplicate snapshots and resets comparison across windows', () => {
  const first = snapshot();
  const second = snapshot({
    snapshot_id: 'second',
    as_of: '2026-10-13T10:01:00.000Z',
  });
  const history = acceptSnapshot(
    acceptSnapshot({ snapshot: null, previous: null }, first),
    second,
  );
  assert.equal(history.previous, first);
  assert.equal(acceptSnapshot(history, first), history);
  assert.equal(acceptSnapshot(history, second), history);
  assert.equal(
    acceptSnapshot(history, snapshot({ window: 'business_day' })).previous,
    null,
  );
  assert.equal(rankMovement(first, first.rows[0].outlet_id, 3), -2);
  assert.equal(
    rankMovement(
      snapshot({ rows: [{ ...first.rows[0], rank: 3 }] }),
      first.rows[0].outlet_id,
      1,
    ),
    2,
  );
  assert.equal(rankMovement(first, 'new-outlet', 1), null);
  assert.equal(rankMovement(null, first.rows[0].outlet_id, 1), null);
});

test('HTTP client uses the configured rankings URL, window and abort signal', async (context) => {
  let requestSignal;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(
      url.toString(),
      `${import.meta.env?.VITE_API_URL ?? 'http://localhost:3000/api'}/rankings?window=hour`,
    );
    assert.equal(options.headers.Accept, 'application/json');
    requestSignal = options.signal;
    return Response.json(snapshot());
  });
  const controller = new AbortController();
  assert.deepEqual(await getRankings('hour', controller.signal), snapshot());
  controller.abort();
  assert.equal(requestSignal.aborted, true);
});

test('HTTP client reports business errors, malformed snapshots and wrong windows', async (context) => {
  const mock = context.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { code: 'database_unavailable', message: 'Database unavailable.' },
      { status: 503 },
    ),
  );
  await assert.rejects(
    getRankings('hour', new AbortController().signal),
    /Database unavailable/,
  );
  mock.mock.mockImplementation(async () => Response.json({ rows: [] }));
  await assert.rejects(
    getRankings('hour', new AbortController().signal),
    /unexpected rankings/,
  );
  mock.mock.mockImplementation(async () =>
    Response.json(snapshot({ window: 'business_day' })),
  );
  await assert.rejects(
    getRankings('hour', new AbortController().signal),
    /unexpected rankings/,
  );
});

test('ranking table displays money, counts, movement and flags; handles empty data', () => {
  const current = snapshot();
  const previous = snapshot({ rows: [{ ...current.rows[0], rank: 3 }] });
  const html = renderToStaticMarkup(
    createElement(RankingTable, { snapshot: current, previous }),
  );
  for (const text of [
    'Outlet A',
    '9,007,199,254,740,993.01 KGS',
    '<td>2</td>',
    'Up 2',
    'Leader',
    '<td>Yes</td>',
    '<td>No</td>',
  ]) {
    assert.ok(html.includes(text), text);
  }
  const laggard = snapshot({
    rows: [
      {
        ...current.rows[0],
        is_leader: false,
        is_laggard: true,
        behind_plan: true,
      },
    ],
  });
  assert.match(
    renderToStaticMarkup(
      createElement(RankingTable, { snapshot: laggard, previous: null }),
    ),
    /Last place/,
  );
  assert.match(
    renderToStaticMarkup(
      createElement(RankingTable, {
        snapshot: snapshot({ rows: [] }),
        previous: null,
      }),
    ),
    /No outlets/,
  );
});

class FakeSocket extends EventEmitter {
  connected = false;
  active = true;
  connects = 0;
  sent = [];
  acknowledgements = [];
  connect() {
    this.connects++;
    this.connected = true;
    super.emit('connect');
  }
  emit(event, ...args) {
    this.sent.push({ event, args });
    return this;
  }
  timeout(milliseconds) {
    assert.equal(milliseconds, 5000);
    return {
      emit: (event, payload, callback) => {
        this.sent.push({ event, args: [payload] });
        this.acknowledgements.push(callback);
      },
    };
  }
  serverEmit(event, payload) {
    super.emit(event, payload);
  }
  disconnect() {
    this.connected = false;
    super.emit('disconnect');
  }
}

test('subscribes on connect/reconnect, filters windows and cleans up named listeners', async () => {
  const socket = new FakeSocket();
  const received = [];
  const states = [];
  const cleanup = subscribeToRankings(
    'hour',
    (value) => received.push(value),
    (value) => states.push(value),
    () => socket,
  );
  await Promise.resolve();
  assert.deepEqual(socket.sent[0], {
    event: 'rankings.subscribe',
    args: [{ window: 'hour' }],
  });
  socket.acknowledgements[0](null, { ok: true, window: 'hour' });
  socket.serverEmit('rankings.snapshot', snapshot({ window: 'business_day' }));
  assert.equal(received.length, 0);
  socket.serverEmit('rankings.snapshot', snapshot());
  assert.equal(received.length, 1);
  assert.equal(states.at(-1).status, 'live');
  socket.disconnect();
  assert.equal(states.at(-1).status, 'disconnected');
  socket.connect();
  assert.equal(
    socket.sent.filter((value) => value.event === 'rankings.subscribe').length,
    2,
  );
  assert.equal(socket.listenerCount('rankings.snapshot'), 1);
  cleanup();
  assert.ok(
    socket.sent.some(
      (value) =>
        value.event === 'rankings.unsubscribe' &&
        Object.keys(value.args[0]).length === 0,
    ),
  );
  assert.equal(socket.eventNames().length, 0);
  const count = states.length;
  socket.acknowledgements[1](new Error('timeout'));
  socket.serverEmit('rankings.snapshot', snapshot());
  assert.equal(states.length, count);
  assert.equal(received.length, 1);
});

test('shows subscription errors, ignores stale acknowledgements and handles invalid live data', async () => {
  const socket = new FakeSocket();
  const states = [];
  const cleanup = subscribeToRankings(
    'business_day',
    () => {},
    (value) => states.push(value),
    () => socket,
  );
  await Promise.resolve();
  socket.acknowledgements[0](null, {
    ok: false,
    error: { code: 'invalid_request', message: 'Invalid' },
  });
  assert.equal(states.at(-1).status, 'disconnected');
  socket.connect();
  socket.acknowledgements[0](new Error('old timeout'));
  assert.equal(states.at(-1).status, 'connecting');
  socket.acknowledgements[1](new Error('timeout'));
  assert.equal(states.at(-1).status, 'disconnected');
  socket.serverEmit('rankings.snapshot', { rows: [] });
  assert.match(states.at(-1).message, /Unexpected/);
  cleanup();
});

test('StrictMode immediate cleanup opens no transport; separate tabs own separate subscriptions', async () => {
  const cancelled = new FakeSocket();
  subscribeToRankings(
    'hour',
    () => {},
    () => {},
    () => cancelled,
  )();
  await Promise.resolve();
  assert.equal(cancelled.connects, 0);
  assert.equal(cancelled.sent.length, 0);
  const first = new FakeSocket();
  const second = new FakeSocket();
  const closeFirst = subscribeToRankings(
    'hour',
    () => {},
    () => {},
    () => first,
  );
  const closeSecond = subscribeToRankings(
    'business_day',
    () => {},
    () => {},
    () => second,
  );
  await Promise.resolve();
  closeFirst();
  assert.equal(second.connected, true);
  assert.equal(second.listenerCount('rankings.snapshot'), 1);
  closeSecond();
});
