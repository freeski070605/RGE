import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { verifyOperatorToken } from '../services/auth/operatorAuthService';

const readOperatorFromCookie = (request: Request) => {
  const token = request.cookies?.[env.AUTH_COOKIE_NAME];
  if (!token || typeof token !== 'string') {
    return null;
  }

  return verifyOperatorToken(token);
};

const readInternalToken = (request: Request) => {
  const headerValue = request.header('x-rge-internal-token') || request.header('x-rge-token');
  if (headerValue) {
    return headerValue;
  }

  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return '';
  }

  return authorization.slice('Bearer '.length).trim();
};

const isValidInternalToken = (request: Request) => {
  if (!env.RGE_INTERNAL_TOKEN) {
    return false;
  }

  const providedToken = readInternalToken(request);
  return Boolean(providedToken) && providedToken === env.RGE_INTERNAL_TOKEN;
};

export const requireAuthenticatedAccess = (request: Request, _response: Response, next: NextFunction) => {
  const operator = readOperatorFromCookie(request);
  if (operator) {
    request.operator = operator;
    return next();
  }

  if (isValidInternalToken(request)) {
    request.isInternalRequest = true;
    return next();
  }

  next(new AppError('Authentication required', 401));
};

export const requireOperatorAccess = (request: Request, _response: Response, next: NextFunction) => {
  const operator = readOperatorFromCookie(request);
  if (!operator) {
    next(new AppError('Operator authentication required', 401));
    return;
  }

  request.operator = operator;
  next();
};

export const hasOperatorAccess = (request: Request) => Boolean(readOperatorFromCookie(request));
