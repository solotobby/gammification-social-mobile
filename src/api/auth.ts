import { api } from './client';
import type {
  ApiEnvelope,
  ForgotPasswordData,
  ForgotPasswordPayload,
  LoginData,
  LoginPayload,
  MeData,
  OnboardPayload,
  RegisterData,
  RegisterPayload,
  ResendOtpPayload,
  ResetPasswordPayload,
  VerifyOtpData,
  VerifyOtpPayload,
} from './types';

export async function register(payload: RegisterPayload): Promise<RegisterData> {
  const { data } = await api.post<ApiEnvelope<RegisterData>>('/register', payload);
  return data.data;
}

export async function verifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpData> {
  const { data } = await api.post<ApiEnvelope<VerifyOtpData>>('/verify/otp', payload);
  return data.data;
}

export async function resendOtp(payload: ResendOtpPayload): Promise<void> {
  await api.post('/resend/otp', payload);
}

export async function login(payload: LoginPayload): Promise<LoginData> {
  const { data } = await api.post<ApiEnvelope<LoginData>>('/login', payload);
  return data.data;
}

/**
 * `token` lets callers authenticate before the session is stored — e.g. right
 * after OTP verification, when the token exists but isn't in the store yet.
 */
export async function fetchMe(token?: string): Promise<MeData> {
  const { data } = await api.get<ApiEnvelope<MeData>>(
    '/user/me',
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  );
  return data.data;
}

export async function updateOnboarding(payload: OnboardPayload): Promise<void> {
  await api.post('/user/onboard', payload);
}

/**
 * POST /forgot-password — emails a 6-digit reset code.
 *
 * 404s with "We could not find an account associated with this email address."
 * for an unknown address (so it does disclose whether an account exists — a
 * backend policy call, not something the client should paper over; its wording
 * is good, so it is surfaced as-is). A syntactically valid address at a domain
 * with no MX record is rejected 422 as "not a valid email address", because the
 * rule includes a DNS check — worth knowing when a test address looks fine.
 */
export async function forgotPassword(
  payload: ForgotPasswordPayload,
): Promise<ForgotPasswordData> {
  const { data } = await api.post<ApiEnvelope<ForgotPasswordData>>(
    '/forgot-password',
    payload,
  );
  return data.data;
}

/**
 * POST /reset-password — checks the code and sets the new password in one call.
 *
 * There is no separate "verify this reset code" endpoint, so the OTP screen
 * cannot validate the code on its own: it collects the digits and hands them
 * here. A wrong or stale code fails at this step with 422 "Invalid or expired
 * OTP code.", which is why the reset screen keeps a route back to re-enter it.
 */
export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  await api.post('/reset-password', payload);
}
