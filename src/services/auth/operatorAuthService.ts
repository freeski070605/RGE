import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { env } from '../../config/env';

type OperatorTokenPayload = {
  sub: string;
  name: string;
};

export type OperatorProfile = {
  email: string;
  name: string;
};

const toComparableBuffer = (value: string) => Buffer.from(value.normalize('NFKC'));

const safeEqual = (left: string, right: string) => {
  const leftBuffer = toComparableBuffer(left);
  const rightBuffer = toComparableBuffer(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const authenticateOperator = (email: string, password: string): OperatorProfile | null => {
  const normalizedEmail = email.trim().toLowerCase();
  const expectedEmail = env.OPERATOR_EMAIL.trim().toLowerCase();

  if (!safeEqual(normalizedEmail, expectedEmail) || !safeEqual(password, env.OPERATOR_PASSWORD)) {
    return null;
  }

  return {
    email: env.OPERATOR_EMAIL,
    name: env.OPERATOR_NAME
  };
};

export const signOperatorToken = (operator: OperatorProfile) =>
  jwt.sign(
    {
      sub: operator.email,
      name: operator.name
    },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: `${env.AUTH_SESSION_TTL_HOURS}h`
    }
  );

export const verifyOperatorToken = (token: string): OperatorProfile | null => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as OperatorTokenPayload;
    return {
      email: payload.sub,
      name: payload.name
    };
  } catch {
    return null;
  }
};

const getCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: env.AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000
});

export const attachOperatorSession = (response: Response, operator: OperatorProfile) => {
  response.cookie(env.AUTH_COOKIE_NAME, signOperatorToken(operator), getCookieOptions());
};

export const clearOperatorSession = (response: Response) => {
  response.clearCookie(env.AUTH_COOKIE_NAME, {
    ...getCookieOptions(),
    maxAge: undefined
  });
};
