import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../../types/request.js";
import type { SuccessResponse } from "../../../types/response.js";
import { StatusCodes } from "http-status-codes";
import { createInterviewService, getAllInterviewsService, getInterviewByIdService, getInterviewMetricsService } from "../services/interview.service.js";

export const createInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await createInterviewService(authreq, req.body);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview created successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getAllInterviewsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await getAllInterviewsService(authreq);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "All interviews retrieved successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getInterviewByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const interviewId = req.params.id;
    const data = await getInterviewByIdService(authreq, String(interviewId));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview retrieved successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getInterviewMetricsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const interviewId = req.params.id;
    const data = await getInterviewMetricsService(authreq, String(interviewId));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview metrics retrieved successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};
