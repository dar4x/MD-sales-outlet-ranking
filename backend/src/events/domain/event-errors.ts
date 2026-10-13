// Business input that breaks a sale rule; presentation maps it to HTTP 422.
// details lists field problems when a request body fails shape validation.
export class EventValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = 'EventValidationError';
  }
}

// Same event_id was already accepted with different business content;
// presentation maps it to HTTP 409.
export class EventConflictError extends Error {
  readonly code = 'event_conflict';

  constructor(eventId: string) {
    super(`Event ${eventId} was already accepted with a different payload.`);
    this.name = 'EventConflictError';
  }
}

// The receipt_id already belongs to another accepted event; presentation maps
// it to HTTP 409.
export class ReceiptConflictError extends Error {
  readonly code = 'receipt_conflict';

  constructor(receiptId: string) {
    super(`Receipt ${receiptId} was already accepted with another event.`);
    this.name = 'ReceiptConflictError';
  }
}
