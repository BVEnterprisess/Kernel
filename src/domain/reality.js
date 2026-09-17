import { EpistemicStatus } from './epistemic.js';
import { getAvailableActionSpace } from './action-space.js';
import { computeRankingDecay } from './scoring.js';

/**
 * Deterministic, reconstructible projection of the current YantrikDB operational reality.
 * Maintains zero shadow state and zero second-database authority.
 */
export class YantrikRealityModel {
  constructor({
    backendMode = 'embedded',
    serverUrl = null,
    dbPath = null,
    capabilities = {},
    isAdmin = false,
    initialSeq = 0,
  } = {}) {
    this.backendMode = backendMode;
    this.serverUrl = serverUrl;
    this.dbPath = dbPath;
    this.capabilities = capabilities;
    this.isAdmin = isAdmin;

    // Epistemic system state
    this.lastObservedSeq = Number(initialSeq) || 0;
    this.systemHealth = {
      status: 'unknown',
      version: null,
      dbSizeBytes: null,
      epistemic: EpistemicStatus.UNKNOWN,
    };

    // Live causal timeline of mutations & verified state advancements
    this.mutationAuditTrail = [];
    this.actionHistory = [];
    
    // Scoped snapshot state (deterministic projection)
    this.currentScope = 'hermes:hermes:default';
    this.scopeStats = null;
    this.activeRecordsCount = 0;
    this.consolidatedCount = 0;
    this.tombstonedCount = 0;
    this.openConflictsCount = 0;
  }

  /**
   * Projects authoritative health check data into the reality model
   */
  projectHealth(health) {
    if (!health) return;
    this.systemHealth = {
      status: health.status || 'ok',
      version: health.yantrikdb_version || '0.23.0',
      dbSizeBytes: health.db_size_bytes ?? null,
      namespaces: health.namespaces || [],
      epistemic: EpistemicStatus.OBSERVED,
    };
    if (health.cluster_seq && !isNaN(Number(health.cluster_seq))) {
      this.advanceSequence(Number(health.cluster_seq), 'health_poll');
    }
  }

  /**
   * Projects stats and aggregates into the reality model
   */
  projectStats(stats, namespace) {
    if (!stats) return;
    this.currentScope = namespace;
    this.scopeStats = stats;
    this.openConflictsCount = stats.open_conflicts ?? 0;

    const engine = stats.engine || {};
    this.activeRecordsCount = engine.active_memories ?? (stats.memory_status || []).find(s => s.status === 'active')?.count ?? 0;
    this.consolidatedCount = engine.consolidated_memories ?? (stats.memory_status || []).find(s => s.status === 'consolidated')?.count ?? 0;
    this.tombstonedCount = engine.tombstoned_memories ?? (stats.memory_status || []).find(s => s.status === 'tombstoned')?.count ?? 0;

    if (stats.cluster_seq && !isNaN(Number(stats.cluster_seq))) {
      this.advanceSequence(Number(stats.cluster_seq), 'stats_sync');
    }
  }

  /**
   * Advances sequence counter monotonically and records event evidence
   */
  advanceSequence(newSeq, source = 'mutation') {
    const prev = this.lastObservedSeq;
    if (newSeq > this.lastObservedSeq) {
      this.lastObservedSeq = newSeq;
      return { advanced: true, from: prev, to: newSeq, source };
    }
    return { advanced: false, current: this.lastObservedSeq };
  }

  /**
   * Records a mutation causal event in the audit trail
   */
  recordMutation({
    actionId,
    actionName,
    initiatedBy = 'operator',
    authority = 'admin',
    requestPayload = {},
    resultPayload = {},
    priorSeq = null,
    resultingSeq = null,
    affectedRids = [],
    outcomeSummary = '',
  }) {
    const timestamp = Math.floor(Date.now() / 1000);
    const seq = resultingSeq ?? this.lastObservedSeq;
    if (resultingSeq) {
      this.advanceSequence(resultingSeq, actionId);
    }

    const entry = {
      id: `mut-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp,
      event_time: timestamp,
      actionId,
      actionName,
      initiatedBy,
      authority,
      requestPayload,
      resultPayload,
      sequenceAdvancement: {
        from: priorSeq ?? this.lastObservedSeq,
        to: seq,
      },
      affectedRids,
      outcomeSummary,
      epistemic: EpistemicStatus.OBSERVED,
    };

    this.mutationAuditTrail.unshift(entry);
    if (this.mutationAuditTrail.length > 100) {
      this.mutationAuditTrail.pop();
    }
    return entry;
  }

  /**
   * Computes the current observable action space
   */
  getActionSpace() {
    return getAvailableActionSpace({
      capabilities: this.capabilities,
      isAdmin: this.isAdmin,
      mode: this.backendMode,
    });
  }

  /**
   * Annotates memory list items with real epistemic status and computed temporal decay
   */
  projectMemoryList(items = [], current_ts = Math.floor(Date.now() / 1000)) {
    return items.map(item => {
      const decay = computeRankingDecay(item.event_time || item.created_at, current_ts, item.half_life);
      let epistemic = EpistemicStatus.OBSERVED;

      if (item.consolidation_status === 'tombstoned') {
        epistemic = EpistemicStatus.DERIVED; // Tombstone preserved as historical evidence
      } else if (item.certainty && Number(item.certainty) < 0.7) {
        epistemic = EpistemicStatus.UNCERTAIN;
      } else if (decay < 0.15) {
        epistemic = EpistemicStatus.STALE;
      }

      return {
        ...item,
        temporal_decay_factor: decay,
        epistemic_status: epistemic,
      };
    });
  }

  /**
   * Returns a lightweight diagnostic projection snapshot for the UI
   */
  getProjectionSnapshot() {
    return {
      backendMode: this.backendMode,
      serverUrl: this.serverUrl,
      dbPath: this.dbPath,
      lastObservedSeq: this.lastObservedSeq,
      systemHealth: this.systemHealth,
      scope: this.currentScope,
      metrics: {
        active: this.activeRecordsCount,
        consolidated: this.consolidatedCount,
        tombstoned: this.tombstonedCount,
        openConflicts: this.openConflictsCount,
      },
      mutationsCount: this.mutationAuditTrail.length,
      latestMutations: this.mutationAuditTrail.slice(0, 10),
      actionSpace: this.getActionSpace(),
    };
  }
}
