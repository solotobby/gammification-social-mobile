import { useMutation } from '@tanstack/react-query';

import { submitFeedback, type FeedbackPayload } from '../api/feedback';
import { useFeedbackStore } from '../stores/feedbackStore';

/**
 * Send feedback. Backed by a placeholder until the endpoint exists — see
 * src/api/feedback.ts. The screen renders the result itself, so there is no
 * success toast here; only a thrown error (the real endpoint, later) toasts.
 */
export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (payload: FeedbackPayload) => submitFeedback(payload),
    onError: (error) =>
      useFeedbackStore.getState().showApiError(error, "Couldn't send your feedback."),
  });
}
