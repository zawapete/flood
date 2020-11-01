import {makeAutoObservable} from 'mobx';

import type {AuthMethod} from '@shared/schema/Auth';
import type {AuthVerificationPreloadConfigs} from '@shared/schema/api/auth';

class ConfigStore {
  baseURI = window.location.pathname.substr(0, window.location.pathname.lastIndexOf('/') + 1);
  authMethod: AuthMethod = 'default';
  pollInterval = 2000;
  predefinedUsername: string | undefined;

  constructor() {
    makeAutoObservable(this);
  }

  handlePreloadConfigs({authMethod, pollInterval, predefinedUsername}: AuthVerificationPreloadConfigs) {
    this.authMethod = authMethod || 'default';
    this.pollInterval = pollInterval || 2000;
    this.predefinedUsername = predefinedUsername || undefined;
  }
}

export default new ConfigStore();
