const USERNAME_KEY = 'rsh_username';

export function loadUsername() {
  return localStorage.getItem(USERNAME_KEY) || '';
}

export function saveUsername(name) {
  localStorage.setItem(USERNAME_KEY, String(name ?? '').trim());
}

export function hasUsername() {
  return loadUsername() !== '';
}
