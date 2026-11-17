/** The one response shape, for success and error alike (Backend Guide §5). */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor?: string | null;
}

export interface FieldError {
  field: string;
  message: string;
}

export class ApiResponse<T = null> {
  constructor(
    public readonly success: boolean,
    public readonly message: string,
    public readonly statusCode: number,
    public readonly data: T | null = null,
    public readonly errors: unknown[] = [],
    public readonly meta?: PaginationMeta,
  ) {}

  static ok<T>(message: string, data: T, meta?: PaginationMeta) {
    return new ApiResponse<T>(true, message, 200, data, [], meta);
  }

  static created<T>(message: string, data: T) {
    return new ApiResponse<T>(true, message, 201, data);
  }

  static error(message: string, statusCode = 400, errors: unknown[] = []) {
    return new ApiResponse<null>(false, message, statusCode, null, errors);
  }
}
