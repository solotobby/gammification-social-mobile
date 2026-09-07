import type { ApiCommunityType } from '../../api/types';

/**
 * Display copy for the four community types, shared by the create form's radio
 * cards and the `CommunityBadge` pill so the two can never drift.
 *
 * `blurb` is the web's own wording — the type is the single most consequential
 * choice on the create form (it decides whether anyone can join at all), so the
 * explanation of each is worth keeping identical across platforms. It is
 * written for someone *choosing*, so it says things like "you choose below".
 *
 * `summary` is the same fact stated for someone who has already chosen — used
 * wherever the type is shown read-only (community settings), where the create
 * form's forward references would be nonsense.
 */
export const STATUS_META: Record<
  ApiCommunityType,
  { label: string; short: string; icon: string; blurb: string; summary: string }
> = {
  public: {
    label: 'Public',
    short: 'Public',
    icon: 'globe-outline',
    blurb: 'Anyone can find and join instantly.',
    summary: 'Anyone can find this community and join instantly.',
  },
  private: {
    label: 'Private (invite only)',
    short: 'Private',
    icon: 'lock-closed-outline',
    blurb: 'Hidden from search — only people you invite can join.',
    summary: 'Hidden from search. Only people who open your invite link can join.',
  },
  paid: {
    label: 'Paid',
    short: 'Paid',
    icon: 'cash-outline',
    blurb:
      'Members pay to join — either a one-time payment, or a recurring subscription. You choose below.',
    summary: 'Members pay to join before they can see the feed.',
  },
  approval: {
    label: 'Approval required',
    short: 'Approval',
    icon: 'time-outline',
    blurb: 'Visible to everyone, but joining needs admin acceptance.',
    summary: 'Visible to everyone, but every join request needs your approval.',
  },
};

/**
 * The label for the membership button, given the community's type and the
 * viewer's own membership.
 *
 * `public`, `approval` and — since `POST /communities/{id}/subscribe` shipped —
 * `paid` are all joinable from the app; only `private` isn't, because it needs
 * an invite token that arrives in a link rather than from any endpoint the app
 * can call. It still renders a button (pressing it surfaces the backend's own
 * explanation) but is marked `blocked` so the screen can say why up front
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
      // Pressing this opens checkout, not POST /join.
      return { label: 'Pay to join', blocked: false };
    default:
      return { label: 'Join', blocked: false };
  }
}
