export const getPagination = (request) => {
    const page = Math.max(Number(request.query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(request.query.pageSize ?? 20), 1), 100);
    return {
        skip: (page - 1) * pageSize,
        take: pageSize
    };
};
