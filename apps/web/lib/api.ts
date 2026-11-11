import { t, getLocale } from './i18n';
const DEFAULT_API_URL = 'http://localhost:4000/api';

function getRuntimeApiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window === 'undefined') {
    return DEFAULT_API_URL;
  }

  const { protocol, hostname } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (!isLocalHost) {
    return `${protocol}//${hostname}:4000/api`;
  }

  return DEFAULT_API_URL;
}

function normalizeApiBaseUrl(value?: string) {
  const baseUrl = (value || DEFAULT_API_URL).replace(/\/+$/, '');
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
}

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizeApiBaseUrl(getRuntimeApiUrl())}${normalizedPath}`;
}

export async function getApiError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    if (Array.isArray(body.message)) {
      return body.message.map((message: string) => localizeApiMessage(message, fallback)).join(', ');
    }
    if (typeof body.message === 'string') {
      return localizeApiMessage(body.message, fallback);
    }
  } catch {
    // Keep the original fallback when the API returns an empty or non-JSON body.
  }

  return fallback;
}

function localizeApiMessage(message: string, fallback: string) {
  const translated = t(message);
  if (getLocale() === 'en' || translated !== message) return translated;
  return fallback || t('Request failed. Check your input and try again.');
}
