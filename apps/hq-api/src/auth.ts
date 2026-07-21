import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { HqRole } from '@reemteam/shared';
import { env } from './config.js';

export type Operator = {
  id: string;
  email: string;
  name: string;
  role: HqRole;
};

const timingEqual = (left: string, right: string) => {
  const a = Buffer.from(left.normalize('NFKC'));
  const b = Buffer.from(right.normalize('NFKC'));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const authenticateOperator = (email: string, password: string): Operator | null => {
  if (!timingEqual(email.trim().toLowerCase(), env.operatorEmail.toLowerCase())) return null;
  if (!timingEqual(password, env.operatorPassword)) return null;
  return {
    id: env.operatorEmail,
    email: env.operatorEmail,
    name: env.operatorName,
    role: 'owner'
  };
};

export const attachSession = (response: Response, operator: Operator) => {
  const token = jwt.sign(operator, env.jwtSecret, { expiresIn: `${env.sessionHours}h` });
  response.cookie(env.authCookieName, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: env.sessionHours * 60 * 60 * 1000,
    path: '/'
  });
};

export const clearSession = (response: Response) => {
  response.clearCookie(env.authCookieName, { path: '/' });
};

const readOperator = (request: Request): Operator | null => {
  const token = request.cookies?.[env.authCookieName];
  if (!token || typeof token !== 'string') return null;
  try {
    return jwt.verify(token, env.jwtSecret) as Operator;
  } catch {
    return null;
  }
};

const hasInternalAccess = (request: Request) => {
  const token = request.header('x-hq-internal-token') ?? request.header('x-rge-internal-token') ?? '';
  return Boolean(env.internalToken && token === env.internalToken);
};

export const requireAuth = (request: Request, response: Response, next: NextFunction) => {
  const operator = readOperator(request);
  if (operator) {
    request.operator = operator;
    next();
    return;
  }
  if (hasInternalAccess(request)) {
    request.operator = { id: 'internal', email: 'internal@reemteam.local', name: 'Internal HQ', role: 'owner' };
    next();
    return;
  }
  response.status(401).json({ message: 'Authentication required' });
};

export const requireRoles = (roles: HqRole[]) => (request: Request, response: Response, next: NextFunction) => {
  if (!request.operator || !roles.includes(request.operator.role)) {
    response.status(403).json({ message: 'You do not have permission for this action' });
    return;
  }
  next();
};

declare global {
  namespace Express {
    interface Request {
      operator?: Operator;
    }
  }
}
