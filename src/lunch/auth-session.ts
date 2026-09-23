// Google still verifies this credential on the server. The expiry check only
// avoids reconnecting with a credential that is already stale.
const TOKEN = "lunch-google-credential";
const RETURNING = "lunch-google-returning";
export function savedCredential(): string | null {
  try {
    const token = localStorage.getItem(TOKEN);
    if (!token) return null;
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload));
    if (typeof exp === "number" && exp * 1000 > Date.now() + 60000)
      return token;
  } catch {}
  clearCredential();
  return null;
}
export function rememberCredential(token: string) {
  try {
    localStorage.setItem(TOKEN, token);
    localStorage.setItem(RETURNING, "true");
  } catch {}
}
export function returningUser() {
  try {
    return localStorage.getItem(RETURNING) === "true";
  } catch {
    return false;
  }
}
export function clearCredential() {
  try {
    localStorage.removeItem(TOKEN);
  } catch {}
}
export function forgetSignIn() {
  clearCredential();
  try {
    localStorage.removeItem(RETURNING);
  } catch {}
}
