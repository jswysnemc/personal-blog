const API_BASE = 'http://localhost:3001';
const ADMIN_TOKEN_KEY = 'blog_admin_token';

export async function login(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();

    if (res.ok && data.token) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      return { success: true };
    }

    return { success: false, error: data.error || 'Login failed' };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

export async function verifySession(): Promise<boolean> {
  try {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) return false;

    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

export function isAdminLoggedIn(): boolean {
  try {
    return !!sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return false;
  }
}

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (token) {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    }
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}
