import {Response} from 'express';
import jwt from 'jsonwebtoken';
import config from '../../config';

const getAuthToken = (username: string, res?: Response): string => {
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

export default getAuthToken;
