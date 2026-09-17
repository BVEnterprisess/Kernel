import { normalizeServerError, unsupportedFeatureError } from './errors.js';

/**
 * Current YantrikDB Server HTTP Client (v0.19.0 contract)
 */
export class HttpBackend {
  constructor({ serverUrl, token, defaultNamespace = 'hermes:hermes:default' } = {}) {
    this.mode = 'http';
    this.serverUrl = (serverUrl || process.env.YANTRIKDB_SERVER_URL || 'http://127.0.0.1:7438').replace(/\/+$/, '');
    this.token = token || process.env.YANTRIKDB_TOKEN || '';
    this.defaultNamespace = defaultNamespace;
    this.latestClusterSeq = null;
  }

  async _request(endpoint, { method = 'GET', body = null, query = {}, min_seq = null } = {}) {
    const url = new URL(`${this.serverUrl}${endpoint}`);
    
    // Attach query params
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }

    // Read-your-writes min_seq support
    const reqMinSeq = min_seq ?? this.latestClusterSeq;
    if (reqMinSeq !== null && reqMinSeq !== undefined && !url.searchParams.has('min_seq')) {
      url.searchParams.set('min_seq', String(reqMinSeq));
    }

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let res;
    try {
      res = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw normalizeServerError({ status: 503, statusText: err.message, text: async () => JSON.stringify({ detail: err.message }) }, endpoint);
    }

    // Track returned cluster sequence
    const seqHeader = res.headers.get('x-cluster-seq') || res.headers.get('x-sequence');
    if (seqHeader && !isNaN(Number(seqHeader))) {
      this.latestClusterSeq = Math.max(this.latestClusterSeq || 0, Number(seqHeader));
    }

    if (!res.ok) {
      throw await normalizeServerError(res, endpoint);
    }

    const data = await res.json();
    if (data.cluster_seq && !isNaN(Number(data.cluster_seq))) {
      this.latestClusterSeq = Math.max(this.latestClusterSeq || 0, Number(data.cluster_seq));
    }
    return data;
  }

  async getHealth() {
    const data = await this._request('/v1/health');
    return {
      ok: true,
      status: data.status || 'ok',
      mode: 'http',
      server_url: this.serverUrl,
      db_path: null,
      db_exists: true,
      db_size_bytes: data.db_size_bytes || 0,
      base_namespace: 'hermes',
      default_namespace: this.defaultNamespace,
      admin_enabled: true,
      password_enabled: false,
      yantrikdb_version: data.version || '0.23.0',
      cluster_seq: this.latestClusterSeq,
      plugin: {
        import_origin: 'cluster-http',
      },
      warnings: data.engine_backfilling ? ['Replica is currently backfilling state'] : [],
      namespaces: data.namespaces || [],
    };
  }

  async getStats(namespace = '__all__') {
    const query = {};
    if (namespace && namespace !== '__all__') {
      query.namespace = namespace;
    }
    return await this._request('/v1/stats', { query });
  }

  async getMemories({
    namespace = '__all__',
    status = 'active',
    domain = '',
    source = '',
    memory_type = '',
    q = '',
    limit = 50,
    offset = 0,
    sort = 'created_at',
    after = '',
    min_seq = null,
  } = {}) {
    const query = { limit, offset, sort };
    if (namespace && namespace !== '__all__') query.namespace = namespace;
    if (status && status !== 'all') query.status = status;
    if (domain) query.domain = domain;
    if (source) query.source = source;
    if (memory_type) query.memory_type = memory_type;
    if (q) query.q = q;
    if (after) query.after = after;
    if (min_seq) query.min_seq = min_seq;

    return await this._request('/v1/memories', { query, min_seq });
  }

  async getMemory(rid, { min_seq = null } = {}) {
    return await this._request(`/v1/memory/${encodeURIComponent(rid)}`, { min_seq });
  }

  async forgetMemory(rid, { reason = 'Operator action' } = {}) {
    return await this._request('/v1/forget', {
      method: 'POST',
      body: { rid, reason },
    });
  }

  async recall({
    query,
    namespace = '__all__',
    top_k = 10,
    domain = '',
    source = '',
    include_consolidated = false,
    certainty_threshold = 0.5,
    skip_reinforce = true,
  } = {}) {
    const body = {
      query,
      top_k,
      include_consolidated,
      certainty_threshold,
      skip_reinforce,
    };
    if (namespace && namespace !== '__all__') body.namespace = namespace;
    if (domain) body.domain = domain;
    if (source) body.source = source;

    return await this._request('/v1/recall', {
      method: 'POST',
      body,
    });
  }

  async getConflicts(status = '') {
    const query = {};
    if (status) query.status = status;
    return await this._request('/v1/conflicts', { query });
  }

  async getConflict(id) {
    return await this._request(`/v1/conflicts/${encodeURIComponent(id)}`);
  }

  async resolveConflict(id, { strategy = 'override', winner_rid = null, resolution_note = '' } = {}) {
    return await this._request(`/v1/conflicts/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      body: { strategy, winner_rid, resolution_note },
    });
  }

  async think({ namespace = '__all__', dry_run = false } = {}) {
    const body = { dry_run };
    if (namespace && namespace !== '__all__') body.namespace = namespace;
    return await this._request('/v1/think', {
      method: 'POST',
      body,
    });
  }

  async getIdentityScope() {
    return await this._request('/v1/identity-scope');
  }

  async saveIdentityScope(identity_scope) {
    return await this._request('/v1/identity-scope', {
      method: 'POST',
      body: { identity_scope },
    });
  }

  // --- Endpoints not currently supported by upstream yantrikdb-server HTTP API ---
  async getEntities() {
    throw unsupportedFeatureError('Entity search', 'Entities listing (/v1/entities) is not yet exposed by yantrikdb-server.');
  }

  async getGraph(entity) {
    throw unsupportedFeatureError('Entity Graph', `Entity graph queries (/v1/graph/${entity}) are not yet exposed by yantrikdb-server.`);
  }

  async getPatterns() {
    throw unsupportedFeatureError('Patterns', 'Patterns query (/v1/patterns) is not yet exposed by yantrikdb-server.');
  }

  async getTriggers() {
    throw unsupportedFeatureError('Triggers', 'Triggers listing (/v1/triggers) is not yet exposed by yantrikdb-server.');
  }

  async getStale() {
    throw unsupportedFeatureError('Lifecycle: Stale', 'Stale memory inspection (/v1/stale) is not yet exposed by yantrikdb-server.');
  }

  async getUpcoming() {
    throw unsupportedFeatureError('Lifecycle: Upcoming', 'Upcoming memory queries (/v1/upcoming) are not yet exposed by yantrikdb-server.');
  }

  async getSessions() {
    throw unsupportedFeatureError('Sessions', 'Session inspection (/v1/sessions) is not yet exposed by yantrikdb-server.');
  }
}
