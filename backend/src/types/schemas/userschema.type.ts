export type UserType = {
  // User Base fields
  id: string;
  email: string;
  password: string;
  username: string;
  // User Account fields
  isVerified: boolean;
  accountStatus: "blacklisted" | "active" | "suspended" | "deleted";
  oauthProvider: "google" | "facebook" | "github" | "none";
  isOauthEnabled: boolean;
  // User Profile fields
  firstName?: string | undefined;
  lastName?: string | undefined;
  bio?: string | undefined;
  organisation?: string | undefined;
  country?: string | undefined;
  // 2FA fields
  twoFAtype: "none" | "sms" | "authenticator";
  twoFAStatus: "enabled" | "disabled";
  twoFASecret?: string | undefined;
  twoFARecoveryCodes?: string[] | undefined;
  twoFAEnabledOptions?:
    | {
        sms: boolean;
        authenticator: boolean;
        email: boolean;
      }
    | undefined;
  // External Models Related fields
  interviewCount: number;
  subscriptionPlan: "free" | "premium" | "enterprise";
  sessionCount: number;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
};
