// Equivalente ao GlobalExceptionHandler + ErrorResponse, e utilitários para os route handlers.
import type { NextRequest } from 'next/server';
import type { ErrorBody } from './dto';
import { BusinessError, DuplicatePaymentError, ResourceNotFoundError, ValidationError } from './errors';
import { log } from './logger';

const REASON: Record<number, string> = {
  400: 'Bad Request',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

function body(status: number, message: string, details?: Record<string, string>): { status: number; body: ErrorBody } {
  const payload: ErrorBody = { timestamp: new Date().toISOString(), status, error: REASON[status] ?? 'Error', message };
  if (details) payload.details = details;
  return { status, body: payload };
}

export function mapError(error: unknown): { status: number; body: ErrorBody } {
  if (error instanceof ResourceNotFoundError) {
    log.warn(`Resource not found: ${error.message}`);
    return body(404, error.message);
  }
  if (error instanceof ValidationError) {
    return body(400, error.message, error.details);
  }
  if (error instanceof BusinessError) {
    log.warn(`Business error: ${error.message}`);
    return body(400, error.message);
  }
  if (error instanceof DuplicatePaymentError) {
    log.warn(`Duplicate payment: ${error.message}`);
    return body(409, error.message);
  }
  log.error('Unexpected error', error);
  return body(500, 'An unexpected error occurred');
}

export function errorResponse(error: unknown): Response {
  const { status, body: payload } = mapError(error);
  return Response.json(payload, { status });
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.trim() === '') throw new ValidationError({ body: 'Request body is required' });
  try {
    return JSON.parse(text);
  } catch {
    throw new BusinessError('Malformed JSON request body');
  }
}

/** Envolve um handler sem parâmetros de rota, convertendo exceções em respostas de erro padronizadas. */
export function api(handler: (req: NextRequest) => Promise<Response>): (req: NextRequest) => Promise<Response> {
  return async (req) => {
    try {
      return await handler(req);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Idem, para rotas dinâmicas (Next 15: `params` é uma Promise). */
export function apiWithParams<P>(
  handler: (req: NextRequest, params: P) => Promise<Response>,
): (req: NextRequest, context: { params: Promise<P> }) => Promise<Response> {
  return async (req, context) => {
    try {
      return await handler(req, await context.params);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
