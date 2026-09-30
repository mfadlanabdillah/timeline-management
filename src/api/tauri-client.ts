import { invoke } from '@tauri-apps/api/core';

export const TOKEN_KEY = 'timeline_token';
export const USERNAME_KEY = 'timeline_username';

/** Auth token the admin received at login (local JWT, device secret). */
export function sessionToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Single choke point for every backend call. Rust returns `Err(String)` with a
 * `CODE: message` prefix; UNAUTH clears the session like the old 401 interceptor.
 */
export async function inv<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (raw) {
    const message = typeof raw === 'string' ? raw : String(raw);
    if (message.startsWith('UNAUTH:') && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USERNAME_KEY);
      if (!window.location.hash.startsWith('#/login')) {
        window.location.assign('#/login');
      }
    }
    throw new Error(message);
  }
}
