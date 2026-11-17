const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
let token: string | null = null;
export function setAccessToken(value: string | null) {
  token = value;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(
      Array.isArray(result.message)
        ? result.message.join(' · ')
        : result.message || 'Service indisponible. Réessayez.',
      response.status,
    );
  }
  return result as T;
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Une erreur est survenue.';
}
