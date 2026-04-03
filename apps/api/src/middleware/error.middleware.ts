import createHttpError from 'http-errors';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export const errorMiddleware = (error: unknown, _request: Request, response: Response, _next: NextFunction): void => {
  if (error instanceof ZodError) {
    response.status(400).json({
      message: 'Validation failed',
      errors: error.flatten()
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
