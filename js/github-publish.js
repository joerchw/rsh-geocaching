const TOKEN_KEY = 'rsh_github_token';

export function loadGithubToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveGithubToken(token) {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearGithubToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// btoa() alone mangles non-ASCII text (each UTF-16 code unit truncated to its low
// byte) — the same class of bug that broke German umlauts in QR codes, see
// js/qrcode-setup.js. Encode as real UTF-8 bytes first, then base64 those bytes.
export function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
