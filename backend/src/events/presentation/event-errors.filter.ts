/* External deps */
import { Catch } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

/* Internal deps */
import {
  EventConflictError,
  EventValidationError,
  ReceiptConflictError,
} from '../domain/event-errors.js';

// Only the two Express response methods used here; @types/express is not
// installed and adding a dependency for two methods is not worth it.
interface JsonResponse {
  status(code: number): JsonResponse;
  json(body: unknown): void;
}

interface ErrorBody {
  code: string;
  message: string;
  details?: string[];
}

// Turns typed event errors into the contract body { code, message, details? }:
// conflicts are 409, every validation failure is 422.
@Catch(EventValidationError, EventConflictError, ReceiptConflictError)
export class EventErrorsFilter implements ExceptionFilter {
  catch(
    error: EventValidationError | EventConflictError | ReceiptConflictError,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<JsonResponse>();
    const body: ErrorBody = { code: error.code, message: error.message };

    if (error instanceof EventValidationError) {
      if (error.details !== undefined) {
        body.details = error.details;
      }
      response.status(422).json(body);
      return;
    }
    response.status(409).json(body);
  }
}
