export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INVALID_FILE"
  | "PROCESSING_ERROR"
  | "AI_GENERATION_ERROR"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong. Please try again.",
    },
  };
}
