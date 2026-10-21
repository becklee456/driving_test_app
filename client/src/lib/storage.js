/**
 * Access-token holder. The token lives ONLY in module memory: it is never
 * persisted to localStorage/sessionStorage so XSS or a shared machine cannot
 * read it after the tab closes. Requests are authenticated either with this
 * in-memory Bearer token or the httpOnly `idt_access` cookie set by the API.
 */
let accessToken = null;

export const storage = {
  getToken() {
    return accessToken;
  },
  setToken(token) {
    accessToken = token || null;
  },
  clear() {
    accessToken = null;
  },
};

export default storage;
