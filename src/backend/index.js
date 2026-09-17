import { EmbeddedBackend } from './embedded.js';
import { HttpBackend } from './http.js';
import { CAPABILITIES } from './capabilities.js';
import { YantrikError, unsupportedFeatureError } from './errors.js';

export function createBackend(config = {}) {
  const isHttp = Boolean(config.serverUrl || process.env.YANTRIKDB_SERVER_URL);
  if (isHttp) {
    return new HttpBackend({
      serverUrl: config.serverUrl || process.env.YANTRIKDB_SERVER_URL,
      token: config.token || process.env.YANTRIKDB_TOKEN,
      defaultNamespace: config.defaultNamespace || process.env.YANTRIKDB_DASHBOARD_NAMESPACE || 'hermes:hermes:default',
    });
  }
  return new EmbeddedBackend({
    dataStore: config.dataStore,
    dbPath: config.dbPath || process.env.YANTRIKDB_DB_PATH,
    defaultNamespace: config.defaultNamespace || process.env.YANTRIKDB_DASHBOARD_NAMESPACE || 'hermes:hermes:default',
  });
}

export {
  EmbeddedBackend,
  HttpBackend,
  CAPABILITIES,
  YantrikError,
  unsupportedFeatureError,
};
