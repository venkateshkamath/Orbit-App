/**
 * Turn axios/fetch errors into user-visible messages.
 */

export function formatApiError(error: unknown): string {
  const err = error as {
    message?: string;
    code?: string;
    response?: { status?: number; data?: unknown };
  };

  if (!err?.response) {
    const msg = err?.message || '';
    if (err?.code === 'ECONNABORTED' || msg.toLowerCase().includes('timeout')) {
      return 'Request timed out. Check your connection.';
    }
    if (msg === 'Network Error' || err?.code === 'ERR_NETWORK') {
      return 'Cannot reach the server. Make sure the backend is running and your phone uses the correct Wi‑Fi API URL.';
    }
    return msg || 'Network error. Please try again.';
  }

  const status = err.response.status ?? 0;
  const data = err.response.data;

  if (typeof data === 'string' && data.trim().length > 0 && data.length < 400) {
    return data.trim();
  }

  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;

    if (typeof d.detail === 'string') return d.detail;
    if (Array.isArray(d.detail)) {
      const parts = d.detail
        .map((item: unknown) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'msg' in item) {
            return String((item as { msg: string }).msg);
          }
          return null;
        })
        .filter(Boolean);
      if (parts.length) return parts.join(' ');
    }

    if (typeof d.message === 'string') return d.message;

    const fieldKeys = ['email', 'username', 'date_of_birth', 'code', 'password', 'old_password', 'new_password'] as const;
    for (const key of fieldKeys) {
      const v = d[key];
      if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
    }

    if (typeof d.error === 'string') return d.error;
  }

  if (status === 502) {
    return 'Could not send email. For local dev, check the backend terminal for the code, or configure SMTP in .env.';
  }
  if (status === 429) {
    return typeof (data as { detail?: string })?.detail === 'string'
      ? (data as { detail: string }).detail
      : 'Too many requests. Please wait a minute.';
  }
  if (status === 401) return 'Session expired. Please sign in again.';
  if (status === 404) return 'That endpoint was not found. Update the app or backend.';

  return `Something went wrong (${status || 'error'}). Please try again.`;
}
