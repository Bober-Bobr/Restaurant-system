import createHttpError from 'http-errors';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export const errorMiddleware = (error: unknown, _request: Request, response: Response, _next: NextFunction): void => {
  if (error instanceof ZodError) {
    // Surface the first issue as the top-level message and return the issues as
    // an array so clients can show a specific reason (e.g. password policy).
    const errors = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
    response.status(400).json({
      message: errors[0]?.message ?? 'Validation failed',
      errors
    });
    return;
  }

  if (createHttpError.isHttpError(error)) {
    response.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof Error) {
    response.status(500).json({ message: error.message });
    return;
  }

  response.status(500).json({ message: 'Unexpected server error' });
};
