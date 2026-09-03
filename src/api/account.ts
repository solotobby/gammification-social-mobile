import { api } from './client';
import { tintFor } from './timeline';
import type {
  ApiEnvelope,
  ApiReferralUser,
  ApiTransaction,
  BankData,
  ReferralsResponse,
  Socials,
  TransactionsResponse,
  UpdateProfilePayload,
  WalletBalancesData,
  WithdrawalMethod,
} from './types';
import type { MemberTint } from '../data/community';

// ---------------------------------------------------------------------------
// Bank / payout method
// ---------------------------------------------------------------------------

/**
 * GET /user/bank — the payout form to render plus the saved method.
 *
 * The form is server-driven: which fields appear depends on the account's
 * wallet currency, so the screen must build itself from `data.form.fields`
 * rather than assume a Nigerian bank account.
 */
export async function fetchBank(): Promise<BankData> {
  const { data } = await api.get<ApiEnvelope<BankData>>('/user/bank');
  return data.data;
}

/**
 * GET /user/wallet — the balance breakdown (main / referral / promoter) plus the
 * total, each with a `formatted` string the backend has already stamped with the
 * account's currency symbol.
 */
export async function fetchWallet(): Promise<WalletBalancesData> {
  const { data } = await api.get<ApiEnvelope<WalletBalancesData>>('/user/wallet');
  return data.data;
}

/** POST /user/bank — values keyed by the field names the form handed us. */
export async function saveBank(
  values: Record<string, string>,
): Promise<WithdrawalMethod> {
  const { data } = await api.post<ApiEnvelope<WithdrawalMethod>>('/user/bank', values);
  return data.data;
}

// ---------------------------------------------------------------------------
// Referrals & transactions
//
// Both break the usual envelope: the rows are a Laravel paginator under `data`,
// and the aggregate sits NEXT TO it at the envelope root (`summary` /`stats`),
// not inside it. Shapes confirmed against the live API 2026-08-24.
//
// Both lists came back empty on the test account, so the per-row readers below
// still try more than one field name each — that part is inference, not
// verified contract.
// ---------------------------------------------------------------------------

function num(...values: (number | string | undefined | null)[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

/** A referred user as the screens render them. */
export type ReferredUser = {
  id: string;
  name: string;
  handle: string;
  tint: MemberTint;
  joined: string;
  earned: number;
  status?: string;
};

export type ReferralsResult = {
  users: ReferredUser[];
  /** `summary.total` — everyone who signed up with the code. */
  total: number;
  /** `summary.this_month`. */
  thisMonth: number;
  /** `summary.referral_code` — the same code /user/me reports. */
  code?: string;
};

export async function fetchReferrals(): Promise<ReferralsResult> {
  const { data } = await api.get<ReferralsResponse>('/user/referrals');
  const rows = data.data?.data ?? [];

  const users = rows.map((row, index): ReferredUser => {
    const id = row.id ?? `referral-${index}`;
    return {
      id,
      name: row.name ?? row.username ?? 'Member',
      handle: row.username ?? '',
      tint: tintFor(id),
      joined: formatDate(row.created_at ?? row.joined_at),
      earned: num(row.earned, row.bonus, row.amount),
      status: row.status,
    };
  });

  return {
    users,
    // `summary` is the authority; the paginator's own total is the fallback.
    total: num(data.summary?.total, data.data?.total, users.length),
    thisMonth: num(data.summary?.this_month),
    code: data.summary?.referral_code,
  };
}

/** A payout / referral entry as the transactions screen renders it. */
export type AccountTransaction = {
  id: string;
  reference: string;
  description: string;
  amount: number;
  date: string;
  kind: 'payout' | 'referral' | 'other';
  status: string;
};

function kindOf(raw: string | undefined): AccountTransaction['kind'] {
  const value = (raw ?? '').toLowerCase();
  if (value.includes('referral')) return 'referral';
  if (value.includes('payout') || value.includes('withdraw')) return 'payout';
  return 'other';
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function fetchTransactions(): Promise<AccountTransaction[]> {
  const { data } = await api.get<TransactionsResponse>('/user/transactions');
  const rows = data.data?.data ?? [];

  return rows.map((row, index): AccountTransaction => ({
    id: row.id ?? row.ref ?? row.reference ?? `tx-${index}`,
    // Live rows call it `ref`; `reference` is the checkout response's name.
    reference: row.ref ?? row.reference ?? '',
    description: row.description ?? row.narration ?? row.title ?? 'Transaction',
    amount: num(row.amount),
    date: formatDate(row.created_at ?? row.date),
    kind: kindOf(row.type ?? row.kind),
    status: row.status ?? '',
  }));
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** PUT /user/profile — date of birth, gender, location, about. */
export async function updateProfile(payload: UpdateProfilePayload): Promise<void> {
  await api.put('/user/profile', payload);
}

/** GET /user/socials — current handles/links. */
export async function fetchSocials(): Promise<Socials> {
  const { data } = await api.get<ApiEnvelope<Socials>>('/user/socials');
  // Some responses nest under `socials` rather than sitting on `data` directly.
  const payload = (data.data ?? {}) as Socials & { socials?: Socials };
  return payload.socials ?? payload;
}

/** PUT /user/socials. */
export async function updateSocials(payload: Socials): Promise<void> {
  await api.put('/user/socials', payload);
}
