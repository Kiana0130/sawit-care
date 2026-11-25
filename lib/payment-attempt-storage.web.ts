// Attempt IDs contain no credentials. Fail closed if persistent storage is unavailable.
export async function get(key: string): Promise<string | null> { return localStorage.getItem(key); }
export async function set(key: string, value: string): Promise<void> { localStorage.setItem(key, value); }
export async function remove(key: string): Promise<void> { localStorage.removeItem(key); }
