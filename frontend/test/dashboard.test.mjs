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
const { isOutletCard, isOutletList, isOutletSettings } =
  await vite.ssrLoadModule('/src/types/outlets.ts');
const { isAlertList } = await vite.ssrLoadModule('/src/types/alerts.ts');
const { isProductList } = await vite.ssrLoadModule('/src/types/products.ts');
const { getOutlets, getOutletCard, getOutletSettings, patchOutletSettings } =
  await vite.ssrLoadModule('/src/api/outlets.ts');
const { getAlerts } = await vite.ssrLoadModule('/src/api/alerts.ts');
const { getProducts } = await vite.ssrLoadModule('/src/api/products.ts');
const { buildSettingsPatch } = await vite.ssrLoadModule(
  '/src/outlets/settings.ts',
);
const { OutletCardView } = await vite.ssrLoadModule(
  '/src/components/OutletCardView.tsx',
);
const { AlertsTable } = await vite.ssrLoadModule(
  '/src/components/AlertsTable.tsx',
);
const { OutletSettingsForm } = await vite.ssrLoadModule(
  '/src/components/OutletSettingsForm.tsx',
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
      `${vite.config.env.VITE_API_URL.replace(/\/+$/, '')}/rankings?window=hour`,
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
  ]) {
    assert.ok(html.includes(text), text);
  }
  const cells = [...html.matchAll(/<td(?: [^>]*)?>(.*?)<\/td>/g)].map((match) =>
    match[1].replace(/<[^>]*>/g, ''),
  );
  assert.equal(cells[6], 'Yes');
  assert.equal(cells[7], 'No');
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

test('shows an HTTP fallback when subscription succeeds but no initial snapshot arrives', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const socket = new FakeSocket();
  const states = [];
  const cleanup = subscribeToRankings(
    'hour',
    () => {},
    (value) => states.push(value),
    () => socket,
  );
  await Promise.resolve();
  socket.acknowledgements[0](null, { ok: true, window: 'hour' });
  context.mock.timers.tick(10_000);
  assert.equal(states.at(-1).status, 'disconnected');
  assert.match(states.at(-1).message, /No live ranking snapshot/);
  cleanup();
});

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

const outlet = {
  outlet_id: '00000000-0000-4000-8000-000000000001',
  name: 'Outlet A',
  time_zone: 'Asia/Bishkek',
};
const settings = {
  outlet_id: outlet.outlet_id,
  daily_plan_minor: '5000000',
  responsible_person: { name: 'Manager', email: 'manager@example.com' },
};
const metrics = {
  net_revenue_minor: '900719925474099301',
  receipt_count: 2,
  average_check_minor: '450359962737049650.500000',
};
const card = {
  outlet,
  settings,
  as_of: '2026-10-13T10:00:00.000Z',
  window: 'hour',
  metrics,
  series: [
    {
      starts_at: '2026-10-13T09:00:00.000Z',
      ends_at: '2026-10-13T09:05:00.000Z',
      metrics,
    },
  ],
  top_products: [
    {
      product_id: 'product',
      name: 'Bread',
      net_quantity: -1,
      net_revenue_minor: '-500',
    },
  ],
  today_plan: {
    local_date: '2026-10-13',
    daily_plan_minor: '5000000',
    net_revenue_minor: '900719925474099301',
    progress_bps: 1801439850948198,
  },
};
const stale = {
  episode_id: 'episode-1',
  outlet_id: outlet.outlet_id,
  kind: 'stale',
  local_date: null,
  opened_at: card.as_of,
  resolved_at: null,
  facts: {
    last_activity_at: card.as_of,
    timeout_seconds: 300,
    recipient: settings.responsible_person,
  },
};
const behindPlan = {
  ...stale,
  episode_id: 'episode-2',
  kind: 'behind_plan',
  local_date: '2026-10-13',
  facts: {
    daily_plan_minor: '5000000',
    net_revenue_minor: '-500',
    cutoff_at: card.as_of,
    recipient: settings.responsible_person,
  },
};
const product = {
  product_id: 'product',
  sku: 'BREAD',
  name: 'Bread',
  unit_price_minor: '9007199254740993',
};

