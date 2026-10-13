// Business input that breaks a sale rule; presentation maps it to HTTP 422.
export class EventValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'EventValidationError';
  }
}
