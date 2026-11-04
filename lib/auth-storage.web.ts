const memoryStore = new Map<string, string>();

const ACCESS_TOKEN_KEY = 'sawitcare.access_token';
const REFRESH_TOKEN_KEY = 'sawitcare.refresh_token';

export async function getAccessToken(): Promise<string | null> {
  return memoryStore.get(ACCESS_TOKEN_KEY) ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  return memoryStore.get(REFRESH_TOKEN_KEY) ?? null;
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  memoryStore.set(ACCESS_TOKEN_KEY, accessToken);
  memoryStore.set(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  memoryStore.delete(ACCESS_TOKEN_KEY);
  memoryStore.delete(REFRESH_TOKEN_KEY);
}
