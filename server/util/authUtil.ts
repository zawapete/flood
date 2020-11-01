import {Response} from 'express';
import jwt from 'jsonwebtoken';

import type {AuthorizationHeader} from '@shared/schema/Auth';

import config from '../../config';

export const parseAuthorizationHeader = (header?: string): AuthorizationHeader | null => {
  if (header == null) {
    return null;
  }

  const [type, value] = header.split(' ');

  if (type !== 'Basic') {
    return null;
  }

  try {
    const [username, password] = Buffer.from(value, 'base64').toString().split(':');

    return {
      type,
      username,
      password,
    };
  } catch (e) {
    return null;
  }
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
