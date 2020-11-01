import express from 'express';
import passport from 'passport';
import rateLimit from 'express-rate-limit';

import type {Response} from 'express';

import {infer as zodInfer, ZodError} from 'zod';

import ajaxUtil from '../../util/ajaxUtil';
import {getAuthToken, authHTTPBasicAuthenticationSchema} from '../../util/authUtil';

import {
  authAuthenticationSchema,
  authRegistrationSchema,
  authUpdateUserSchema,
  AuthVerificationPreloadConfigs,
} from '../../../shared/schema/api/auth';
import config from '../../../config';
import requireAdmin from '../../middleware/requireAdmin';
import services from '../../services';
import Users from '../../models/Users';

import type {
  AuthAuthenticationOptions,
  AuthAuthenticationResponse,
  AuthRegistrationOptions,
  AuthUpdateUserOptions,
  AuthVerificationResponse,
} from '../../../shared/schema/api/auth';
import type {Credentials, UserInDatabase} from '../../../shared/schema/Auth';

const router = express.Router();

const failedLoginResponse = 'Failed login.';

// Limit each IP to 200 request every 5 minutes
// to prevent brute forcing password or denial-of-service
router.use(
  '/',
  rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 200,
  }),
);

const sendAuthenticationResponse = (
  res: Response,
  credentials: Required<Pick<Credentials, 'username' | 'level'>>,
): void => {
  const {username, level} = credentials;

  getAuthToken(username, res);

  const response: AuthAuthenticationResponse = {
    success: true,
    username,
    level,
  };

  res.json(response);
};

const validationError = (res: Response, err: Error) => {
  res.status(422).json({
    message: 'Validation error.',
    error: err,
  });
};

const preloadConfigs: AuthVerificationPreloadConfigs = {
  authMethod: config.authMethod,
  pollInterval: config.torrentClientPollInterval,
  predefinedUsername: undefined,
};

router.use('/users', passport.authenticate('jwt', {session: false}), requireAdmin);

/**
 * POST /api/auth/authenticate
 * @summary Authenticates a user
 * @tags Auth
 * @security None
 * @param {AuthAuthenticationOptions} request.body.required - options - application/json
 * @return {object} 422 - request validation error - application/json
 * @return {object} 401 - incorrect username or password - application/json
 * @return {AuthAuthenticationResponse} 200 - success response - application/json
 */
router.post<unknown, unknown, AuthAuthenticationOptions>('/authenticate', (req, res) => {
  if (config.authMethod === 'none') {
    sendAuthenticationResponse(res, Users.getConfigUser());
    return;
  }

  let parsedResult:
    | {
        success: true;
        data: Required<zodInfer<typeof authAuthenticationSchema>>;
      }
    | {
        success: false;
        error: ZodError;
      };

  switch (preloadConfigs.authMethod) {
    case 'httpbasic':
      parsedResult = authHTTPBasicAuthenticationSchema(req.header('authorization'));
      break;
    case 'default':
    default:
      parsedResult = authAuthenticationSchema.safeParse(req.body);
  }

  if (!parsedResult.success) {
    validationError(res, parsedResult.error);
    return;
  }

  const credentials = parsedResult.data;

  Users.comparePassword(credentials, (isMatch, level, _err) => {
    if (isMatch === true && level != null) {
      sendAuthenticationResponse(res, {
        ...credentials,
        level,
      });
      return;
    }

    // Incorrect username or password.
    res.status(401).json({
      message: failedLoginResponse,
    });
  });
});

// Allow unauthenticated registration if no users are currently registered.
router.use('/register', (req, res, next) => {
  Users.initialUserGate({
    handleInitialUser: () => {
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
          if (parsedResult.success) {
            req.body.username = parsedResult.data.username;
            req.body.password = parsedResult.data.password;
          } else {
            res.status(422).send();
            return;
          }

          break;
        case 'default':
        default:
      }


      next();
    },
    handleSubsequentUser: () => {
      passport.authenticate('jwt', {session: false}, (err, user: UserInDatabase) => {
        if (err || !user) {
          res.status(401).send('Unauthorized');
          return;
        }
        req.user = user;
        // Only admin users can create users
        requireAdmin(req, res, next);
      })(req, res, next);
    },
  });
});

/**
 * POST /api/auth/register
 * @summary Registers a user
 * @tags Auth
 * @security None - initial request
 * @security Administrator - subsequent requests
 * @param {AuthRegistrationOptions} request.body.required - options - application/json
 * @param {'true' | 'false'} cookie.query - whether to Set-Cookie if succeeded
 * @return {string} 404 - registration is disabled
 * @return {string} 403 - user is not authorized to create user
 * @return {object} 422 - request validation error - application/json
 * @return {{username: string}} 200 - success response if cookie=false - application/json
 * @return {AuthAuthenticationResponse} 200 - success response - application/json
 */
router.post<unknown, unknown, AuthRegistrationOptions, {cookie: string}>('/register', (req, res) => {
  // No user can be registered when authMethod is none
  if (config.authMethod === 'none') {
    // Return 404
    res.status(404).send('Not found');
    return;
  }

  const parsedResult = authRegistrationSchema.safeParse(req.body);

  if (!parsedResult.success) {
    validationError(res, parsedResult.error);
    return;
  }

  const credentials = parsedResult.data;

  // Attempt to save the user
  Users.createUser(credentials, (user, error) => {
    if (error || user == null) {
      ajaxUtil.getResponseFn(res)({username: credentials.username}, error);
      return;
    }

    services.bootstrapServicesForUser(user);

    if (req.query.cookie === 'false') {
      ajaxUtil.getResponseFn(res)({username: user.username});
      return;
    }

    sendAuthenticationResponse(res, credentials);
  });
});