test('outlet contracts retain decimal average checks, money strings and zero/negative values', () => {
  assert.equal(isOutletList({ items: [outlet] }), true);
  assert.equal(isOutletList({ items: [] }), true);
  assert.equal(isOutletSettings(settings), true);
  assert.equal(
    isOutletSettings({ ...settings, daily_plan_minor: 5000000 }),
    false,
  );
  assert.equal(isOutletCard(card), true);
  assert.equal(
    isOutletCard({
      ...card,
      metrics: { ...metrics, average_check_minor: null },
    }),
    true,
  );
  assert.equal(
    isOutletCard({ ...card, metrics: { ...metrics, net_revenue_minor: 123 } }),
    false,
  );
  assert.equal(
    isOutletCard({ ...card, settings: { ...settings, outlet_id: 'wrong' } }),
    false,
  );
  assert.equal(isOutletCard({ ...card, window: 'day' }), false);
});

test('outlet card displays all statistics, numeric strings, series and top products', () => {
  const html = renderToStaticMarkup(createElement(OutletCardView, { card }));
  for (const text of [
    metrics.net_revenue_minor,
    metrics.average_check_minor,
    'Today’s net revenue',
    'Time buckets',
    'Bread',
    '-500',
  ])
    assert.ok(html.includes(text), text);
  const large = {
    ...card,
    top_products: [{ ...card.top_products[0], net_quantity: 1e18 }],
    today_plan: { ...card.today_plan, progress_bps: 1e18 },
  };
  assert.equal(isOutletCard(large), true);
  assert.match(
    renderToStaticMarkup(createElement(OutletCardView, { card: large })),
    /Outside safe display range/,
  );
  assert.match(
    renderToStaticMarkup(
      createElement(OutletCardView, {
        card: { ...card, top_products: [], series: [] },
      }),
    ),
    /No product activity/,
  );
});

test('outlet API clients use exact paths/windows and reject a mismatched card', async (context) => {
  const responses = {
    '/api/outlets': { items: [outlet] },
    [`/api/outlets/${outlet.outlet_id}/card`]: card,
    [`/api/outlets/${outlet.outlet_id}/settings`]: settings,
  };
  const mock = context.mock.method(globalThis, 'fetch', async (url) => {
    if (url.pathname.endsWith('/card'))
      assert.equal(url.searchParams.get('window'), 'hour');
    return Response.json(responses[url.pathname]);
  });
  const signal = new AbortController().signal;
  assert.deepEqual(await getOutlets(signal), [outlet]);
  assert.deepEqual(await getOutletCard(outlet.outlet_id, 'hour', signal), card);
  assert.deepEqual(await getOutletSettings(outlet.outlet_id, signal), settings);
  mock.mock.mockImplementation(async () =>
    Response.json({ ...card, window: 'business_day' }),
  );
  await assert.rejects(
    getOutletCard(outlet.outlet_id, 'hour', signal),
    /Unexpected outlet card/,
  );
});

test('settings patches include only changed fields and preserve values above Number precision', () => {
  const fields = {
    daily_plan_minor: settings.daily_plan_minor,
    ...settings.responsible_person,
  };
  assert.deepEqual(
    buildSettingsPatch(settings, {
      ...fields,
      daily_plan_minor: '9007199254740993',
    }),
    { daily_plan_minor: '9007199254740993' },
  );
  assert.deepEqual(
    buildSettingsPatch(settings, { ...fields, name: ' New manager ' }),
    { responsible_person: { name: 'New manager', email: fields.email } },
  );
  assert.throws(
    () => buildSettingsPatch(settings, fields),
    /no settings changes/,
  );
  for (const value of ['0', '-1', '1.5', '01', '9223372036854775808'])
    assert.throws(
      () =>
        buildSettingsPatch(settings, { ...fields, daily_plan_minor: value }),
      /positive integer string/,
    );
  assert.throws(
    () => buildSettingsPatch(settings, { ...fields, name: ' ' }),
    /required/,
  );
});

