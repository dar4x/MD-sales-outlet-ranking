export async function getJson(
  path: string,
  signal: AbortSignal,
  options: Pick<RequestInit, 'method' | 'body'> = {},
): Promise<unknown> {
  const baseUrl = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  const url = new URL(path, `${baseUrl}/`);
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    const error: unknown = await response.json().catch(() => null);
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      message = error.message;
    }
    throw new Error(message);
  }

  return response.json() as Promise<unknown>;
}
