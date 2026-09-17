/**
 * Epistemic Status Constants for YantrikDB Reality Model
 * 
 * Explicitly distinguishes epistemic reality:
 * - OBSERVED: Ground-truth record directly stored and observed from engine.
 * - RECALLED: Information surfaced dynamically through a multi-signal recall query.
 * - DERIVED: Computed mathematical value (e.g. ranking decay, aggregated cluster sequence, score contributions).
 * - CONFLICTED: Disputed claim / contradictory memories flagged by contradiction scanner.
 * - UNCERTAIN: Information with certainty metric < 0.70 or unconfirmed provenance.
 * - STALE: Active record with elapsed access time beyond freshness threshold (>30 days).
 * - UNKNOWN: Field or entity not currently stored or verifiable in engine state.
 * - UNAVAILABLE: Feature or endpoint not exposed by the current backend adapter.
 */

export const EpistemicStatus = {
  OBSERVED: 'observed',
  RECALLED: 'recalled',
  DERIVED: 'derived',
  CONFLICTED: 'conflicted',
  UNCERTAIN: 'uncertain',
  STALE: 'stale',
  UNKNOWN: 'unknown',
  UNAVAILABLE: 'unavailable',
};

/**
 * Authority requirement levels for the Action Space
 */
export const AuthorityLevel = {
  READ_ONLY: 'read_only',
  OPERATOR: 'operator',
  ADMIN: 'admin',
};

/**
 * Categorization of Action Space Primitives
 */
export const ActionCategory = {
  INSPECTION: 'inspection',
  RECALL: 'recall',
  MUTATION: 'mutation',
  MAINTENANCE: 'maintenance',
  DIAGNOSTICS: 'diagnostics',
};
