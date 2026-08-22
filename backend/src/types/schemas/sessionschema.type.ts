export type SessionType = {
  // Session Base fields
  id: string;
  userId: string;
  // Session Account fields
  activeSessionCount: number;
  totalSessionCount: number;
  // Session Token fields
  tokenFamily: string;
  refreshToken: string;
  accessToken: string;
  // Session Status fields
  isActive: boolean;
  isRevoked: boolean;
  // Session MetaData fields
  loginCount: number;
  failedLoginAttempts: number;
  // Session Expiration fields
  isExpired: boolean;
  expiryDate: Date;
  // Session Device fields
  deviceType: "desktop" | "mobile" | "tablet";
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
};
