// Seed data for YantrikDB for Hermes dashboard
export function createSeedData() {
  const now = Math.floor(Date.now() / 1000);

  const namespaces = [
    'hermes:hermes:default:owner:owner-yc-fba6a927a29b',
    'hermes:hermes:default',
    'hermes:hermes:default:owner:group-household-8f7c2e4a1c09',
    'hermes:hermes:default:owner:whatsapp-6590000000-7ca11f3b2d88',
  ];

  const domains = [
    'memory',
    'dashboard',
    'privacy',
    'automation',
    'family',
    'business',
    'home',
    'health',
  ];

  const snippets = [
    'YantrikDB dashboard should keep memory scope visible, compact, and safe on mobile.',
    'Identity & Scope explains which owner bucket each memory namespace belongs to.',
    'Visualiser controls work best as compact action grids with 3D constellation view.',
    'Local-only WhatsApp memory content must stay on the private machine and never leave the LAN.',
    'Dashboard settings should pair human labels with quiet raw config keys for operator trust.',
    'Recall debugger should show why a memory was retrieved and which namespace it came from.',
    'Namespace coverage cards avoid table overflow and keep status pills readable on phones.',
    'Lifecycle review highlights stale memories, reminders, patterns, and maintenance actions.',
    'Hermes plugin installs should use managed commands, with manual clone as a dev fallback.',
    'Visualiser legends must match the actual runtime colours for entity, memory, and link nodes.',
    'Public screenshots must use synthetic mock data, not private memory content.',
    'Dashboard polish reserves red for destructive or critical states, not normal active memory.',
    'Self-tuning recall boosts memories reinforced through user feedback and interaction.',
    'Surface hygiene alerts prompt the operator before stale or low-utility memories clutter the index.',
    'Constellation viewer groups memories by semantic cluster: People, Memory, Hermes, Home, Work.',
    'Entity graph links detected entities to memories, claims, and relational knowledge paths.',
  ];

  const memories = [];
  for (let i = 0; i < 96; i++) {
    const ns = namespaces[i % namespaces.length];
    const domain = domains[i % domains.length];
    const status = i % 13 === 0 ? 'consolidated' : (i % 29 === 0 ? 'tombstoned' : 'active');
    const text = `${snippets[i % snippets.length]} Note #${i + 1}: ${domain} operations use readable cards, source badges, and provenance.`;
    const rid = `mem-${String(i + 1).padStart(3, '0')}`;
    const created = now - i * 7200;
    const importance = Number((0.55 + (i % 9) * 0.045).toFixed(3));
    const access_count = i % 17;
    const certainty = Number((0.72 + (i % 5) * 0.045).toFixed(3));
    const source = ['user', 'system', 'dashboard', 'import'][i % 4];
    const type = i % 3 === 0 ? 'episodic' : 'semantic';

    memories.push({
      rid,
      type,
      text,
      created_at: created,
      updated_at: created + 60,
      importance,
      half_life: 604800,
      last_access: created + 300,
      access_count,
      valence: 0,
      consolidated_into: status === 'consolidated' ? `mem-${String(Math.max(1, i - 1)).padStart(3, '0')}` : null,
      consolidation_status: status,
      storage_tier: 'hot',
      metadata: JSON.stringify({ topic: domain, index: i + 1, synthesized: true }),
      metadata_json: { topic: domain, index: i + 1, synthesized: true },
      namespace: ns,
      certainty,
      domain,
      source,
      emotional_state: null,
      session_id: `session-${(i % 6) + 1}`,
      due_at: i % 10 === 0 ? now + 86400 * (i % 5 + 1) : null,
      temporal_kind: i % 10 === 0 ? 'task' : null,
      tombstone_reason: status === 'tombstoned' ? 'superseded by newer memory' : null,
      embedding_model: 'potion-base-32M',
      embedding_bytes: 1536,
    });
  }

  const entities = [
    { name: 'YantrikDB', entity_type: 'system', mention_count: 36, first_seen: now - 90000, last_seen: now },
    { name: 'Hermes', entity_type: 'agent', mention_count: 42, first_seen: now - 90000, last_seen: now },
    { name: 'Memory Scope', entity_type: 'concept', mention_count: 24, first_seen: now - 85000, last_seen: now - 2000 },
    { name: 'Identity Map', entity_type: 'config', mention_count: 18, first_seen: now - 80000, last_seen: now - 5000 },
    { name: 'Visualiser', entity_type: 'feature', mention_count: 28, first_seen: now - 75000, last_seen: now - 1000 },
    { name: 'Dashboard', entity_type: 'product', mention_count: 30, first_seen: now - 70000, last_seen: now - 500 },
    { name: 'Self-Tuning Recall', entity_type: 'algorithm', mention_count: 15, first_seen: now - 60000, last_seen: now - 3000 },
    { name: 'Hygiene Scanner', entity_type: 'utility', mention_count: 12, first_seen: now - 50000, last_seen: now - 4000 },
  ];

  const claims = [
    { claim_id: 'claim-001', src: 'YantrikDB', dst: 'Hermes', rel_type: 'powers', weight: 0.95, created_at: now - 50000, source_memory_rid: 'mem-001', namespace: 'hermes:hermes:default' },
    { claim_id: 'claim-002', src: 'Memory Scope', dst: 'Dashboard', rel_type: 'protects', weight: 0.88, created_at: now - 45000, source_memory_rid: 'mem-002', namespace: 'hermes:hermes:default' },
    { claim_id: 'claim-003', src: 'Identity Map', dst: 'Memory Scope', rel_type: 'routes', weight: 0.92, created_at: now - 40000, source_memory_rid: 'mem-003', namespace: 'hermes:hermes:default' },
    { claim_id: 'claim-004', src: 'Visualiser', dst: 'YantrikDB', rel_type: 'summarises', weight: 0.85, created_at: now - 35000, source_memory_rid: 'mem-004', namespace: 'hermes:hermes:default' },
    { claim_id: 'claim-005', src: 'Dashboard', dst: 'Hermes', rel_type: 'inspects', weight: 0.90, created_at: now - 30000, source_memory_rid: 'mem-005', namespace: 'hermes:hermes:default' },
    { claim_id: 'claim-006', src: 'Self-Tuning Recall', dst: 'YantrikDB', rel_type: 'optimises', weight: 0.82, created_at: now - 25000, source_memory_rid: 'mem-006', namespace: 'hermes:hermes:default' },
  ];

  const conflicts = [
    {
      conflict_id: 'conflict-001',
      conflict_type: 'preference',
      priority: 'high',
      status: 'open',
      memory_a: 'mem-001',
      memory_b: 'mem-002',
      entity: 'Dashboard',
      rel_type: 'prefers',
      detected_at: now - 8000,
      detected_by: 'contradiction_scanner',
      detection_reason: 'Contradictory UI density preferences detected between user and agent notes',
      resolved_at: null,
      resolved_by: null,
      strategy: null,
      winner_rid: null,
      resolution_note: null,
      origin_actor: 'whatsapp:6590000000',
    },
    {
      conflict_id: 'conflict-002',
      conflict_type: 'temporal',
      priority: 'medium',
      status: 'open',
      memory_a: 'mem-010',
      memory_b: 'mem-012',
      entity: 'Home Assistant',
      rel_type: 'scheduled',
      detected_at: now - 18000,
      detected_by: 'temporal_scanner',
      detection_reason: 'Different due timestamps specified for the same weekly maintenance event',
      resolved_at: null,
      resolved_by: null,
      strategy: null,
      winner_rid: null,
      resolution_note: null,
      origin_actor: 'whatsapp:6591111111',
    },
  ];

  const patterns = [
    {
      pattern_id: 'pat-001',
      description: 'Frequent morning queries regarding daily schedule and family calendar sync',
      confidence: 0.94,
      support_count: 28,
      created_at: now - 86400 * 3,
      domain: 'automation',
    },
    {
      pattern_id: 'pat-002',
      description: 'High correlation between technical repository notes and prompt engineering recall',
      confidence: 0.87,
      support_count: 19,
      created_at: now - 86400 * 5,
      domain: 'business',
    },
  ];

  const triggers = [
    {
      trigger_id: 'trig-001',
      trigger_type: 'maintenance',
      urgency: 'medium',
      reason: '4 consolidated memories have had no new references for over 30 days',
      suggested_action: 'Run consolidation verify or archive old cold-tier nodes',
      status: 'pending',
      created_at: now - 14400,
    },
    {
      trigger_id: 'trig-002',
      trigger_type: 'conflict',
      urgency: 'high',
      reason: 'Unresolved preference contradiction detected in Dashboard settings',
      suggested_action: 'Review in Contradictions tab and select winner memory',
      status: 'pending',
      created_at: now - 7200,
    },
  ];

  const recentSkills = [
    {
      skill_id: 'yantrikdb-vector-indexing',
      label: 'YantrikDB Vector Indexing',
      description: 'Optimized quantization and cosine similarity search over embedded memories',
      ts: now - 1800,
      age_seconds: 1800,
    },
    {
      skill_id: 'threejs-constellation-render',
      label: '3D Constellation Rendering',
      description: 'WebGL memory cluster visualization with orbit controls and force layout',
      ts: now - 7200,
      age_seconds: 7200,
    },
    {
      skill_id: 'hermes-identity-scoping',
      label: 'Hermes Identity & Scoping',
      description: 'Multi-tenant WhatsApp & Telegram channel partitioning and fallback resolution',
      ts: now - 14400,
      age_seconds: 14400,
    },
  ];

  const recallFeedback = [
    { rid: 'mem-001', surfaced: 12, reinforced: 11, last_ts: now - 300, low_usefulness: false, reinforcement_rate: 0.917 },
    { rid: 'mem-002', surfaced: 8, reinforced: 7, last_ts: now - 1200, low_usefulness: false, reinforcement_rate: 0.875 },
    { rid: 'mem-003', surfaced: 6, reinforced: 5, last_ts: now - 2400, low_usefulness: false, reinforcement_rate: 0.833 },
    { rid: 'mem-004', surfaced: 4, reinforced: 0, last_ts: now - 5000, low_usefulness: true, reinforcement_rate: 0.0 },
    { rid: 'mem-005', surfaced: 5, reinforced: 4, last_ts: now - 3600, low_usefulness: false, reinforcement_rate: 0.8 },
  ];

  const sessions = [
    { session_id: 'session-1', started_at: now - 3600 * 4, message_count: 18, namespace: 'hermes:hermes:default' },
    { session_id: 'session-2', started_at: now - 3600 * 12, message_count: 24, namespace: 'hermes:hermes:default:owner:owner-yc-fba6a927a29b' },
    { session_id: 'session-3', started_at: now - 3600 * 24, message_count: 12, namespace: 'hermes:hermes:default:owner:group-household-8f7c2e4a1c09' },
    { session_id: 'session-4', started_at: now - 3600 * 48, message_count: 31, namespace: 'hermes:hermes:default:owner:whatsapp-6590000000-7ca11f3b2d88' },
  ];

  const identityScope = {
    identities: [
      {
        id: 'yc',
        label: 'YC (Primary User)',
        private_scope: 'owner:yc',
        resolved_scope: 'hermes:hermes:default:owner:owner-yc-fba6a927a29b',
        source: 'configured',
      },
      {
        id: 'household',
        label: 'Household Family',
        private_scope: 'owner:household',
        resolved_scope: 'hermes:hermes:default:owner:group-household-8f7c2e4a1c09',
        source: 'configured',
      },
    ],
    actors: [
      {
        platform: 'whatsapp',
        actor_id: '6590000000',
        identity: 'yc',
        legacy_scope: 'owner:whatsapp-6590000000-7ca11f3b2d88',
        alias: 'YC Mobile',
        source: 'configured',
      },
      {
        platform: 'telegram',
        actor_id: '17847389',
        identity: 'yc',
        legacy_scope: '',
        alias: '@yc_telegram',
        source: 'configured',
      },
      {
        platform: 'whatsapp',
        actor_id: '6591111111',
        identity: 'household',
        legacy_scope: '',
        alias: 'Home Assistant',
        source: 'configured',
      },
      {
        platform: 'whatsapp',
        actor_id: '6592222222',
        identity: 'household',
        legacy_scope: '',
        alias: 'Family Gateway',
        source: 'configured',
      },
    ],
    spaces: [
      {
        id: 'household-space',
        label: 'Shared Household Space',
        scope: 'hermes:hermes:default:owner:group-household-8f7c2e4a1c09',
        source: 'configured',
      },
    ],
    conversations: [],
  };

  const settings = {
    admin_mode: true,
    admin_mode_env: true,
    admin_mode_stored: true,
    password_enabled: false,
    authenticated: true,
    settings_path: '/home/user/.hermes/dashboard_settings.json',
    db_path: '/home/user/.hermes/yantrikdb-memory.db',
    default_namespace: 'hermes:hermes:default',
    embedder: 'default',
    embedding_dim: 384,
    yantrikdb: {
      config_path: '/home/user/.hermes/yantrikdb.json',
      mode: 'embedded',
      namespace: 'hermes',
      default_namespace: 'hermes:hermes:default',
      top_k: 10,
      owner_scoping: true,
      include_base_namespace_recall: true,
      include_legacy_actor_namespace_recall: true,
      self_tuning_recall: true,
      self_tuning_max_boost: 0.15,
      surface_hygiene: true,
      hygiene_max_surfaced: 5,
      identity_map_path: '/home/user/.hermes/identity_map.json',
    },
  };

  return {
    memories,
    entities,
    claims,
    conflicts,
    patterns,
    triggers,
    recentSkills,
    recallFeedback,
    sessions,
    identityScope,
    settings,
  };
}
