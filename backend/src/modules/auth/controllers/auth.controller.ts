import type { Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import type { ValidatedRequest } from "../../../middlewares/zodValidator.middleware.js";
import type { RegisterInput, VerifyOtpInput } from "../zodschemas/auth.zschema.js";
import { registerUserService, verifyOtpService } from "../services/auth.service.js";
import type { SuccessResponse } from "../../../types/response.js";

export const registerUserController = async (
  req: ValidatedRequest<RegisterInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await registerUserService(req.body);

    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.CREATED,
      message: "Registration successful. Please check your email for the OTP to verify your account.",
      data: null,
    };

    res.status(StatusCodes.CREATED).json(response);
  } catch (error) {
    next(error);
  }
};

export const verifyOtpController = async (
  req: ValidatedRequest<VerifyOtpInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await verifyOtpService(req.body);

    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Email verified successfully. Your account is now active.",
      data: null,
    };

    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};
