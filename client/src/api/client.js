const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const options = {
    method,
    credentials: 'include',
    headers: {
      ...headers,
    },
  };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new ApiError(
      'Unable to reach the restaurant server. Check that the backend is running.',
      0,
      'NETWORK_ERROR',
    );
  }

  if (response.status === 204) return null;

  let payload = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      window.dispatchEvent(new Event('apna-order:unauthorized'));
    }
    const error = payload?.error;
    throw new ApiError(
      error?.message || `Request failed with status ${response.status}.`,
      response.status,
      error?.code || 'REQUEST_FAILED',
      error?.details,
    );
  }

  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body, headers) => request(path, { method: 'POST', body, headers }),
  patch: (path, body, headers) => request(path, { method: 'PATCH', body, headers }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const result = search.toString();
  return result ? `?${result}` : '';
}

export { API_BASE };
