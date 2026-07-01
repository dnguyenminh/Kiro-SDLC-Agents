export declare function apiSuccess<T>(data: T): {
    success: boolean;
    data: T;
    meta: {
        requestId: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
    };
};
export declare function apiError(code: string, message: string, status?: number): {
    status: number;
    body: {
        success: boolean;
        error: {
            code: string;
            message: string;
        };
        meta: {
            requestId: `${string}-${string}-${string}-${string}-${string}`;
            timestamp: string;
        };
    };
};
export declare function parsePagination(query: any): {
    page: number;
    size: number;
};
