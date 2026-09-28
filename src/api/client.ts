import axios, { AxiosError } from 'axios';

import { useAuthStore } from '../stores/authStore';

export const BASE_URL = 'https://pky.e-portal.com.ng/api/v1';

/**
 * Normalized API failure. Screens can show `message` directly; `fieldErrors`
 * carries Laravel 422 validation messages keyed by field name.
 */
export class ApiError extends Error {
  status?: number;
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, status?: number, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** First field-level message, falling back to the top-level one. */
  get firstMessage(): string {
    const first = this.fieldErrors && Object.values(this.fieldErrors)[0]?.[0];
    return first ?? this.message;
  }
}

/**
 * Budget for multipart uploads. The default 30s is sized for JSON round-trips;
 * pushing a video over a weak-but-working connection routinely needs longer,
 * and timing it out loses a post the user already wrote.
 */
export const UPLOAD_TIMEOUT = 120_000;

/**
 * Budget for reads the backend is known to be slow on. `/user/profile/{username}`
 * measured 27–58s to first byte on 2026-09-28 (against 0.7s for `/user/me`),
 * and the gateway in front of it gives up with a 504 at 60s. Cutting it off at
 * our own 30s turned every slow-but-successful profile into "We couldn't load
 * this profile", and a timeout isn't retried. So these wait past the gateway's
 * limit and let *it* decide: a real answer lands, a real 504 surfaces as one.
 */
export const SLOW_READ_TIMEOUT = 75_000;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; errors?: Record<string, string[]>; error_temp?: string }>) => {
    if (error.response) {
      const { status, data } = error.response;
      // The API signs tokens long-lived and has no refresh endpoint, so a 401
      // on an authenticated call means the session is gone — drop it.
      if (status === 401 && useAuthStore.getState().token) {
        useAuthStore.getState().signOut();
      }
      // Some endpoints 500 with a generic message but ship the real validation
      // failure in `error_temp` (e.g. "The images field is prohibited.").
      const message = data?.message || `Request failed (${status})`;
      throw new ApiError(
        data?.error_temp ? `${message} — ${data.error_temp}` : message,
        status,
        data?.errors,
      );
    }
    throw new ApiError(
      error.code === 'ECONNABORTED'
        ? 'The request timed out. Please try again.'
        : 'Unable to reach Payhankey. Check your connection and try again.',
    );
  },
);
