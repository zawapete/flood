import type {infer as zodInfer} from 'zod';

import {AccessLevel} from '../constants/Auth';
import {credentialsSchema} from '../Auth';

import type {AuthMethod} from '../Auth';

export const httpBasicAuth = (authorization: string) => {
  const base64 = authorization.replace(/basic /i, '');
  const credentials = Buffer.from(base64, 'base64').toString().split(':');
  if (credentials.length !== 2 || credentials[0].length === 0 || credentials[1].length === 0) {
    return null;
  }

  return credentials;
};

// All auth requests are schema validated to ensure security.

// POST /api/auth/authenticate
export const authAuthenticationSchema = credentialsSchema.pick({username: true, password: true});
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
export type AuthAuthenticationOptions = Required<zodInfer<typeof authAuthenticationSchema>>;

// POST /api/auth/authenticate - success response
export interface AuthAuthenticationResponse {
  success: boolean;
  username: string;
  level: AccessLevel;
}

// POST /api/auth/register
export const authRegistrationSchema = credentialsSchema;
export type AuthRegistrationOptions = Required<zodInfer<typeof authRegistrationSchema>>;

// PATCH /api/auth/users/{username}
export const authUpdateUserSchema = credentialsSchema.partial();
export type AuthUpdateUserOptions = zodInfer<typeof authUpdateUserSchema>;

// GET /api/auth/verify - preload configurations
export interface AuthVerificationPreloadConfigs {
  authMethod: AuthMethod;
  pollInterval: number;
}

// GET /api/auth/verify - success response
export type AuthVerificationResponse = (
  | {
      initialUser: true;
    }
  | {
      initialUser: false;
      username: string;
      level: AccessLevel;
    }
) & {
  configs: AuthVerificationPreloadConfigs;
};
