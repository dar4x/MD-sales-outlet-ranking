/* External deps */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/* Internal deps */
import {
  canonicalizeSale,
  hashPayload,
} from '../src/events/application/canonical-event.js';
import type { SaleInput } from '../src/events/domain/event.js';

function buildSale(): SaleInput {
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
        unit_price_minor: 5000n,
        line_amount_minor: 10000n,
      },
      {
        sale_line_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        product_id: '55555555-5555-4555-8555-555555555555',
        quantity: 1,
        unit_price_minor: 2500n,
        line_amount_minor: 2500n,
      },
    ],
  };
}

function hashOf(sale: SaleInput): string {
  return hashPayload(canonicalizeSale(sale));
}

await describe('canonicalizeSale + hashPayload', async () => {
  await it('gives the same hash for a different key order', () => {
    const sale = buildSale();
    const reordered: SaleInput = {
      lines: sale.lines,
      occurred_at: sale.occurred_at,
      outlet_id: sale.outlet_id,
      receipt_id: sale.receipt_id,
      event_id: sale.event_id,
      kind: 'sale',
    };

    assert.equal(hashOf(reordered), hashOf(sale));
  });

  await it('gives the same hash for the same instant in another offset', () => {
    const sale = buildSale();
    const utcSale: SaleInput = {
      ...sale,
      occurred_at: '2026-10-13T06:00:00Z',
    };

    assert.equal(hashOf(utcSale), hashOf(sale));
  });

  await it('gives the same hash when lines arrive in another order', () => {
    const sale = buildSale();
    const reversedLines: SaleInput = {
      ...sale,
      lines: [...sale.lines].reverse(),
    };

    assert.equal(hashOf(reversedLines), hashOf(sale));
  });

  await it('gives a different hash for a changed quantity', () => {
    const sale = buildSale();
    const changed = buildSale();
    changed.lines[0] = { ...sale.lines[0]!, quantity: 3 };

    assert.notEqual(hashOf(changed), hashOf(sale));
  });

  await it('gives a different hash for a changed amount', () => {
    const sale = buildSale();
    const changed = buildSale();
    changed.lines[1] = { ...sale.lines[1]!, line_amount_minor: 2600n };

    assert.notEqual(hashOf(changed), hashOf(sale));
  });
});
