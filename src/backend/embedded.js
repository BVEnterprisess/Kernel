import { createSeedData } from '../../seed-data.js';
import { explainRecallScore, YantrikMemory } from '../domain/index.js';

/**
 * Embedded Store Backend (In-Memory / SQLite compliant)
 */
export class EmbeddedBackend {
  constructor(options = {}) {
    this.mode = 'embedded';
    this.dataStore = options.dataStore || createSeedData();
    this.dbPath = options.dbPath || this.dataStore.settings.db_path || '/home/user/.hermes/yantrikdb-memory.db';
    this.defaultNamespace = options.defaultNamespace || 'hermes:hermes:default';
    this.currentClusterSeq = options.initialClusterSeq || 42;
  }

  nextSeq() {
    this.currentClusterSeq += 1;
    return this.currentClusterSeq;
  }

  getNamespaces() {
    const counts = {};
    for (const m of this.dataStore.memories) {
      counts[m.namespace] = (counts[m.namespace] || 0) + 1;
    }
    return Object.entries(counts).map(([namespace, count]) => ({ namespace, count }));
  }

  async getHealth() {
    const namespaces = this.getNamespaces();
    return {
      ok: true,
      status: 'ok',
      mode: 'embedded',
      db_path: this.dbPath,
      db_exists: true,
      db_size_bytes: 1048576,
      base_namespace: 'hermes',
      default_namespace: this.defaultNamespace,
      admin_enabled: Boolean(this.dataStore.settings.admin_mode),
      admin_mode_env: true,
      password_enabled: false,
      settings_path: this.dataStore.settings.settings_path,
      yantrikdb_version: '0.23.0',
      embedder: 'default',
      embedding_dim: 384,
      cluster_seq: this.currentClusterSeq,
      plugin: {
        path: '/home/user/.hermes/plugins/yantrikdb',
        exists: true,
        versions: { root_manifest: '0.3.0', bundled_manifest: '0.3.0' },
        import_origin: 'built-in',
      },
      warnings: [],
      namespaces,
    };
  }

