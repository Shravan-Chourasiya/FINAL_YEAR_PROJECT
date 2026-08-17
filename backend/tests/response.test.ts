import { describe, it, expect } from "vitest";
import { StatusCodes } from "http-status-codes";

import { SuccessResponse, ErrorResponse, ApiResponse } from "../src/types/response.js";
import { AppError } from "../src/utils/AppError.js";
import { ErrorCodes } from "../src/constants/errorCodes.js";


describe("Standard response envelope", () => {
  it("success response matches the standard contract", () => {
    const response: SuccessResponse<{ id: string; name: string }> = {
      status: "success",
      statusCode: StatusCodes.OK,
      message: "User retrieved successfully",
      data: { id: "abc-123", name: "Alice" },
    };

    expect(response.status).toBe("success");
    expect(response.statusCode).toBe(200);
    expect(response.message).toBe("User retrieved successfully");
    expect(response.data.id).toBe("abc-123");
    expect(response.data.name).toBe("Alice");
  });

  it("error response matches the standard contract", () => {
    const response: ErrorResponse = {
      status: "error",
      statusCode: StatusCodes.UNAUTHORIZED,
      message: "Invalid credentials",
      error: {
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      },
    };

    expect(response.status).toBe("error");
    expect(response.statusCode).toBe(401);
    expect(response.message).toBe("Invalid credentials");
    expect(response.error.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("error response may include details", () => {
    const response: ErrorResponse = {
      status: "error",
      statusCode: StatusCodes.BAD_REQUEST,
      message: "Validation failed",
      error: {
        code: ErrorCodes.VALIDATION_FAILED,
        details: {
          fields: {
            email: "Invalid email address",
          },
        },
      },
    };

    expect(response.error.details).toEqual({
      fields: {
        email: "Invalid email address",
      },
    });
  });

  it("ApiResponse type can represent both success and error", () => {
    const success: ApiResponse<{ id: string }> = {
      status: "success",
      statusCode: 200,
      message: "OK",
      data: { id: "abc" },
    };

    const error: ApiResponse = {
      status: "error",
      statusCode: 500,
      message: "Something went wrong",
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
      },
    };

    expect(success.status).toBe("success");
    expect(error.status).toBe("error");
  });
});


describe("AppError", () => {
  it("creates an error with HTTP status code", () => {
    const error = new AppError(
      "Invalid credentials",
      StatusCodes.UNAUTHORIZED,
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
    );

    expect(error.statusCode).toBe(401);
  });

  it("creates an error with stable error code", () => {
    const error = new AppError(
      "Invalid credentials",
      StatusCodes.UNAUTHORIZED,
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
    );

    expect(error.errorCode).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("creates an error with safe client-facing message", () => {
    const error = new AppError(
      "The password you entered is incorrect",
      StatusCodes.UNAUTHORIZED,
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
    );

    expect(error.message).toBe("The password you entered is incorrect");
  });

  it("preserves stack trace", () => {
    const error = new AppError(
      "Something failed",
      StatusCodes.INTERNAL_SERVER_ERROR,
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("AppError");
  });

  it("is an instance of Error and AppError", () => {
    const error = new AppError(
      "Not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.RESOURCE_NOT_FOUND,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it("defaults isOperational to true for 4xx errors", () => {
    const error = new AppError(
      "Not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.RESOURCE_NOT_FOUND,
    );

    expect(error.isOperational).toBe(true);
  });

  it("defaults isOperational to false for 5xx errors", () => {
    const error = new AppError(
      "Internal error",
      StatusCodes.INTERNAL_SERVER_ERROR,
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );

    expect(error.isOperational).toBe(false);
  });

  it("can include structured details", () => {
    const error = new AppError(
      "Validation failed",
      StatusCodes.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED,
      {
        details: {
          fields: { email: "Invalid email" },
        },
      },
    );

    expect(error.details).toEqual({
      fields: { email: "Invalid email" },
    });
  });

  it("has error name set to 'AppError'", () => {
    const error = new AppError(
      "test",
      StatusCodes.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED,
    );

    expect(error.name).toBe("AppError");
  });
});


describe("Error codes", () => {
  it("all error codes are strings", () => {
    for (const code of Object.values(ErrorCodes)) {
      expect(typeof code).toBe("string");
    }
  });

  it("error code values are UPPER_SNAKE_CASE", () => {
    for (const code of Object.values(ErrorCodes)) {
      expect(code).toMatch(/^[A-Z][A-Z0-9_]+$/);
    }
  });

  it("includes all expected error code categories", () => {
    expect(ErrorCodes.INTERNAL_SERVER_ERROR).toBeDefined();
    expect(ErrorCodes.AUTH_INVALID_CREDENTIALS).toBeDefined();
    expect(ErrorCodes.AUTH_UNAUTHORIZED).toBeDefined();
    expect(ErrorCodes.AUTH_FORBIDDEN).toBeDefined();
    expect(ErrorCodes.VALIDATION_FAILED).toBeDefined();
    expect(ErrorCodes.RESOURCE_NOT_FOUND).toBeDefined();
    expect(ErrorCodes.ROUTE_NOT_FOUND).toBeDefined();
    expect(ErrorCodes.INTERVIEW_NOT_FOUND).toBeDefined();
    expect(ErrorCodes.INTERVIEW_INVALID_STATE).toBeDefined();
  });
});
