import { AuthorityLevel, ActionCategory } from './epistemic.js';

/**
 * Authoritative registry of the real YantrikDB action space.
 * Mapped to real engine/server endpoints, requirements, mutations, and observable evidence.
 */
export const ACTION_SPACE_DEFINITIONS = [
  {
    id: 'health_inspection',
    name: 'Health & System Diagnostics',
    category: ActionCategory.INSPECTION,
    endpoint: '/v1/health',
    method: 'GET',
    capabilityKey: 'health',
    authority: AuthorityLevel.READ_ONLY,
    description: 'Inspect engine version, storage sizing, namespace list, and cluster sequence.',
    mutation: false,
    emitsEvidence: ['cluster_seq', 'db_size_bytes', 'namespaces'],
    resultingOutcome: 'System operational status and sequence sync state.',
  },
  {
    id: 'stats_aggregation',
    name: 'Aggregate Scope Metrics',
    category: ActionCategory.INSPECTION,
    endpoint: '/v1/stats',
    method: 'GET',
    capabilityKey: 'stats',
    authority: AuthorityLevel.READ_ONLY,
    description: 'Calculates active/consolidated/tombstoned breakdown, domains, types, and recent writes.',
    mutation: false,
    emitsEvidence: ['memory_status', 'by_domain', 'recent_by_day', 'cluster_seq'],
    resultingOutcome: 'Epistemic snapshot of namespace composition.',
  },
  {
    id: 'memories_list',
    name: 'Keyset & Paginated Memory Traversal',
    category: ActionCategory.INSPECTION,
    endpoint: '/v1/memories',
    method: 'GET',
    capabilityKey: 'memories_list',
    authority: AuthorityLevel.READ_ONLY,
    description: 'Deterministic cursor-based (`after`) or offset memory retrieval with read-your-writes `min_seq`.',
    mutation: false,
    emitsEvidence: ['next_cursor', 'items', 'total', 'cluster_seq'],
    resultingOutcome: 'Ordered sequence of memory records.',
  },
  {
    id: 'memory_point_read',
    name: 'Point Read & Evidence Inspection',
    category: ActionCategory.INSPECTION,
    endpoint: '/v1/memory/:rid',
    method: 'GET',
    capabilityKey: 'memory_detail',
    authority: AuthorityLevel.READ_ONLY,
    description: 'Point read verifying event-time, claims, entities, and consolidation sources.',
    mutation: false,
    emitsEvidence: ['event_time', 'claims', 'entities', 'consolidation_sources', 'cluster_seq'],
    resultingOutcome: 'Authoritative memory record with provenance graph.',
  },
  {
    id: 'recall_query',
    name: 'Multi-Signal Relevance Recall',
    category: ActionCategory.RECALL,
    endpoint: '/v1/recall',
    method: 'POST',
    capabilityKey: 'recall',
    authority: AuthorityLevel.READ_ONLY,
    description: 'Queries HNSW vector, FTS5 lexical, claims, and graph lanes without reinforcing access weight.',
    mutation: false,
    emitsEvidence: ['scores.contributions', 'scores.lanes', 'fallback', 'why_retrieved', 'cluster_seq'],
    resultingOutcome: 'Ranked candidate memories with explainable score decomposition.',
  },
  {
    id: 'forget_memory',
    name: 'Tombstone Memory Record',
    category: ActionCategory.MUTATION,
    endpoint: '/v1/forget',
    method: 'POST',
    capabilityKey: 'forget',
    authority: AuthorityLevel.ADMIN,
    description: 'Irreversibly marks memory as tombstoned with an operator reason; removes from active recall.',
    mutation: true,
    emitsEvidence: ['cluster_seq', 'rid', 'tombstone_reason', 'updated_at'],
    resultingOutcome: 'Memory consolidation_status becomes tombstoned; monotonic cluster_seq advances.',
  },
  {
    id: 'conflicts_inspection',
    name: 'Inspect Contradictions & Claims',
    category: ActionCategory.INSPECTION,
    endpoint: '/v1/conflicts',
    method: 'GET',
    capabilityKey: 'conflicts_list',
    authority: AuthorityLevel.READ_ONLY,
    description: 'Inspects single-valued claim collisions detected by engine scanner.',
    mutation: false,
    emitsEvidence: ['conflict_id', 'memory_a', 'memory_b', 'priority', 'status'],
    resultingOutcome: 'List of active or historical contradictions.',
  },
  {
    id: 'conflict_resolution',
    name: 'Resolve Contradiction Claim',
    category: ActionCategory.MUTATION,
    endpoint: '/v1/conflicts/:id/resolve',
    method: 'POST',
    capabilityKey: 'conflicts_resolve',
    authority: AuthorityLevel.ADMIN,
    description: 'Applies resolution strategy (override, keep_newer, keep_older) and records operator audit note.',
    mutation: true,
    emitsEvidence: ['cluster_seq', 'resolved_at', 'resolved_by', 'strategy', 'winner_rid'],
    resultingOutcome: 'Conflict status advances to resolved; winning claim persisted.',
  },
  {
    id: 'think_maintenance',
    name: 'Execute Cognitive Maintenance Pass',
    category: ActionCategory.MAINTENANCE,
    endpoint: '/v1/think',
    method: 'POST',
    capabilityKey: 'think',
    authority: AuthorityLevel.ADMIN,
    description: 'Scans contradictions, consolidates duplicate semantic representations, and updates decay priors.',
    mutation: true,
    emitsEvidence: ['consolidated_count', 'scanned_conflicts', 'cluster_seq'],
    resultingOutcome: 'Graph maintenance completed; cluster sequence advanced.',
  },
  {
    id: 'hygiene_cleanup',
    name: 'Bulk Memory Hygiene Pass',
    category: ActionCategory.MAINTENANCE,
    endpoint: '/api/hygiene',
    method: 'POST',
    capabilityKey: 'hygiene',
    authority: AuthorityLevel.ADMIN,
    description: 'Runs consolidation and bulk tombstoning of operator-confirmed low-utility memories.',
    mutation: true,
    emitsEvidence: ['forgotten', 'consolidation', 'cluster_seq'],
    resultingOutcome: 'Batch memory state consolidation and audit logging.',
  },
  {
    id: 'entity_graph_inspection',
    name: 'Entity & Relationship Graph Query',
    category: ActionCategory.INSPECTION,
    endpoint: '/v1/graph/:entity',
    method: 'GET',
    capabilityKey: 'graph',
    authority: AuthorityLevel.READ_ONLY,
    description: 'Traces relationship edges, weights, and explicit claims linked to an entity node.',
    mutation: false,
    emitsEvidence: ['nodes', 'edges', 'memories'],
    resultingOutcome: 'Subgraph representation of entity connectivity.',
  },
  {
    id: 'identity_scope_mapping',
    name: 'Identity Scope Configuration',
    category: ActionCategory.MAINTENANCE,
    endpoint: '/v1/identity-scope',
    method: 'POST',
    capabilityKey: 'identity_scope',
    authority: AuthorityLevel.ADMIN,
    description: 'Maps namespace prefixes to primary user, shared household, or legacy actor profiles.',
    mutation: true,
    emitsEvidence: ['identity_scope', 'namespace_inventory'],
    resultingOutcome: 'Authoritative namespace routing table updated.',
  },
];

/**
 * Computes available action space based on current backend capabilities and admin authorization.
 */
export function getAvailableActionSpace({ capabilities = {}, isAdmin = false, mode = 'embedded' }) {
  return ACTION_SPACE_DEFINITIONS.map(action => {
    const isSupportedByBackend = Boolean(capabilities[action.capabilityKey]);
    const requiresAdmin = action.authority === AuthorityLevel.ADMIN;
    const isAuthorized = !requiresAdmin || isAdmin;

    let operationalState = 'available';
    if (!isSupportedByBackend) {
      operationalState = 'unsupported_by_backend';
    } else if (requiresAdmin && !isAdmin) {
      operationalState = 'requires_admin_authorization';
    }

    return {
      ...action,
      backendMode: mode,
      isSupported: isSupportedByBackend,
      isAuthorized,
      operationalState,
    };
  });
}
