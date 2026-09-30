import { inv } from './tauri-client';

export interface LoginResponse {
  accessToken: string;
  username: string;
}

export function login(username: string, password: string) {
  return inv<LoginResponse>('login', { username, password });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return inv<void>('change_password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

/** First-run setup: only works while the users table is empty. */
export function initAdmin(username: string, password: string) {
  return inv<LoginResponse>('init_admin', { username, password });
}
