export const TOKEN_KEY = 'lr_token';
export const UNAUTHORIZED_EVENT = 'lr:unauthorized';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage can be blocked */
  }
}

export function clearToken() {
  setToken('');
}

/** Let the React auth context know that the current session is no longer valid. */
export function notifyUnauthorized() {
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}
