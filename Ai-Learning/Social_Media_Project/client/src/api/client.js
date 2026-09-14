/**
 * client/src/api/client.js
 * ========================
 * Reusable HTTP API Client
 * 
 * Why this is useful:
 * 1. Automatically includes { credentials: 'include' } with every fetch request
 *    so browser HTTP-Only authentication cookies are sent and received seamlessly.
 * 2. Parses JSON responses automatically and throws formatted errors when non-200.
 * 3. Keeps all HTTP logic in one place instead of scattered fetch calls across components.
 */

const API_BASE = '/api';

export const apiClient = {
  async get(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });
    return handleResponse(res, endpoint);
  },

  async post(endpoint, body) {
    const isFormData = body instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: isFormData ? body : JSON.stringify(body)
    });
    return handleResponse(res, endpoint);
  },

  async put(endpoint, body) {
    const isFormData = body instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      credentials: 'include',
      headers,
      body: isFormData ? body : JSON.stringify(body)
    });
    return handleResponse(res, endpoint);
  },

  async patch(endpoint, body) {
    const isFormData = body instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      credentials: 'include',
      headers,
      body: isFormData ? body : JSON.stringify(body)
    });
    return handleResponse(res, endpoint);
  },

  async delete(endpoint, body) {
    const isFormData = body instanceof FormData;
    const headers = body ? (isFormData ? {} : { 'Content-Type': 'application/json' }) : {};

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      credentials: 'include',
      headers,
      ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {})
    });
    return handleResponse(res, endpoint);
  }
};

async function handleResponse(res, endpoint = '') {
  let data = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = { message: await res.text() };
  }

  if (!res.ok) {
    // If a protected session request returns 401 (excluding initial login/register credential checks),
    // broadcast session expiration event for immediate UI synchronization.
    // NOTE: In-app password verifications (e.g., updating email, phone, or password in settings)
    // should NOT invalidate the session if the user mistypes their password.
    const isAuthAttempt = endpoint === '/auth/login' || endpoint === '/auth/register';
    const isPasswordError = Boolean(data?.error && /password/i.test(data.error));

    if (res.status === 401 && !isAuthAttempt && !isPasswordError && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vibegrid:session-expired', {
        detail: { endpoint, status: 401 }
      }));
    }

    const errorMessage = (data && data.error) || (data && data.message) || `HTTP error ${res.status}`;
    const error = new Error(errorMessage);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export default apiClient;
