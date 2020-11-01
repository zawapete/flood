import {Strategy, VerifiedCallback} from 'passport-jwt';

import type {PassportStatic} from 'passport';
import type {Request} from 'express';
import {infer as zodInfer, ZodError} from 'zod';

import config from '../../config';
import Users from '../models/Users';
import {Credentials} from '../../shared/schema/Auth';
import {authAuthenticationSchema} from '../../shared/schema/api/auth';
import {authHTTPBasicAuthenticationSchema} from '../util/authUtil';

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
      let parsedResult:
        | {
            success: true;
            data: Required<zodInfer<typeof authAuthenticationSchema>>;
          }
        | {
            success: false;
            error: ZodError;
          };

      switch (config.authMethod) {
        case 'httpbasic':
          parsedResult = authHTTPBasicAuthenticationSchema(req.header('authorization'));
          if (!parsedResult.success) {
            callback(null, false);
            return;
          }

          if (jwtPayload.username !== parsedResult.data.username) {
            callback(null, false);
            return;
          }
          break;
        case 'default':
        default:
      }

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
