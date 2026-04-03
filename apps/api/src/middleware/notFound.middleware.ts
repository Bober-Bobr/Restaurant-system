import type { Request, Response } from 'express';

export const notFoundMiddleware = (_request: Request, response: Response): void => {
  response.status(404).json({ message: 'Route not found' });
};
