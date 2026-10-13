export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function formatBasisPoints(value: number | null): string {
  if (value === null || !Number.isSafeInteger(value)) return '—';
  const amount = BigInt(value);
  const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '-' : amount > 0n ? '+' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}%`;
}
