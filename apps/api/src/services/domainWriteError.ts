/** Rejected domain write mapped to an HTTP status (REST) or sync rejection code. */
export class DomainWriteError extends Error {
  readonly status: 403 | 422;
  readonly code: 'FORBIDDEN' | 'VALIDATION_FAILED';

  constructor(
    status: 403 | 422,
    code: 'FORBIDDEN' | 'VALIDATION_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'DomainWriteError';
    this.status = status;
    this.code = code;
  }
}
