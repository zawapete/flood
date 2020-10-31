import {Strategy} from 'passport-jwt';

import type {PassportStatic} from 'passport';
import type {Request} from 'express';

import config from '../../config';
import Users from '../models/Users';
import {authAuthenticationSchema, authHTTPBasicAuthenticationSchema} from '../../shared/schema/api/auth';
import {Credentials} from '../../shared/schema/Auth';
import getAuthToken from '../util/authUtil';

// Setup work and export for the JWT passport strategy.
export default (passport: PassportStatic) => {
  const options = {
    jwtFromRequest: (req: Request) => {
      let token = null;
      let parsedResult = authAuthenticationSchema.safeParse(null);
      let credentials: Required<Pick<Credentials, 'username' | 'password'>>;
      switch (config.authMethod) {
        case 'httpbasic':
          parsedResult = authHTTPBasicAuthenticationSchema(req.header('authorization'));
          if (!parsedResult.success) {
            return token;
          }

          credentials = parsedResult.data;
          token = getAuthToken(credentials.username);
          break;
        case 'default':
        default:
          if (req && req.cookies) {
            token = req.cookies.jwt;
          }
      }

      return token;
    },
    secretOrKey: config.secret,
  };

  passport.use(
    new Strategy(options, (jwtPayload, callback) => {
      Users.lookupUser(jwtPayload.username, (err, user) => {
        if (err) {
          return callback(err, false);
        }

        if (user) {
          return callback(null, user);
        }

        return callback(null, false);
      });
    }),
  );
};
