import {Strategy, VerifiedCallback} from 'passport-jwt';

import type {PassportStatic} from 'passport';
import type {Request} from 'express';

import config from '../../config';
import {Credentials} from '../../shared/schema/Auth';
import {parseAuthorizationHeader} from '../util/authUtil';
import Users from '../models/Users';

// Setup work and export for the JWT passport strategy.
export default (passport: PassportStatic) => {
  const options = {
    jwtFromRequest: (req: Request) => {
      let token = null;

      if (req && req.cookies) {
        token = req.cookies.jwt;
      }

      return token;
    },
    passReqToCallback: true,
    secretOrKey: config.secret,
  };

  passport.use(
    new Strategy(options, (req: Request, jwtPayload: Pick<Credentials, 'username'>, callback: VerifiedCallback) => {
      Users.lookupUser(jwtPayload.username, (err, user) => {
        if (err) {
          return callback(err, false);
        }

        if (user) {
          if (config.authMethod === 'header') {
            const {username} = parseAuthorizationHeader(req.headers.authorization) || {};

            if (username !== user.username) {
              return callback(null, false);
            }
          }

          return callback(null, user);
        }

        return callback(null, false);
      });
    }),
  );
};
