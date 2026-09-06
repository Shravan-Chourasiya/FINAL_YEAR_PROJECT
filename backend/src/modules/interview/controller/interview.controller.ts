import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../../types/request.js";
import type { SuccessResponse } from "../../../types/response.js";
import { StatusCodes } from "http-status-codes";
import {
  createInterviewService,
  getAllInterviewsService,
  getInterviewByIdService,
  getInterviewMetricsService,
  getInterviewHistoryService,
  getResumableInterviewsService,
  startInterviewService,
  pauseInterviewService,
  resumeInterviewService,
  cancelInterviewService,
  endInterviewService,
  submitAnswerService,
} from "../services/interview.service.js";

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

export const startInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await startInterviewService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview started successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const pauseInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await pauseInterviewService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview paused successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const resumeInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await resumeInterviewService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview resumed successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const cancelInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await cancelInterviewService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview cancelled successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const endInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await endInterviewService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview ended successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getResumableInterviewsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await getResumableInterviewsService(authreq);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Resumable interviews retrieved successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getInterviewHistoryController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await getInterviewHistoryService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview history retrieved successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const submitAnswerController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await submitAnswerService(authreq, String(req.params.id), req.body);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Answer submitted successfully.",
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
