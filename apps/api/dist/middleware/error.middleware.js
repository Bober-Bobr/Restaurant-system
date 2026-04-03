import createHttpError from 'http-errors';
import { ZodError } from 'zod';
export const errorMiddleware = (error, _request, response, _next) => {
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
