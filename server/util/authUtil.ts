import {Response} from 'express';
import jwt from 'jsonwebtoken';
import config from '../../config';
import {authAuthenticationSchema} from '../../shared/schema/api/auth';

export const httpBasicAuth = (authorization: string) => {
  const base64 = authorization.replace(/basic /i, '');
  const credentials = Buffer.from(base64, 'base64').toString().split(':');
  if (credentials.length !== 2 || credentials[0].length === 0 || credentials[1].length === 0) {
    return null;
  }

  return credentials;
};

export const getAuthToken = (username: string, res?: Response): string => {
  const expirationSeconds = 60 * 60 * 24 * 7; // one week
  const cookieExpiration = Date.now() + expirationSeconds * 1000;

  // Create token if the password matched and no error was thrown.
  const token = jwt.sign({username}, config.secret, {
    expiresIn: expirationSeconds,
  });

  if (res != null) {
    res.cookie('jwt', token, {expires: new Date(cookieExpiration), httpOnly: true, sameSite: 'strict'});
  }

  return token;
};

export const authHTTPBasicAuthenticationSchema = (authorization?: string) => {
  if (authorization === undefined) {
    return authAuthenticationSchema.safeParse({});
  }

  const credentials = httpBasicAuth(authorization);
  if (credentials === null) {
    return authAuthenticationSchema.safeParse({});
  }

  return authAuthenticationSchema.safeParse({username: credentials[0], password: credentials[1]});
};
