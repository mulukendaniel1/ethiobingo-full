//src\api\client.ts
import { showToast } from '../components/Toast';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface ApiError {
  error: string;
  code?: number;
}

let onUnauthorized: (reason: 'duplicate' | 'expired' | 'invalid') => void = () => {};

export function setUnauthorizedHandler(handler: typeof onUnauthorized) {
  onUnauthorized = handler;
}

function getToken(): string | null {
  return localStorage.getItem('admin_token');
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  // Build headers as a plain object
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Merge any custom headers
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  // Add token if present
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error || 'Something went wrong';
    const status = response.status;

    if (status === 401) {
      // Unauthorized – determine reason from error message
      if (errorMsg.toLowerCase().includes('duplicate') || errorMsg.toLowerCase().includes('another session')) {
        onUnauthorized('duplicate');
      } else if (errorMsg.toLowerCase().includes('expired')) {
        onUnauthorized('expired');
      } else {
        onUnauthorized('invalid');
      }
      throw new Error(errorMsg);
    }

    if (status === 403) {
      showToast('Access denied', 'error');
      throw new Error(errorMsg);
    }

    if (status >= 500) {
      showToast('Server error, please try again', 'error');
      throw new Error(errorMsg);
    }

    // 400 errors
    showToast(errorMsg, 'error');
    throw new Error(errorMsg);
  }

  return response.json();
}