test('settings PATCH sends JSON strings and validates the returned outlet identity', async (context) => {
  const patch = { daily_plan_minor: '9007199254740993' };
  const updated = { ...settings, ...patch };
  const mock = context.mock.method(
    globalThis,
    'fetch',
    async (url, options) => {
      assert.equal(url.pathname, `/api/outlets/${outlet.outlet_id}/settings`);
      assert.equal(options.method, 'PATCH');
      assert.equal(options.headers['Content-Type'], 'application/json');
      assert.deepEqual(JSON.parse(options.body), patch);
      return Response.json(updated);
    },
  );
  const signal = new AbortController().signal;
  assert.deepEqual(
    await patchOutletSettings(outlet.outlet_id, patch, signal),
    updated,
  );
  mock.mock.mockImplementation(async () =>
    Response.json({ ...updated, outlet_id: 'wrong' }),
  );
  await assert.rejects(
    patchOutletSettings(outlet.outlet_id, patch, signal),
    /Unexpected outlet settings/,
  );
});

test('settings form starts with exact values and prevents unchanged saves', () => {
  const html = renderToStaticMarkup(
    createElement(OutletSettingsForm, {
      settings: { ...settings, daily_plan_minor: '9007199254740993' },
      onSaved: () => {},
    }),
  );
  assert.ok(html.includes('value="9007199254740993"'));
  assert.ok(html.includes('manager@example.com'));
  assert.match(html, /disabled=""[^>]*>Save settings/);
});

test('alerts validate both fact shapes and render active/resolved indicators', () => {
  assert.equal(isAlertList({ items: [stale, behindPlan] }), true);
  assert.equal(isAlertList({ items: [] }), true);
  assert.equal(isAlertList({ items: [{ ...stale, kind: 'unknown' }] }), false);
  assert.equal(
    isAlertList({
      items: [
        {
          ...behindPlan,
          facts: { ...behindPlan.facts, daily_plan_minor: 5000000 },
        },
      ],
    }),
    false,
  );
  const html = renderToStaticMarkup(
    createElement(AlertsTable, {
      alerts: [stale, { ...behindPlan, resolved_at: card.as_of }],
      outlets: [outlet],
    }),
  );
  for (const text of [
    'Outlet A',
    'Stale',
    'Behind plan',
    'Active',
    'Resolved',
    '-500',
  ])
    assert.ok(html.includes(text), text);
  assert.match(
    renderToStaticMarkup(
      createElement(AlertsTable, { alerts: [], outlets: [] }),
    ),
    /No alerts match/,
  );
});

test('alert filters use only supported query fields; product prices stay strings', async (context) => {
  const mock = context.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url.pathname, '/api/alerts');
    assert.deepEqual(
      [...url.searchParams.entries()],
      [
        ['active_only', 'false'],
        ['outlet_id', outlet.outlet_id],
      ],
    );
    return Response.json({ items: [stale] });
  });
  const signal = new AbortController().signal;
  assert.deepEqual(await getAlerts(false, outlet.outlet_id, signal), [stale]);
  mock.mock.mockImplementation(async (url) => {
    assert.equal(url.pathname, '/api/products');
    return Response.json({ items: [product] });
  });
  assert.deepEqual(await getProducts(signal), [product]);
  assert.equal(isProductList({ items: [] }), true);
  assert.equal(
    isProductList({ items: [{ ...product, unit_price_minor: 123 }] }),
    false,
  );
});

test('remaining API clients expose business errors and reject malformed list responses', async (context) => {
  const mock = context.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { code: 'database_unavailable', message: 'Database unavailable.' },
      { status: 503 },
    ),
  );
  const signal = new AbortController().signal;
  for (const load of [
    () => getOutlets(signal),
    () => getOutletSettings(outlet.outlet_id, signal),
    () => getAlerts(true, '', signal),
    () => getProducts(signal),
  ])
    await assert.rejects(load(), /Database unavailable/);
  mock.mock.mockImplementation(async () => Response.json({ items: [{}] }));
  await assert.rejects(getOutlets(signal), /Unexpected outlet list/);
  await assert.rejects(getAlerts(true, '', signal), /Unexpected alerts/);
  await assert.rejects(getProducts(signal), /Unexpected products/);
});
