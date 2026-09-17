export const healthFixture = {
  status: 'ok',
  version: '0.23.0',
  cluster_seq: 1420,
  db_size_bytes: 4194304,
  engine_backfilling: false,
  namespaces: [
    { namespace: 'hermes:hermes:default', count: 18 },
    { namespace: 'hermes:owner:yc', count: 32 },
    { namespace: 'hermes:space:household', count: 12 },
  ],
};

export const statsFixture = {
  namespace: 'hermes:hermes:default',
  cluster_seq: 1420,
  memory_status: [
    { status: 'active', count: 15 },
    { status: 'consolidated', count: 2 },
    { status: 'tombstoned', count: 1 },
  ],
  by_domain: [
    { domain: 'preferences', count: 8 },
    { domain: 'infrastructure', count: 6 },
    { domain: 'health', count: 4 },
  ],
  by_source: [
    { source: 'conversation', count: 12 },
    { source: 'tool_output', count: 6 },
  ],
  by_type: [
    { type: 'fact', count: 10 },
    { type: 'semantic', count: 8 },
  ],
  recent_by_day: [
    { day: '2026-09-15', count: 5 },
    { day: '2026-09-16', count: 7 },
    { day: '2026-09-17', count: 6 },
  ],
  open_conflicts: 1,
  entities: 14,
  edges: 22,
};

export const memoryDetailFixture = {
  rid: 'mem-101',
  text: 'Yuan Chin prefers dark mode and keyboard navigation in dashboards',
  namespace: 'hermes:owner:yc',
  status: 'active',
  consolidation_status: 'active',
  domain: 'preferences',
  source: 'user_prompt',
  type: 'semantic',
  importance: 0.95,
  certainty: 0.98,
  access_count: 14,
  created_at: 1789640000,
  updated_at: 1789650000,
  event_time: 1789640000,
  cluster_seq: 1420,
  embedding_bytes: 1536,
  entities: [{ entity_name: 'Yuan Chin' }, { entity_name: 'Dashboard UI' }],
  claims: [{ src: 'Yuan Chin', dst: 'Dashboard UI', rel_type: 'prefers', weight: 0.95 }],
  consolidation_sources: [],
};

export const recallFixture = {
  namespace: 'hermes:owner:yc',
  cluster_seq: 1420,
  certainty_reasons: ['Recalled 1 candidate memories with scores above 0.5'],
  results: [
    {
      rid: 'mem-101',
      text: 'Yuan Chin prefers dark mode and keyboard navigation in dashboards',
      score: 0.942,
      certainty: 0.98,
      event_time_start: 1789640000,
      event_time_end: 1789640000,
      fallback: null,
      scores: {
        similarity: 0.92,
        recency: 0.96,
        relevance: 0.942,
        contributions: {
          semantic: 0.55,
          importance: 0.19,
          keyword_match: 0.202,
        },
      },
      why_retrieved: ['semantic keyword alignment', 'namespace: hermes:owner:yc'],
    },
  ],
};
