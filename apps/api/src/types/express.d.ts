declare global {
  namespace Express {
    interface Request {
      admin?: { id: string; username: string };
    }
  }
}

export {};
