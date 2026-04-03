import type { Request } from 'express';

export const getPagination = (request: Request): { skip: number; take: number } => {
  const page = Math.max(Number(request.query.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(request.query.pageSize ?? 20), 1), 100);

  return {
    skip: (page - 1) * pageSize,
    take: pageSize
  };
};
