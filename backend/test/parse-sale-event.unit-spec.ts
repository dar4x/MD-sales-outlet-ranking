/* External deps */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import 'reflect-metadata';

/* Internal deps */
import { EventValidationError } from '../src/events/domain/event-errors.js';
import { ParseSaleEventPipe } from '../src/events/presentation/parse-sale-event.pipe.js';

// A body as it arrives from JSON.parse: money as strings, no bigint.
function buildBody(): Record<string, unknown> {
  return {
    kind: 'sale',
    event_id: '11111111-1111-4111-8111-111111111111',
    receipt_id: '22222222-2222-4222-8222-222222222222',
    outlet_id: '33333333-3333-4333-8333-333333333333',
    occurred_at: '2026-10-13T12:00:00+06:00',
    lines: [
      {
        sale_line_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        product_id: '44444444-4444-4444-8444-444444444444',
        quantity: 2,
        unit_price_minor: '5000',
        line_amount_minor: '10000',
      },
    ],
  };
}

function buildBodyWithLine(
  changes: Record<string, unknown>,
): Record<string, unknown> {
  const body = buildBody();
  const lines = body.lines as Record<string, unknown>[];
  body.lines = [{ ...lines[0], ...changes }];
  return body;
}

// Passes when the pipe rejects with the given code and, if given, a details
// line that starts with the expected field path.
function assertRejected(
  body: unknown,
  expectedCode: string,
  expectedPath?: string,
): void {
  const pipe = new ParseSaleEventPipe();
  assert.throws(
    () => pipe.transform(body),
    (error: unknown) => {
      if (
        !(error instanceof EventValidationError) ||
        error.code !== expectedCode
      ) {
        return false;
      }
      if (expectedPath === undefined) {
        return true;
      }
      const details = error.details ?? [];
      return details.some((detail) => detail.startsWith(`${expectedPath}:`));
    },
  );
}

await describe('ParseSaleEventPipe', async () => {
  await it('maps a valid body to SaleInput with bigint money', () => {
    const sale = new ParseSaleEventPipe().transform(buildBody());

    assert.deepEqual(sale, {
      kind: 'sale',
      event_id: '11111111-1111-4111-8111-111111111111',
      receipt_id: '22222222-2222-4222-8222-222222222222',
      outlet_id: '33333333-3333-4333-8333-333333333333',
      occurred_at: '2026-10-13T12:00:00+06:00',
      lines: [
        {
          sale_line_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          product_id: '44444444-4444-4444-8444-444444444444',
          quantity: 2,
          unit_price_minor: 5000n,
          line_amount_minor: 10000n,
        },
      ],
    });
  });

  await it('keeps money above Number precision exact', () => {
    const body = buildBodyWithLine({
      quantity: 1,
      unit_price_minor: '9007199254740993',
      line_amount_minor: '9007199254740993',
    });

    const sale = new ParseSaleEventPipe().transform(body);

    assert.equal(sale.lines[0]?.unit_price_minor, 9007199254740993n);
  });

  await it('accepts Z as an explicit UTC offset', () => {
    const body = { ...buildBody(), occurred_at: '2026-10-13T06:00:00.123Z' };

    assert.doesNotThrow(() => new ParseSaleEventPipe().transform(body));
  });

  await it('rejects a non-object body', () => {
    assertRejected([buildBody()], 'invalid_request');
    assertRejected(null, 'invalid_request');
    assertRejected('sale', 'invalid_request');
  });

  await it('rejects return events as unsupported for now', () => {
    assertRejected({ ...buildBody(), kind: 'return' }, 'unsupported_kind');
  });

  await it('rejects an unknown kind', () => {
    assertRejected(
      { ...buildBody(), kind: 'refund' },
      'invalid_request',
      'kind',
    );
  });

  await it('rejects occurred_at without a UTC offset', () => {
    assertRejected(
      { ...buildBody(), occurred_at: '2026-10-13T12:00:00' },
      'invalid_request',
      'occurred_at',
    );
  });

  await it('rejects an impossible date even with an offset', () => {
    assertRejected(
      { ...buildBody(), occurred_at: '2026-13-45T12:00:00+06:00' },
      'invalid_request',
      'occurred_at',
    );
  });

  await it('rejects ids that are not UUIDs', () => {
    assertRejected(
      { ...buildBody(), outlet_id: 'outlet-1' },
      'invalid_request',
      'outlet_id',
    );
    assertRejected(
      buildBodyWithLine({ product_id: '42' }),
      'invalid_request',
      'lines.0.product_id',
    );
  });

  await it('rejects money sent as a number, negative or with a fraction', () => {
    assertRejected(
      buildBodyWithLine({ unit_price_minor: 5000 }),
      'invalid_request',
      'lines.0.unit_price_minor',
    );
    assertRejected(
      buildBodyWithLine({ unit_price_minor: '-5000' }),
      'invalid_request',
      'lines.0.unit_price_minor',
    );
    assertRejected(
      buildBodyWithLine({ line_amount_minor: '10000.5' }),
      'invalid_request',
      'lines.0.line_amount_minor',
    );
    assertRejected(
      buildBodyWithLine({ line_amount_minor: '010000' }),
      'invalid_request',
      'lines.0.line_amount_minor',
    );
  });

  await it('rejects a fractional or string quantity', () => {
    assertRejected(
      buildBodyWithLine({ quantity: 1.5 }),
      'invalid_request',
      'lines.0.quantity',
    );
    assertRejected(
      buildBodyWithLine({ quantity: '2' }),
      'invalid_request',
      'lines.0.quantity',
    );
  });

  await it('rejects unknown fields at the top level and in lines', () => {
    assertRejected(
      { ...buildBody(), discount: '100' },
      'invalid_request',
      'discount',
    );
    assertRejected(
      buildBodyWithLine({ tax: '10' }),
      'invalid_request',
      'lines.0.tax',
    );
  });

  await it('rejects missing fields', () => {
    const body = buildBody();
    delete body.receipt_id;

    assertRejected(body, 'invalid_request', 'receipt_id');
  });

  await it('rejects lines that are not an array', () => {
    assertRejected(
      { ...buildBody(), lines: 'none' },
      'invalid_request',
      'lines',
    );
  });
  await it('rejects non-object line elements instead of throwing TypeError', () => {
    for (const line of [null, 1, 'line', [], [buildBodyWithLine({})]]) {
      assertRejected({ ...buildBody(), lines: [line] }, 'invalid_request');
    }
  });
  await it('rejects timestamp precision beyond milliseconds with its own code', () => {
    for (const fraction of ['0001', '0002', '123000']) {
      assertRejected(
        { ...buildBody(), occurred_at: `2026-10-13T06:00:00.${fraction}Z` },
        'timestamp_precision',
      );
    }
  });
  await it('normalizes every UUID to lowercase', () => {
    const id = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    const body = buildBodyWithLine({ sale_line_id: id, product_id: id });
    const sale = new ParseSaleEventPipe().transform({
      ...body,
      event_id: id,
      receipt_id: id,
      outlet_id: id,
    });
    assert.equal(sale.event_id, id.toLowerCase());
    assert.equal(sale.receipt_id, id.toLowerCase());
    assert.equal(sale.outlet_id, id.toLowerCase());
    assert.equal(sale.lines[0]?.sale_line_id, id.toLowerCase());
    assert.equal(sale.lines[0]?.product_id, id.toLowerCase());
  });
});
