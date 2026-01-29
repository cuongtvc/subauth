import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function createErrorMiddleware() {
  function errorHandler(
    err: AppError,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void {
    const statusCode = err.statusCode || 500;
    const message = err.isOperational ? err.message : 'Internal server error';

    console.error(`[Error] ${err.message}`, err.stack);

    res.status(statusCode).json({
      success: false,
      error: message,
    });
  }

  function createError(message: string, statusCode: number): AppError {
    const error = new Error(message) as AppError;
    error.statusCode = statusCode;
    error.isOperational = true;
    return error;
  }

  return {
    errorHandler,
    createError,
  };
}

export type ErrorMiddleware = ReturnType<typeof createErrorMiddleware>;