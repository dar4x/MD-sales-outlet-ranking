/* External deps */
import { Catch } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

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
@Catch()
export class EventErrorsFilter extends BaseExceptionFilter {
  override catch(error: unknown, host: ArgumentsHost): void {
    if (isDatabaseConnectionFailure(error)) {
      host.switchToHttp().getResponse<JsonResponse>().status(503).json({
        code: 'database_unavailable',
        message: 'Database connection is unavailable.',
      });
      return;
    }
    if (
      !(error instanceof EventValidationError) &&
      !(error instanceof EventConflictError) &&
      !(error instanceof ReceiptConflictError)
    ) {
      super.catch(error, host);
      return;
    }
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

// TypeORM wraps driver failures; PostgreSQL class 08 means connection errors.
function isDatabaseConnectionFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  if ('driverError' in error) {
    return isDatabaseConnectionFailure(error.driverError);
  }
  if ('code' in error && typeof error.code === 'string') {
    return (
      /^08[A-Z0-9]{3}$/.test(error.code) ||
      [
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'EPIPE',
        'ENOTFOUND',
        'EAI_AGAIN',
        '57P01',
        '57P02',
        '57P03',
      ].includes(error.code)
    );
  }
  // node-postgres supplies these connection/pool failures without a code.
  return (
    error instanceof Error &&
    [
      'Connection terminated unexpectedly',
      'Connection terminated',
      'Connection terminated due to connection timeout',
      'timeout exceeded when trying to connect',
    ].includes(error.message)
  );
}
