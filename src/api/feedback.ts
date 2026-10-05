/**
 * Send feedback — the mobile twin of the web's Settings → "Send feedback"
 * (`payhankey.com/feedback`).
 *
 * **There is no API for this yet.** On the web, submitting starts a support
 * conversation the admin team can reply to; the backend team is building the
 * endpoint. Until it ships, `submitFeedback` is a stand-in that never touches
 * the network and always answers "coming soon", so the screen can be built and
 * reviewed against its real states (sending → answered).
 *
 * When the endpoint lands, replace the body of `submitFeedback` with the real
 * request and map its response into `FeedbackResult` — the screen reads only
 * that type, so nothing else should need to change.
 */

/** The four kinds the web form offers, in its order. */
export type FeedbackType = 'complaint' | 'suggestion' | 'improvement' | 'bug';

export type FeedbackPayload = {
  type: FeedbackType;
  subject: string;
  details: string;
};

export type FeedbackResult =
  /** The placeholder's only answer — nothing was sent anywhere. */
  | { status: 'coming_soon'; message: string }
  /** Reserved for the real endpoint: the conversation it opened, if any. */
  | { status: 'sent'; message: string; conversationId?: string };

/** Long enough to show the sending state, short enough not to feel broken. */
const PLACEHOLDER_DELAY_MS = 900;

export async function submitFeedback(_payload: FeedbackPayload): Promise<FeedbackResult> {
  // TODO(backend): POST the payload once the feedback endpoint exists.
  await new Promise((resolve) => setTimeout(resolve, PLACEHOLDER_DELAY_MS));
  return {
    status: 'coming_soon',
    message:
      "Sending feedback from the app is coming soon. We've kept what you wrote, so nothing is lost.",
  };
}
