/**
 * Standard backend capabilities definition
 */
export const CAPABILITIES = {
  embedded: {
    health: true,
    stats: true,
    memories_list: true,
    memory_detail: true,
    recall: true,
    conflicts_list: true,
    conflicts_resolve: true,
    think: true,
    forget: true,
    identity_scope: true,
    entities: true,
    graph: true,
    stale: true,
    upcoming: true,
    patterns: true,
    triggers: true,
    sessions: true,
    recent_skills: true,
    skill_recall: true,
    hygiene: true,
    visualiser: true,
    export_jsonl: true,
  },
  http: {
    health: true,
    stats: true,
    memories_list: true,
    memory_detail: true,
    recall: true,
    conflicts_list: true,
    conflicts_resolve: true,
    think: true,
    forget: true,
    identity_scope: true,
    entities: false, // Pending /v1/entities
    graph: false,    // Pending /v1/graph/{entity}
    stale: false,    // Pending /v1/stale
    upcoming: false, // Pending /v1/upcoming
    patterns: false, // Pending /v1/patterns
    triggers: false, // Pending /v1/triggers
    sessions: false, // Pending /v1/sessions
    recent_skills: true,
    skill_recall: true,
    hygiene: true,
    visualiser: true, // Projected from memories
    export_jsonl: true,
  },
};
