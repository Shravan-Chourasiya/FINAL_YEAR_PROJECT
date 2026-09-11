// Facade that keeps the existing `api.*` call-site shape while delegating to
// the typed service modules. Callers that already use `api.xxx()` continue to
// work without changes; new code should import from the service modules directly.

import { ApiError } from "./http";
import * as authSvc from "./services/auth.service";
import * as interviewSvc from "./services/interview.service";
import { ENDPOINTS } from "./constants/endpoints";
import type {
  InterviewResponse,
  MeResponse,
  SessionResponse,
  BackendInterviewStatus,
} from "./types/api";
import type {
  Interview,
  InterviewConfig,
  InterviewReport,
  Session,
  TimelineEvent,
  User,
} from "./types";

export { ApiError };

// ── Normalizers ───────────────────────────────────────────────────────────────

let pendingEmailValue = "";

function pendingEmail(): string {
  return pendingEmailValue;
}

function normalizeUser(u: MeResponse): User {
  return {
    id: u.id,
    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username,
    email: "",
    joinedAt: u.createdAt ?? new Date().toISOString(),
    role: u.userrole === "admin" ? "admin" : "candidate",
  };
}

function normalizeStatus(s: BackendInterviewStatus): Interview["status"] {
  if (s === "INPROGRESS") return "IN_PROGRESS";
  if (s === "DRAFT") return "CREATED";
  if (s === "TIMED_OUT" || s === "EXPIRED") return "ABANDONED";
  if (s === "SCHEDULED") return "READY";
  return s as Interview["status"];
}

function normalizeInterview(i: InterviewResponse): Interview {
  return {
    ...(i as unknown as Interview),
    id: i.id,
    userId: i.userId,
    status: normalizeStatus(i.status),
    createdAt: i.createdAt,
    lastActivityAt: i.lastActivityAt ?? i.createdAt,
    progress: (i.progress as number | undefined) ?? 0,
    score: (i.score as number | null | undefined) ?? null,
    currentRound: (i.currentRound as number | undefined) ?? 1,
    currentQuestion: (i.currentQuestion as number | undefined) ?? 0,
  };
}

function normalizeSession(s: SessionResponse): Session {
  return {
    id: s.id,
    device: s.deviceType,
    location: s.ipAddress,
    lastActive: s.createdAt,
    current: s.isActive && !s.isRevoked && !s.isExpired,
  };
}

// ── api facade ────────────────────────────────────────────────────────────────

export const api = {
  // ── Auth ───────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<User> {
    await authSvc.login({ email, password, deviceType: "desktop" });
    return normalizeUser(await authSvc.me());
  },

  async register(name: string, email: string, password: string): Promise<void> {
    const [firstName, ...rest] = name.trim().split(/\s+/);
    pendingEmailValue = email;
    await authSvc.register({
      email,
      password,
      username: email.split("@")[0] ?? email,
      firstName,
      ...(rest.length > 0 ? { lastName: rest.join(" ") } : {}),
    });
  },

  async verifyEmail(email: string, otp: string): Promise<void> {
    return authSvc.verifyOtp({ email, otp });
  },

  async resendCode(): Promise<void> {
    // Re-trigger registration OTP by calling forgot-password flow is wrong;
    // the backend re-sends on a dedicated resend endpoint — use verifyOtp path
    // with empty otp to trigger resend if backend supports it, otherwise
    // the caller should use forgotPassword. For now mirror old behaviour:
    return authSvc.forgotPassword({ email: pendingEmail() });
  },

  async requestPasswordReset(email: string): Promise<void> {
    pendingEmailValue = email;
    return authSvc.forgotPassword({ email });
  },

  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    return authSvc.forgotPasswordVerify({
      email,
      otp,
      newPassword,
      confirmPassword: newPassword,
    });
  },

  async me(): Promise<User> {
    return normalizeUser(await authSvc.me());
  },

  async logout(): Promise<void> {
    return authSvc.logout();
  },

  // ── Sessions ───────────────────────────────────────────────────────────────

  async listSessions(): Promise<Session[]> {
    const data = await authSvc.sessions();
    return data.map(normalizeSession);
  },

  async revokeSession(id: string): Promise<void> {
    return authSvc.revokeSession(id);
  },

  async revokeOtherSessions(): Promise<void> {
    return authSvc.revokeAllSessions();
  },

  // ── Interviews ─────────────────────────────────────────────────────────────

  async listInterviews(): Promise<Interview[]> {
    const data = await interviewSvc.listInterviews();
    return data.map(normalizeInterview);
  },

  async getInterview(id: string): Promise<Interview | null> {
    try {
      return normalizeInterview(await interviewSvc.getInterview(id));
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.code === "INTERVIEW_NOT_FOUND" ||
          err.code === "RESOURCE_NOT_FOUND")
      )
        return null;
      throw err;
    }
  },

  async createInterview(config: InterviewConfig): Promise<string> {
    const data = await interviewSvc.createInterview(config);
    return data.id ?? data.interviewId ?? "";
  },

  async cancelInterview(id: string): Promise<void> {
    return interviewSvc.cancelInterview(id);
  },

  async getReport(id: string): Promise<InterviewReport> {
    const data = await interviewSvc.getInterviewReport(id);
    return data as unknown as InterviewReport;
  },

  async getMetrics(id: string): Promise<unknown> {
    return interviewSvc.getInterviewMetrics(id);
  },

  async getHistory(id: string): Promise<TimelineEvent[]> {
    return interviewSvc.getInterviewHistory(id);
  },

  // ── Profile ────────────────────────────────────────────────────────────────

  async updateProfile(
    patch: Partial<Pick<User, "name" | "email">>,
  ): Promise<User> {
    if (patch.email) {
      await authSvc.updateEmail({ email: patch.email });
    }
    return normalizeUser(await authSvc.me());
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    return authSvc.updatePassword({
      email: pendingEmail(),
      currentPassword,
      newPassword,
    });
  },
};

// Re-export ENDPOINTS so callers that do `import { ENDPOINTS } from '@/lib/api'`
// continue to work.
export { ENDPOINTS };
