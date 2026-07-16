import { api } from './client';
import type {
  ApiEnvelope,
  LoginData,
  LoginPayload,
  MeData,
  OnboardPayload,
  RegisterData,
  RegisterPayload,
  ResendOtpPayload,
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
