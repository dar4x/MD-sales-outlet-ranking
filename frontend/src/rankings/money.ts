export function formatMoney(minor: string, currency: string): string {
  const digits =
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  const amount = BigInt(minor);
  const magnitude = amount < 0n ? -amount : amount;
  const scale = 10n ** BigInt(digits);
  const whole = new Intl.NumberFormat('en-US').format(magnitude / scale);
  const fraction = digits
    ? `.${(magnitude % scale).toString().padStart(digits, '0')}`
    : '';
  return `${amount < 0n ? '-' : ''}${whole}${fraction} ${currency}`;
}
