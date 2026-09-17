/**
 * YantrikDB Memory and Observation Domain Models
 * Pure data models independent of Express, DOM, or persistence backend.
 */

export class YantrikMemory {
  constructor({
    rid,
    text,
    type = 'semantic',
    domain = 'general',
    source = 'user',
    importance = 0.5,
    certainty = 0.85,
    created_at = Math.floor(Date.now() / 1000),
    updated_at = Math.floor(Date.now() / 1000),
    event_time = null,
    half_life = 604800,
    access_count = 0,
    namespace = 'hermes:hermes:default',
    consolidation_status = 'active',
    consolidated_into = null,
    tombstone_reason = null,
    metadata = {},
    metadata_json = {},
    entities = [],
    claims = [],
    consolidation_sources = [],
  }) {
    this.rid = rid;
    this.text = text;
    this.type = type;
    this.domain = domain;
    this.source = source;
    this.importance = Number(importance);
    this.certainty = Number(certainty);
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.event_time = event_time || created_at;
    this.half_life = half_life;
    this.access_count = access_count;
    this.namespace = namespace;
    this.consolidation_status = consolidation_status;
    this.consolidated_into = consolidated_into;
    this.tombstone_reason = tombstone_reason;
    this.metadata = metadata;
    this.metadata_json = metadata_json;
    this.entities = entities;
    this.claims = claims;
    this.consolidation_sources = consolidation_sources;
  }

  isTombstoned() {
    return this.consolidation_status === 'tombstoned';
  }

  isConsolidated() {
    return this.consolidation_status === 'consolidated';
  }

  toJSON() {
    return {
      rid: this.rid,
      text: this.text,
      type: this.type,
      domain: this.domain,
      source: this.source,
      importance: this.importance,
      certainty: this.certainty,
      created_at: this.created_at,
      updated_at: this.updated_at,
      event_time: this.event_time,
      half_life: this.half_life,
      access_count: this.access_count,
      namespace: this.namespace,
      consolidation_status: this.consolidation_status,
      consolidated_into: this.consolidated_into,
      tombstone_reason: this.tombstone_reason,
      metadata: this.metadata,
      metadata_json: this.metadata_json,
      entities: this.entities,
      claims: this.claims,
      consolidation_sources: this.consolidation_sources,
    };
  }
}
