import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import bcrypt from "bcrypt";
import { AppError } from "../../../utils/appError.js";
import { ErrorCodes } from "../../../constants/errorCodes.js";
import { getRandomOtp } from "../../../utils/email.js";
import { sendOtpMail } from "../../../services/nodemailer.service.js";
import { otpService } from "../../../services/redis.service.js";
import { getPgDb } from "../../../db/postgres.init.js";
import { usersTable } from "../schemas/user.schema.js";
import type { RegisterInput, VerifyOtpInput } from "../zodschemas/auth.zschema.js";

const SALT_ROUNDS = 12;
const OTP_PURPOSE = "registration";

export async function registerUserService(input: RegisterInput): Promise<void> {
  const db = getPgDb();

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, input.email))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError(
      "An account with this email already exists",
      StatusCodes.CONFLICT,
      ErrorCodes.RESOURCE_ALREADY_EXISTS,
      { isOperational: true }
    );
  }

  const otp = getRandomOtp(6);

  await otpService.storeOTP(
    input.email,
    otp,
    OTP_PURPOSE,
    undefined,
    JSON.stringify({ username: input.username, password: input.password, firstName: input.firstName, lastName: input.lastName }),
  );

  await sendOtpMail(input.email, otp);
}

export async function verifyOtpService(input: VerifyOtpInput): Promise<void> {
  const result = await otpService.verifyOTP(input.email, input.otp, OTP_PURPOSE);

  if (!result.success) {
    const isRateLimit = result.message.toLowerCase().includes("too many");
    throw new AppError(
      result.message,
      isRateLimit ? StatusCodes.TOO_MANY_REQUESTS : StatusCodes.UNAUTHORIZED,
      isRateLimit ? ErrorCodes.RATE_LIMIT_EXCEEDED : ErrorCodes.AUTH_INVALID_CREDENTIALS,
      { isOperational: true }
    );
  }

  const registrationData = JSON.parse(result.newValue ?? "{}") as {
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  };

  const db = getPgDb();
  const hashedPassword = await bcrypt.hash(registrationData.password, SALT_ROUNDS);

  await db.insert(usersTable).values({
    email: input.email,
    password: hashedPassword,
    username: registrationData.username,
    firstName: registrationData.firstName,
    lastName: registrationData.lastName,
    isVerified: true,
  });
}
