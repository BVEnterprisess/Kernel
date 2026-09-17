/**
 * Centralized error normalization for YantrikDB server and dashboard backends.
 */

export class YantrikError extends Error {
  constructor({
    status = 500,
    code = 'internal_error',
    message = 'An error occurred in the YantrikDB engine',
    hint = null,
    requestId = null,
    feature = null,
    upstreamReference = null,
    details = null,
  }) {
    super(message);
    this.name = 'YantrikError';
    this.status = status;
    this.code = code;
    this.hint = hint;
    this.requestId = requestId;
    this.feature = feature;
    this.upstreamReference = upstreamReference;
    this.details = details;
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      status: this.status,
      hint: this.hint,
      request_id: this.requestId,
      feature: this.feature,
      upstream_reference: this.upstreamReference,
      details: this.details,
    };
  }
}

/**
 * Creates an HTTP 501 Unsupported Feature error for endpoints not yet provided by yantrikdb-server
 */
export function unsupportedFeatureError(feature, reason) {
  return new YantrikError({
    status: 501,
    code: 'feature_unsupported_by_upstream_server',
    message: `${feature} is not available over the current yantrikdb-server HTTP API.`,
    hint: 'This feature is available in embedded SQLite mode, or pending server endpoint support.',
    feature,
    upstreamReference: 'https://github.com/yantrikos/yantrikdb-server/issues/39',
    details: { reason },
  });
}

/**
 * Normalizes any fetch/HTTP error response from yantrikdb-server
 */
export async function normalizeServerError(res, endpoint) {
  let body = {};
  try {
    const text = await res.text();
    body = text ? JSON.parse(text) : {};
  } catch (_e) {
    body = { raw: 'Non-JSON response from server' };
  }

  const status = res.status;
  let code = body.error || body.code || 'upstream_server_error';
  let message = body.message || body.detail || res.statusText;
  let hint = body.hint || null;

  if (status === 401) {
    code = 'unauthorized';
    message = message || 'YantrikDB token missing or invalid';
    hint = hint || 'Check YANTRIKDB_TOKEN environment variable';
  } else if (status === 403) {
    code = 'forbidden';
    message = message || 'Access denied for requested namespace or resource';
    hint = hint || 'Verify token permissions and owner scope';
  } else if (status === 404) {
    code = 'not_found';
    message = message || 'Requested memory or resource not found';
  } else if (status === 412) {
    code = 'replica_behind';
    message = message || 'Replica has not yet applied requested min_seq';
    hint = hint || 'Retry read against primary or wait for cluster sync';
  } else if (status === 409) {
    code = 'idempotency_conflict';
    message = message || 'Write conflict or idempotency mismatch';
  }

  return new YantrikError({
    status,
    code,
    message,
    hint,
    requestId: res.headers.get('x-request-id') || body.request_id || null,
    details: { endpoint, upstream_status: status },
  });
}
