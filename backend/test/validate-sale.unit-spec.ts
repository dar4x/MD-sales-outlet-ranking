/* External deps */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/* Internal deps */
import { EventValidationError } from '../src/events/domain/event-errors.js';
import type { SaleInput } from '../src/events/domain/event.js';
import { validateSale } from '../src/events/domain/validate-sale.js';

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
        quantity: 3,
        unit_price_minor: 2500n,
        line_amount_minor: 7500n,
      },
    ],
  };
}

function assertValidationError(sale: SaleInput, expectedCode: string): void {
  assert.throws(
    () => validateSale(sale),
    (error: unknown) =>
      error instanceof EventValidationError && error.code === expectedCode,
  );
}

await describe('validateSale', async () => {
  await it('accepts a sale whose line amount equals quantity x price', () => {
    assert.doesNotThrow(() => validateSale(buildSale()));
  });

  await it('rejects a sale without lines', () => {
    const sale = { ...buildSale(), lines: [] };

    assertValidationError(sale, 'empty_lines');
  });

  await it('rejects a zero quantity', () => {
    const sale = buildSale();
    sale.lines[0] = { ...sale.lines[0]!, quantity: 0, line_amount_minor: 0n };

    assertValidationError(sale, 'invalid_quantity');
  });

  await it('rejects a line amount that differs from quantity x price', () => {
    const sale = buildSale();
    sale.lines[0] = { ...sale.lines[0]!, line_amount_minor: 7501n };

    assertValidationError(sale, 'line_amount_mismatch');
  });

  await it('compares amounts beyond Number precision exactly', () => {
    // 2^53 + 1 cannot be represented as a JS number; bigint keeps it exact.
    const sale = buildSale();
    sale.lines[0] = {
      ...sale.lines[0]!,
      quantity: 1,
      unit_price_minor: 9007199254740993n,
      line_amount_minor: 9007199254740992n,
    };

    assertValidationError(sale, 'line_amount_mismatch');
  });

  await it('rejects a fractional quantity with 422 code, not RangeError', () => {
    const sale = buildSale();
    sale.lines[0] = { ...sale.lines[0]!, quantity: 1.5 };

    assertValidationError(sale, 'invalid_quantity');
  });

  await it('rejects a negative unit price', () => {
    const sale = buildSale();
    sale.lines[0] = {
      ...sale.lines[0]!,
      quantity: 1,
      unit_price_minor: -100n,
      line_amount_minor: -100n,
    };

    assertValidationError(sale, 'invalid_price');
  });

  await it('accepts a zero unit price (free item)', () => {
    const sale = buildSale();
    sale.lines[0] = {
      ...sale.lines[0]!,
      unit_price_minor: 0n,
      line_amount_minor: 0n,
    };

    assert.doesNotThrow(() => validateSale(sale));
  });

  await it('rejects a sale_line_id used twice in one sale', () => {
    const sale = buildSale();
    sale.lines.push({ ...sale.lines[0]!, product_id: sale.receipt_id });

    assertValidationError(sale, 'duplicate_line_id');
  });

  await it('accepts a line amount equal to the bigint storage limit', () => {
    const sale = buildSale();
    sale.lines[0] = {
      ...sale.lines[0]!,
      quantity: 1,
      unit_price_minor: 9223372036854775807n,
      line_amount_minor: 9223372036854775807n,
    };

    assert.doesNotThrow(() => validateSale(sale));
  });

  await it('rejects a line amount above the bigint storage limit', () => {
    const sale = buildSale();
    sale.lines[0] = {
      ...sale.lines[0]!,
      quantity: 2,
      unit_price_minor: 9223372036854775807n,
      line_amount_minor: 18446744073709551614n,
    };

    assertValidationError(sale, 'amount_out_of_range');
  });

  await it('rejects a sale total above the limit when every line fits', () => {
    const sale = buildSale();
    const bigLine = {
      ...sale.lines[0]!,
      quantity: 1,
      unit_price_minor: 9223372036854775807n,
      line_amount_minor: 9223372036854775807n,
    };
    sale.lines = [
      bigLine,
      { ...bigLine, sale_line_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    ];

    assertValidationError(sale, 'amount_out_of_range');
  });
});