  async getStats(namespace = '__all__') {
    const isAll = namespace === '__all__';
    const filtered = isAll
      ? this.dataStore.memories
      : this.dataStore.memories.filter(m => m.namespace === namespace);

    const statusMap = {};
    const domainMap = {};
    const sourceMap = {};
    const typeMap = {};
    const dayMap = {};

    for (const m of filtered) {
      const s = m.consolidation_status || 'active';
      statusMap[s] = (statusMap[s] || 0) + 1;
      domainMap[m.domain || 'general'] = (domainMap[m.domain || 'general'] || 0) + 1;
      sourceMap[m.source || 'default'] = (sourceMap[m.source || 'default'] || 0) + 1;
      typeMap[m.type || 'semantic'] = (typeMap[m.type || 'semantic'] || 0) + 1;

      const day = new Date((m.created_at || Date.now() / 1000) * 1000).toISOString().split('T')[0];
      dayMap[day] = (dayMap[day] || 0) + 1;
    }

    const memory_status = Object.entries(statusMap).map(([status, count]) => ({ status, count }));
    const by_domain = Object.entries(domainMap).map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count);
    const by_source = Object.entries(sourceMap).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
    const by_type = Object.entries(typeMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
    const recent_by_day = Object.entries(dayMap).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day));

    const openConflicts = this.dataStore.conflicts.filter(c => c.status === 'open').length;

    return {
      namespace,
      cluster_seq: this.currentClusterSeq,
      memory_status,
      by_domain,
      by_source,
      by_type,
      recent_by_day,
      open_conflicts: openConflicts,
      entities: this.dataStore.entities.length,
      edges: this.dataStore.claims.length,
      engine: {
        active_memories: statusMap.active || 0,
        consolidated_memories: statusMap.consolidated || 0,
        tombstoned_memories: statusMap.tombstoned || 0,
        scope: isAll ? 'all_namespaces_sql' : 'embedded',
      },
    };
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
  } = {}) {
    let items = this.dataStore.memories;

    if (namespace !== '__all__') {
      items = items.filter(m => m.namespace === namespace);
    }
    if (status && status !== 'all') {
      items = items.filter(m => m.consolidation_status === status);
    }
    if (domain) {
      items = items.filter(m => m.domain === domain);
    }
    if (source) {
      items = items.filter(m => m.source === source);
    }
    if (memory_type) {
      items = items.filter(m => m.type === memory_type);
    }
    if (q) {
      const qLower = q.toLowerCase();
      items = items.filter(m =>
        (m.text && m.text.toLowerCase().includes(qLower)) ||
        (m.rid && m.rid.toLowerCase().includes(qLower)) ||
        (m.domain && m.domain.toLowerCase().includes(qLower)) ||
        (m.source && m.source.toLowerCase().includes(qLower))
      );
    }

    // Keyset cursor handling
    if (after) {
      const idx = items.findIndex(m => m.rid === after);
      if (idx !== -1) {
        items = items.slice(idx + 1);
      }
    }

    items = [...items].sort((a, b) => {
      const valA = a[sort] ?? 0;
      const valB = b[sort] ?? 0;
      return valB > valA ? 1 : valB < valA ? -1 : 0;
    });

    const total = items.length;
    const paginated = items.slice(offset, offset + limit);
    const lastItem = paginated[paginated.length - 1];

    return {
      total,
      limit,
      offset,
      cluster_seq: this.currentClusterSeq,
      has_more: offset + limit < total,
      next_cursor: lastItem ? lastItem.rid : null,
      items: paginated,
    };
  }

  async getMemory(rid, { min_seq } = {}) {
    const memory = this.dataStore.memories.find(m => m.rid === rid);
    if (!memory) return null;

    const relatedEntities = this.dataStore.entities.slice(0, 3).map(e => ({ entity_name: e.name }));
    const relatedClaims = this.dataStore.claims.filter(c => c.source_memory_rid === rid);

    return {
      ...memory,
      cluster_seq: this.currentClusterSeq,
      event_time: memory.event_time || memory.created_at,
      consolidation_sources: memory.consolidated_into ? [{ source_rid: memory.consolidated_into }] : [],
      entities: relatedEntities,
      claims: relatedClaims,
    };
  }

  async forgetMemory(rid, { reason = 'Operator action' } = {}) {
    const mem = this.dataStore.memories.find(m => m.rid === rid);
    if (!mem) return { rid, found: false };
    mem.consolidation_status = 'tombstoned';
    mem.tombstone_reason = reason;
    mem.updated_at = Math.floor(Date.now() / 1000);
    const newSeq = this.nextSeq();
    return { ok: true, rid, found: true, cluster_seq: newSeq };
  }

  async recall({
    query,
    namespace = '__all__',
    top_k = 10,
    domain = '',
    source = '',
    include_consolidated = false,
    certainty_threshold = 0.5,
  } = {}) {
    const terms = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
    let pool = this.dataStore.memories;

    if (namespace !== '__all__') {
      pool = pool.filter(m => m.namespace === namespace);
    }
    if (!include_consolidated) {
      pool = pool.filter(m => m.consolidation_status === 'active');
    }
    if (domain) pool = pool.filter(m => m.domain === domain);
    if (source) pool = pool.filter(m => m.source === source);

    const scored = pool.map(m => {
      const explanation = explainRecallScore({
        memory: m,
        terms,
        current_ts: Math.floor(Date.now() / 1000),
      });

      return {
        ...m,
        score: explanation.final_score,
        certainty: Number((m.certainty || 0.85).toFixed(3)),
        event_time_start: m.event_time_start || m.event_time || m.created_at,
        event_time_end: m.event_time_end || m.event_time || m.created_at,
        fallback: explanation.fallback,
        scores: {
          similarity: explanation.similarity,
          recency: explanation.decay_factor,
          relevance: explanation.final_score,
          lanes: explanation.lanes,
          contributions: {
            semantic: explanation.contributions.semantic_vector,
            importance: explanation.contributions.importance_weight,
            temporal_decay: explanation.contributions.temporal_decay,
            keyword_match: explanation.contributions.lexical_bm25,
            cross_lane_agreement: explanation.contributions.cross_lane_agreement,
          },
        },
        why_retrieved: [
          ...explanation.why_retrieved,
          namespace === '__all__' ? 'cross-namespace match' : 'namespace match',
          `domain:${m.domain || 'general'}`,
        ],
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, Math.min(50, top_k));

    return {
      results,
      namespace,
      cluster_seq: this.currentClusterSeq,
      certainty_reasons: [
        `Recalled ${results.length} candidate memories with scores above ${certainty_threshold}`,
      ],
    };
  }

  async getConflicts(status = '') {
    let items = this.dataStore.conflicts;
    if (status) items = items.filter(c => c.status === status);
    return { items, cluster_seq: this.currentClusterSeq };
  }

  async getConflict(id) {
    return this.dataStore.conflicts.find(x => x.conflict_id === id) || null;
  }

  async resolveConflict(id, { strategy = 'override', winner_rid = null, resolution_note = '' } = {}) {
    const c = this.dataStore.conflicts.find(x => x.conflict_id === id);
    if (!c) return null;
    c.status = 'resolved';
    c.resolved_at = Math.floor(Date.now() / 1000);
    c.resolved_by = 'operator';
    c.strategy = strategy;
    c.winner_rid = winner_rid;
    c.resolution_note = resolution_note || 'Resolved via dashboard operator action';
    const newSeq = this.nextSeq();
    return { ok: true, result: c, cluster_seq: newSeq };
  }

  async think({ namespace = '__all__', dry_run = false } = {}) {
    const newSeq = dry_run ? this.currentClusterSeq : this.nextSeq();
    return {
      ok: true,
      result: {
        consolidated_count: 0,
        scanned_conflicts: this.dataStore.conflicts.length,
        dry_run: Boolean(dry_run),
      },
      cluster_seq: newSeq,
    };
  }

  async getIdentityScope() {
    const nsList = this.getNamespaces();
    const inventory = nsList.map(({ namespace, count }) => {
      let mapped = false;
      let mapped_to = '';
      let mapping_type = '';
      let mapping_source = '';
      let mapped_scope = namespace;

      if (namespace.includes('owner-yc')) {
        mapped = true;
        mapped_to = 'YC (Primary User)';
        mapping_type = 'identity';
        mapping_source = 'configured';
        mapped_scope = 'owner:yc';
      } else if (namespace.includes('household')) {
        mapped = true;
        mapped_to = 'Shared Household Space';
        mapping_type = 'shared_scope';
        mapping_source = 'configured';
        mapped_scope = namespace;
      } else if (namespace.includes('whatsapp-6590000000')) {
        mapped = true;
        mapped_to = 'YC (Primary User) via old account bucket';
        mapping_type = 'legacy_actor_fallback';
        mapping_source = 'include_legacy_actor_namespace_recall';
        mapped_scope = 'owner:whatsapp-6590000000-7ca11f3b2d88';
      } else if (namespace === this.defaultNamespace) {
        mapped = true;
        mapped_to = 'Shared by all profiles';
        mapping_type = 'shared_fallback';
        mapping_source = 'include_base_namespace_recall';
        mapped_scope = this.defaultNamespace;
      }

      return {
        namespace,
        count,
        mapped,
        mapped_scope,
        mapped_to,
        mapping_type,
        mapping_source,
        derived_by_config: mapping_type.includes('fallback'),
      };
    });

    return {
      identity_scope: this.dataStore.identityScope,
      namespace_inventory: inventory,
      summary: {
        identities: this.dataStore.identityScope.identities.length,
        actors: this.dataStore.identityScope.actors.length,
        spaces: this.dataStore.identityScope.spaces.length,
        conversations: this.dataStore.identityScope.conversations.length,
        unmapped_namespaces: inventory.filter(i => !i.mapped).length,
      },
      imported_identity_scope: {},
      runtime_scope: this.dataStore.settings.yantrikdb,
    };
  }

  async saveIdentityScope(identity_scope) {
    if (identity_scope) {
      this.dataStore.identityScope = identity_scope;
    }
    return this.getIdentityScope();
  }

  async getEntities(q = '') {
    let items = this.dataStore.entities;
    if (q) {
      const qLower = q.toLowerCase();
      items = items.filter(e => e.name.toLowerCase().includes(qLower));
    }
    return { items };
  }

  async getGraph(entity) {
    const nodes = [{ id: entity, label: entity }];
    const edges = [];
    const matchingClaims = this.dataStore.claims.filter(c => c.src === entity || c.dst === entity);

    for (const c of matchingClaims) {
      const other = c.src === entity ? c.dst : c.src;
      if (!nodes.some(n => n.id === other)) {
        nodes.push({ id: other, label: other });
      }
      edges.push({
        source: c.src,
        target: c.dst,
        type: c.rel_type,
        weight: c.weight,
      });
    }

    const relatedMemories = this.dataStore.memories
      .filter(m => m.text.toLowerCase().includes(entity.toLowerCase()))
      .slice(0, 20);

    return {
      entity,
      nodes,
      edges,
      memories: relatedMemories,
    };
  }

  async getPatterns() {
    return { items: this.dataStore.patterns };
  }

  async getTriggers() {
    return { items: this.dataStore.triggers, source: 'engine' };
  }

  async getStale(days = 30) {
    const now = Date.now() / 1000;
    const cutoff = now - days * 86400;
    const items = this.dataStore.memories
      .filter(m => m.consolidation_status === 'active' && m.last_access < cutoff)
      .slice(0, 50);
    return { items };
  }

  async getUpcoming(days = 7) {
    const now = Date.now() / 1000;
    const end = now + days * 86400;
    const items = this.dataStore.memories
      .filter(m => m.due_at && m.due_at <= end)
      .slice(0, 50);
    return { items };
  }

  async getSessions() {
    return { items: this.dataStore.sessions };
  }
}
