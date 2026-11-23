import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '@/lib/auth-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

export type User = {
  id: string;
  name: string;
  email: string;
  plan: string;
  subscription_end_date: string | null;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

type AuthResponse = {
  user: User;
  tokens: TokenResponse;
};

type ErrorPayload = {
  detail?: string;
  error?: { code?: string; message?: string };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const messages: Record<string, string> = {
    INVALID_CREDENTIALS: 'Email atau password salah.',
    EMAIL_ALREADY_EXISTS: 'Email sudah terdaftar. Silakan gunakan email lain.',
    UNAUTHENTICATED: 'Sesi Anda sudah berakhir. Silakan login kembali.',
    VALIDATION_ERROR: 'Data yang dimasukkan belum valid.',
    INVALID_EMAIL: 'Format email tidak valid. Periksa kembali email Anda.',
    INVALID_PASSWORD: 'Password belum memenuhi ketentuan.',
    INVALID_INPUT: 'Data yang dimasukkan belum valid.',
  };
  return messages[error.code] ?? error.message ?? fallback;
}

async function parseError(response: Response): Promise<ApiError> {
  let payload: ErrorPayload = {};
  try {
    payload = (await response.json()) as ErrorPayload;
  } catch {
    // Keep the HTTP status when the backend does not return JSON.
  }
  const code = payload.error?.code ?? payload.detail ?? 'REQUEST_FAILED';
  const message = payload.error?.message ?? payload.detail ?? 'Terjadi kesalahan. Silakan coba lagi.';
  return new ApiError(response.status, code, message);
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const accessToken = await getAccessToken();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL ?? 'http://localhost:8000/v1'}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Tidak dapat terhubung ke server. Periksa alamat API dan koneksi jaringan.');
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  if (response.status === 401 && retry && path !== '/auth/refresh') {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(path, init, false);
  }

  throw await parseError(response);
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_URL ?? 'http://localhost:8000/v1'}/auth/refresh`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!response.ok) {
          await clearTokens();
          return false;
        }
        const tokens = (await response.json()) as TokenResponse;
        await saveTokens(tokens.access_token, tokens.refresh_token);
        return true;
      } catch {
        return false;
      }
    })();
  }

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const result = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  await saveTokens(result.tokens.access_token, result.tokens.refresh_token);
  return result;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const result = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await saveTokens(result.tokens.access_token, result.tokens.refresh_token);
  return result;
}

export async function getProfile(): Promise<User> {
  return request<User>('/users/me');
}

export async function logout(): Promise<void> {
  const accessToken = await getAccessToken();
  try {
    let response: Response;
    try {
      response = await fetch(`${API_URL ?? 'http://localhost:8000/v1'}/auth/logout`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
    } catch {
      return;
    }
    if (!response.ok && response.status !== 401) throw await parseError(response);
  } finally {
    await clearTokens();
  }
}