// Allow unauthenticated verification if no users are currently registered.
router.use('/verify', (req, res, next) => {
  // Unconditionally provide a token if auth is disabled
  if (config.authMethod === 'none') {
    const {username, level} = Users.getConfigUser();

    getAuthToken(username, res);

    const response: AuthVerificationResponse = {
      initialUser: false,
      username,
      level,
      configs: preloadConfigs,
    };

    res.json(response);
    return;
  }

  Users.initialUserGate({
    handleInitialUser: () => {
      let parsedResult:
        | {
            success: true;
            data: Required<zodInfer<typeof authAuthenticationSchema>>;
          }
        | {
            success: false;
            error: ZodError;
          };

      let predefinedUsername = '';
      switch (config.authMethod) {
        case 'httpbasic':
          parsedResult = authHTTPBasicAuthenticationSchema(req.header('authorization'));
          if (!parsedResult.success) {
            res.status(401).json({
              configs: preloadConfigs,
            });
            return;
          }

          predefinedUsername = parsedResult.data.username;
          break;
        case 'default':
        default:
      }

      const response: AuthVerificationResponse = {
        initialUser: true,
        configs: preloadConfigs,
        predefinedUsername,
      };

      res.json(response);
    },
    handleSubsequentUser: () => {
      passport.authenticate('jwt', {session: false}, (err, user: UserInDatabase) => {
        if (err || !user) {
          res.status(401).json({
            configs: preloadConfigs,
          });
          return;
        }

        req.user = user;
        next();
      })(req, res, next);
    },
  });
});

/**
 * GET /api/auth/verify
 * @summary Verifies the connectivity and validity of session
 * @tags Auth
 * @security User
 * @return {string} 401 - not authenticated or token expired
 * @return {string} 500 - authenticated succeeded but user is unattached (this should NOT happen)
 * @return {AuthVerificationResponse} 200 - success response - application/json
 */
router.get('/verify', (req, res) => {
  if (req.user == null) {
    res.status(500).send('Unattached user.');
    return;
  }

  const response: AuthVerificationResponse = {
    initialUser: false,
    username: req.user.username,
    level: req.user.level,
    configs: preloadConfigs,
  };

  res.json(response);
});

// All subsequent routes are protected.
router.use('/', passport.authenticate('jwt', {session: false}));

/**
 * GET /api/auth/logout
 * @summary Clears the session cookie
 * @tags Auth
 * @security User
 * @return {string} 401 - not authenticated or token expired or auth is httpbasic
 * @return {} 200 - success response
 */
router.get('/logout', (_req, res) => {
  res.clearCookie('jwt').status(401).json('Unauthorized').send();
});

// All subsequent routes need administrator access.
router.use('/', requireAdmin);

router.use('/users', (_req, res, next) => {
  // No operation on user when authMethod is none
  if (config.authMethod === 'none') {
    // Return 404
    res.status(404).send('Not found');
  }

  next();
});

/**
 * GET /api/auth/users
 * @summary Lists all users
 * @tags Auth
 * @security Administrator
 * @return {string} 401 - not authenticated or token expired
 * @return {string} 403 - user is not authorized to list users
 * @return {Array<UserInDatabase>} 200 - success response - application/json
 */
router.get('/users', (_req, res) => {
  Users.listUsers(ajaxUtil.getResponseFn(res));
});

/**
 * DELETE /api/auth/users/{username}
 * @summary Deletes a user
 * @tags Auth
 * @security Administrator
 * @param {string} username.path - username of the user to be deleted
 * @return {string} 401 - not authenticated or token expired
 * @return {string} 403 - user is not authorized to delete user
 * @return {{username: string}} 200 - success response - application/json
 */
router.delete('/users/:username', (req, res) => {
  const callback = ajaxUtil.getResponseFn(res);
  Users.removeUser(req.params.username, (id, err) => {
    if (err || id == null) {
      callback(null, err || new Error());
      return;
    }

    services.destroyUserServices(id);

    callback({username: req.params.username});
  });
});

/**
 * PATCH /api/auth/users/{username}
 * @summary Updates a user
 * @tags Auth
 * @security Administrator
 * @param {string} username.path - username of the user to be updated
 * @param {AuthUpdateUserOptions} request.body.required - options - application/json
 * @return {string} 401 - not authenticated or token expired
 * @return {string} 403 - user is not authorized to update user
 * @return {object} 422 - request validation error - application/json
 * @return {} 200 - success response
 */
router.patch<{username: Credentials['username']}, unknown, AuthUpdateUserOptions>('/users/:username', (req, res) => {
  const {username} = req.params;

  const parsedResult = authUpdateUserSchema.safeParse(req.body);

  if (!parsedResult.success) {
    validationError(res, parsedResult.error);
    return;
  }

  const patch = parsedResult.data;

  Users.updateUser(username, patch, (newUsername, err) => {
    if (err || newUsername == null) {
      res.status(500).json({error: err});
      return;
    }

    Users.lookupUser(newUsername, (errLookup, user) => {
      if (errLookup) {
        res.status(500).json({error: errLookup});
        return;
      }

      if (user != null) {
        services.destroyUserServices(user._id);
        services.bootstrapServicesForUser(user);
      }

      res.send();
    });
  });
});

export default router;
