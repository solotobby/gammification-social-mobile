import type { ApiCommunityType } from '../../api/types';

/**
 * Display copy for the four community types, shared by the create form's radio
 * cards and the `CommunityBadge` pill so the two can never drift.
 *
 * The blurbs are the web's own wording — the type is the single most consequential
 * choice on the create form (it decides whether anyone can join at all), so the
 * explanation of each is worth keeping identical across platforms.
 */
export const STATUS_META: Record<
  ApiCommunityType,
  { label: string; short: string; icon: string; blurb: string }
> = {
  public: {
    label: 'Public',
    short: 'Public',
    icon: 'globe-outline',
    blurb: 'Anyone can find and join instantly.',
  },
  private: {
    label: 'Private (invite only)',
    short: 'Private',
    icon: 'lock-closed-outline',
    blurb: 'Hidden from search — only people you invite can join.',
  },
  paid: {
    label: 'Paid',
    short: 'Paid',
    icon: 'cash-outline',
    blurb:
      'Members pay to join — either a one-time payment, or a recurring subscription. You choose below.',
  },
  approval: {
    label: 'Approval required',
    short: 'Approval',
    icon: 'time-outline',
    blurb: 'Visible to everyone, but joining needs admin acceptance.',
  },
};

/**
 * The label for the membership button, given the community's type and the
 * viewer's own membership.
 *
 * Only `public` and `approval` are actually joinable from the app:
 * `private` needs an invite token no mobile endpoint issues, and `paid` needs a
 * payment this API cannot yet take (`/subscribe`, `/pay` and `/checkout` all
 * 404). Both still render a button — pressing it surfaces the backend's own
 * explanation — but they're marked `blocked` so the screen can say why up front
 * rather than only after a failed request.
 */
export function joinActionFor(
  type: ApiCommunityType,
  membership: 'owner' | 'admin' | 'member' | 'requested' | 'none',
): { label: string; blocked: boolean } {
  if (membership === 'owner') return { label: 'Owner', blocked: true };
  // Blocked, not because joining is impossible, but because there's nothing left
  // to do here: re-joining is a no-op and leaving is a decision that belongs on
  // the community itself, not a one-tap action in a list.
  if (membership === 'admin' || membership === 'member')
    return { label: 'Joined', blocked: true };
  if (membership === 'requested') return { label: 'Requested', blocked: true };

  switch (type) {
    case 'approval':
      return { label: 'Request to join', blocked: false };
    case 'private':
      return { label: 'Invite only', blocked: true };
    case 'paid':
      return { label: 'Join', blocked: false };
    default:
      return { label: 'Join', blocked: false };
  }
}
