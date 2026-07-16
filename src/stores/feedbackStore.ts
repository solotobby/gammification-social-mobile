import { create } from 'zustand';

import { ApiError } from '../api/client';

/**
 * Global user feedback: a blocking modal for hard failures (network down,
 * server errors) and a transient toast for soft ones (wrong OTP, bad
 * credentials, confirmations). Hosts live in app/_layout.tsx; screens call
 * the actions — usually `showApiError` for anything a mutation throws.
 */

export type ToastKind = 'success' | 'error' | 'info';

export type Toast = {
  /** Changes on every show so the host restarts its timer/animation. */
  id: number;
  message: string;
  kind: ToastKind;
};

export type ErrorModalContent = {
  title: string;
  message: string;
};

type FeedbackState = {
  toast: Toast | null;
  errorModal: ErrorModalContent | null;
  showToast: (message: string, kind?: ToastKind) => void;
  hideToast: () => void;
  showErrorModal: (message: string, title?: string) => void;
  hideErrorModal: () => void;
  /**
   * Route an API failure to the right surface: network/timeout/5xx problems
   * get the modal; 4xx business errors (wrong code, bad credentials) get an
   * error toast. Errors whose field messages the form already renders inline
   * should not be passed here.
   */
  showApiError: (error: unknown, fallbackMessage?: string) => void;
};

let nextToastId = 1;

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  toast: null,
  errorModal: null,

  showToast: (message, kind = 'info') =>
    set({ toast: { id: nextToastId++, message, kind } }),

  hideToast: () => set({ toast: null }),

  showErrorModal: (message, title = 'Something went wrong') =>
    set({ errorModal: { title, message } }),

  hideErrorModal: () => set({ errorModal: null }),

  showApiError: (error, fallbackMessage = 'Something went wrong. Please try again.') => {
    if (error instanceof ApiError) {
      const isHard = error.status === undefined || error.status >= 500;
      if (isHard) {
        get().showErrorModal(
          error.message,
          error.status === undefined ? 'Connection problem' : 'Server error',
        );
      } else {
        get().showToast(error.firstMessage, 'error');
      }
      return;
    }
    get().showErrorModal(fallbackMessage);
  },
}));
