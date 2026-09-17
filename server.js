import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBackend, CAPABILITIES, YantrikError } from './src/backend/index.js';
import { createSeedData } from './seed-data.js';
import { YantrikRealityModel, getAvailableActionSpace } from './src/domain/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Default in-memory seed data for embedded mode
const seedData = createSeedData();
const backend = createBackend({ dataStore: seedData });

// Epistemic Reality Model Projection Instance (Reconstructible from authoritative backend)
const realityModel = new YantrikRealityModel({
  backendMode: backend.mode,
  serverUrl: backend.serverUrl || null,
  dbPath: backend.dbPath || null,
  capabilities: CAPABILITIES[backend.mode] || CAPABILITIES.embedded,
  isAdmin: Boolean(seedData.settings.admin_mode),
});

// Error handling middleware helper
function handleBackendError(err, res) {
  if (err instanceof YantrikError) {
    return res.status(err.status).json(err.toJSON());
  }
  console.error('Unexpected server error:', err);
  return res.status(500).json({
    error: 'internal_error',
    message: err.message || 'An unexpected error occurred',
  });
}

// 0. Capabilities Endpoint
app.get('/api/capabilities', (req, res) => {
  res.json({
    mode: backend.mode,
    capabilities: CAPABILITIES[backend.mode] || CAPABILITIES.embedded,
    version: '0.3.0',
    upstream: {
      engine: '0.23.0',
      server: '0.19.0',
    },
  });
});

// 0b. Authoritative Action Space & Epistemic Reality Model Endpoint
app.get('/api/reality', async (req, res) => {
  try {
    const health = await backend.getHealth();
    realityModel.isAdmin = Boolean(seedData.settings.admin_mode);
    realityModel.projectHealth(health);
    const snapshot = realityModel.getProjectionSnapshot();
    res.json(snapshot);
  } catch (err) {
    handleBackendError(err, res);
  }
});

app.get('/api/actions', (req, res) => {
  const actions = getAvailableActionSpace({
    capabilities: CAPABILITIES[backend.mode] || CAPABILITIES.embedded,
    isAdmin: Boolean(seedData.settings.admin_mode),
    mode: backend.mode,
  });
  res.json({
    backend_mode: backend.mode,
    admin_mode: Boolean(seedData.settings.admin_mode),
    cluster_seq: realityModel.lastObservedSeq,
    actions,
  });
});

// 1. Health Endpoint
app.get('/api/health', async (req, res) => {
  try {
    const health = await backend.getHealth();
    realityModel.projectHealth(health);
    res.json(health);
  } catch (err) {
    handleBackendError(err, res);
  }
});

// 2. Settings Endpoints
app.get('/api/settings', (req, res) => {
  res.json(seedData.settings);
});

app.post('/api/settings', (req, res) => {
  const body = req.body || {};
  if (body.admin_mode !== undefined) {
    seedData.settings.admin_mode = Boolean(body.admin_mode);
    realityModel.isAdmin = seedData.settings.admin_mode;
  }
  if (body.top_k !== undefined) {
    seedData.settings.yantrikdb.top_k = Math.max(1, Math.min(50, Number(body.top_k)));
  }
  if (body.owner_scoping !== undefined) {
    seedData.settings.yantrikdb.owner_scoping = Boolean(body.owner_scoping);
  }
  if (body.include_base_namespace_recall !== undefined) {
    seedData.settings.yantrikdb.include_base_namespace_recall = Boolean(body.include_base_namespace_recall);
  }
  if (body.include_legacy_actor_namespace_recall !== undefined) {
    seedData.settings.yantrikdb.include_legacy_actor_namespace_recall = Boolean(body.include_legacy_actor_namespace_recall);
  }
  res.json({ ok: true, settings: seedData.settings });
});

// 3. Auth Endpoints
app.get('/api/auth/status', (req, res) => {
  res.json({
    admin_mode: seedData.settings.admin_mode,
    admin_enabled: true,
    password_enabled: false,
    authenticated: true,
    session_user: 'operator',
  });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ ok: true, session_user: 'operator' });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ ok: true });
});

// 4. Stats Endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const ns = req.query.namespace || 'hermes:hermes:default';
    const stats = await backend.getStats(ns);
    realityModel.projectStats(stats, ns);
    res.json(stats);
  } catch (err) {
    handleBackendError(err, res);
  }
});

// 5. Memories List & Filtering (Keyset & Offset Support)
app.get('/api/memories', async (req, res) => {
  try {
    const result = await backend.getMemories({
      namespace: req.query.namespace || 'hermes:hermes:default',
      status: req.query.status || 'active',
      domain: req.query.domain || '',
      source: req.query.source || '',
      memory_type: req.query.memory_type || '',
      q: req.query.q || '',
      limit: Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50)),
      offset: Math.max(0, parseInt(req.query.offset, 10) || 0),
      sort: req.query.sort || 'created_at',
      after: req.query.after || '',
      min_seq: req.query.min_seq ? Number(req.query.min_seq) : null,
    });
    
    // Project epistemics and ranking decay
    const enrichedItems = realityModel.projectMemoryList(result.items || []);
    res.json({
      ...result,
      items: enrichedItems,
    });
  } catch (err) {
    handleBackendError(err, res);
  }
});

// 6. Memory Detail & Actions
app.get('/api/memory/:rid', async (req, res) => {
  try {
    const memory = await backend.getMemory(req.params.rid, {
      min_seq: req.query.min_seq ? Number(req.query.min_seq) : null,
    });
    if (!memory) {
      return res.status(404).json({ error: 'not_found', message: 'Memory not found' });
    }
    const enriched = realityModel.projectMemoryList([memory])[0];
    res.json(enriched);
  } catch (err) {
    handleBackendError(err, res);
  }
});

app.post('/api/memory/:rid/forget', async (req, res) => {
  // Admin Mode Guard
  if (!seedData.settings.admin_mode) {
    return res.status(403).json({
      error: 'admin_mode_required',
      message: 'Admin Mode must be enabled to forget memories',
    });
  }
  try {
    const priorSeq = realityModel.lastObservedSeq;
    const reason = req.body?.reason || 'Operator request via dashboard';
    const result = await backend.forgetMemory(req.params.rid, { reason });
    
    // Causal chain mutation audit recording
    realityModel.recordMutation({
      actionId: 'forget_memory',
      actionName: 'Tombstone Memory Record',
      initiatedBy: 'operator',
      authority: 'admin',
      requestPayload: { rid: req.params.rid, reason },
      resultPayload: result,
      priorSeq,
      resultingSeq: result.cluster_seq,
      affectedRids: [req.params.rid],
      outcomeSummary: `Memory ${req.params.rid} tombstoned. Reason: "${reason}". Monotonic sequence advanced to ${result.cluster_seq}.`,
    });

    res.json(result);
  } catch (err) {
    handleBackendError(err, res);
  }
});

// 7. Recall Debugger (Supports event-time & certainty scores)
app.post('/api/recall', async (req, res) => {
  const { query, namespace = 'hermes:hermes:default', top_k = 10, domain, source, include_consolidated, certainty_threshold } = req.body || {};
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'invalid_request', message: 'Query is required' });
  }

  try {
    const result = await backend.recall({
      query,
      namespace,
      top_k,
      domain,
      source,
      include_consolidated,
      certainty_threshold,
    });
    if (result.cluster_seq) {
      realityModel.advanceSequence(result.cluster_seq, 'recall');
    }
    res.json(result);
  } catch (err) {
    handleBackendError(err, res);
  }
});

// 8. 3D Constellation & Graph Visualiser
app.get('/api/constellation', async (req, res) => {
  try {
    const ns = req.query.namespace || 'hermes:hermes:default';
    const limit = Math.min(600, Math.max(40, parseInt(req.query.limit, 10) || 240));

    const memRes = await backend.getMemories({
      namespace: ns,
      status: 'active',
      limit: Math.min(limit, 150),
    });

    const memories = memRes.items || [];
    const nodesByKey = {};
    const edges = [];
    let nodeIdCounter = 1;
    let edgeIdCounter = 1;

    function scopeLabel(value = '') {
      const val = String(value || 'unknown');
      if (val.includes(':owner:')) return 'owner:' + val.split(':owner:').pop();
      return val.includes(':') ? val.split(':').pop() : val;
    }

    function touchNode(label, kind = 'entity', weight = 1.0, category = 'Other', rid = '', preview = '', scope = '') {
      const cleanLabel = String(label || 'unknown').trim().slice(0, 80);
      const key = `${kind}::${cleanLabel}`;
      if (!nodesByKey[key]) {
        nodesByKey[key] = {
          id: `n${nodeIdCounter++}`,
          label: cleanLabel,
          kind,
          category,
          namespace: scope || null,
          scope_label: scope ? scopeLabel(scope) : null,
          weight: 0.0,
          count: 0,
          memory_id: rid,
          preview,
        };
      }
      const node = nodesByKey[key];
      node.weight = Number((node.weight + Math.max(0.1, weight)).toFixed(3));
      node.count += 1;
      return node;
    }

    for (const m of memories) {
      const text = m.text || '';
      const rid = m.rid || '';
      const scope = m.namespace || ns;
      const category = m.domain || 'Memory';

      const mNode = touchNode(`memory:${rid.slice(0, 8)}…`, 'memory', (m.importance || 0.5) * 1.8, category, rid, text, scope);
      mNode.event_time = m.event_time || m.created_at;

      const words = text
        .replace(/[^a-zA-Z0-9_\-\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 5 && !['should', 'dashboard', 'memory', 'hermes'].includes(w.toLowerCase()))
        .slice(0, 3);

      for (const w of words) {
        const entNode = touchNode(w, 'entity', 1.0, 'Concept', '', '', scope);
        edges.push({
          id: `e${edgeIdCounter++}`,
          source: mNode.id,
          target: entNode.id,
          rel_type: 'mentions',
          weight: 0.7,
        });
      }
    }

    res.json({
      namespace: ns,
      cluster_seq: realityModel.lastObservedSeq,
      nodes: Object.values(nodesByKey),
      edges,
    });
  } catch (err) {
    handleBackendError(err, res);
  }
});

// 9. Contradictions & Conflicts
app.get('/api/conflicts', async (req, res) => {
  try {
    const conflicts = await backend.getConflicts(req.query.status);
    res.json(conflicts);
  } catch (err) {
    handleBackendError(err, res);
  }
});

app.get('/api/conflicts/:id', async (req, res) => {
  try {
    const c = await backend.getConflict(req.params.id);
    if (!c) return res.status(404).json({ error: 'not_found', message: 'Conflict not found' });
    res.json(c);
  } catch (err) {
    handleBackendError(err, res);
  }
});

app.post('/api/conflicts/:id/resolve', async (req, res) => {
  // Admin Mode Guard
  if (!seedData.settings.admin_mode) {
    return res.status(403).json({
      error: 'admin_mode_required',
      message: 'Admin Mode must be enabled to resolve contradictions',
    });
  }
  try {
    const priorSeq = realityModel.lastObservedSeq;
    const result = await backend.resolveConflict(req.params.id, req.body || {});
    if (!result) return res.status(404).json({ error: 'not_found', message: 'Conflict not found' });

    // Record causal mutation
    realityModel.recordMutation({
      actionId: 'conflict_resolution',
      actionName: 'Resolve Contradiction Claim',
      initiatedBy: 'operator',
      authority: 'admin',
      requestPayload: req.body || {},
      resultPayload: result,
      priorSeq,
      resultingSeq: result.cluster_seq,
      affectedRids: [result.result?.winner_rid, result.result?.memory_a, result.result?.memory_b].filter(Boolean),
      outcomeSummary: `Conflict ${req.params.id} resolved via strategy '${req.body?.strategy || 'override'}'. Winner: ${result.result?.winner_rid || 'selected'}. Monotonic sequence advanced to ${result.cluster_seq}.`,
    });

    res.json(result);
  } catch (err) {
    handleBackendError(err, res);
  }
});

// 10. Entity & Knowledge Graph (with capability check & 501 fallback)
app.get('/api/entities', async (req, res) => {
  try {
    const result = await backend.getEntities(req.query.q);
    res.json(result);
  } catch (err) {
    handleBackendError(err, res);
  }
});

app.get('/api/graph/:entity', async (req, res) => {
  try {
    const result = await backend.getGraph(req.params.entity);
    res.json(result);
  } catch (err) {
    handleBackendError(err, res);
  }
});

// 11. Patterns & Lifecycle
app.get('/api/patterns', async (req, res) => {
  try {
    const result = await backend.getPatterns();
    res.json(result);
  } catch (err) {
    handleBackendError(err, res);
  }
});

app.get('/api/triggers', async (req, res) => {
  try {
    const result = await backend.getTriggers();
    res.json(result);
  } catch (err) {
    handleBackendError(err, res);
  }
});

app.post('/api/triggers/:id/acknowledge', (req, res) => {
  const t = seedData.triggers.find(x => x.trigger_id === req.params.id);
  if (t) t.status = 'acknowledged';
  res.json({ ok: true, trigger_id: req.params.id, acknowledged: true });
});

app.post('/api/triggers/:id/dismiss', (req, res) => {
  const t = seedData.triggers.find(x => x.trigger_id === req.params.id);
  if (t) t.status = 'dismissed';
  res.json({ ok: true, trigger_id: req.params.id, dismissed: true });
});

app.post('/api/triggers/:id/act', (req, res) => {
  const t = seedData.triggers.find(x => x.trigger_id === req.params.id);
  if (t) t.status = 'acted';
  res.json({ ok: true, trigger_id: req.params.id, acted: true });
});

app.get('/api/stale', async (req, res) => {
  try {
    const result = await backend.getStale(Number(req.query.days || 30));
    res.json(result);
  } catch (err) {
    handleBackendError(err, res);
  }
});

app.get('/api/upcoming', async (req, res) => {
  try {
    const result = await backend.getUpcoming(Number(req.query.days || 7));
    res.json(result);
  } catch (err) {
    handleBackendError(err, res);
  }
});

app.get('/api/sessions', async (req, res) => {
  try {
    const result = await backend.getSessions();
    res.json(result);
  } catch (err) {
    handleBackendError(err, res);
  }
});

// 12. Learned Skills & Skill Recall
app.get('/api/recent-skills', (req, res) => {
  res.json({
    items: seedData.recentSkills,
    path: '/home/user/.hermes/recent-skills.json',
    surface_enabled: true,
  });
});

app.get('/api/skill-recall/status', (req, res) => {
  res.json({
    installed: true,
    mode: backend.mode,
    db_path: seedData.settings.db_path,
    namespace: 'hermes',
    skills_enabled: true,
    skill_tools_exposed: true,
    tool_names: ['skill_search', 'skill_attach', 'skill_record_outcome'],
    available_tool_names: ['skill_search', 'skill_attach', 'skill_record_outcome'],
    auto_skill_attach: true,
    auto_skill_min_score: 0.65,
    auto_skill_max_bodies: 3,
    surface_recent_skills: true,
    top_k: 5,
    recent_skills_path: '/home/user/.hermes/recent-skills.json',
    recent_skills_count: seedData.recentSkills.length,
    skill_namespace: 'skill_substrate',
    outcome_namespace: 'outcome_substrate',
    warning: null,
  });
});

app.post('/api/skill-recall/search', (req, res) => {
  const { query, top_k = 5 } = req.body || {};
  const q = (query || '').toLowerCase();
  const matched = seedData.recentSkills
    .filter(s => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    .map(s => ({ ...s, score: 0.88 }))
    .slice(0, top_k);
  res.json({ items: matched, total: matched.length, raw_total: matched.length });
});

app.get('/api/skill-recall/:id/outcomes', (req, res) => {
  const skill_id = req.params.id;
  res.json({
    items: [
      { rid: 'out-001', text: `Skill invocation outcome for ${skill_id}: completed task with zero error`, metadata_json: { skill_id, succeeded: true }, created_at: Date.now() / 1000 - 3600 },
      { rid: 'out-002', text: `Skill evaluation for ${skill_id}: response matched target schema`, metadata_json: { skill_id, succeeded: true }, created_at: Date.now() / 1000 - 7200 },
    ],
    total: 2,
    successes: 2,
    failures: 0,
    skill_id,
  });
});

// 13. Hygiene & Maintenance
app.get('/api/recall-feedback', (req, res) => {
  const items = seedData.recallFeedback;
  const total_surfaced = items.reduce((a, b) => a + b.surfaced, 0);
  const total_reinforced = items.reduce((a, b) => a + b.reinforced, 0);
  const low_count = items.filter(x => x.low_usefulness).length;

  res.json({
    path: '/home/user/.hermes/recall-feedback.json',
    summary: {
      tracked: items.length,
      surfaced: total_surfaced,
      reinforced: total_reinforced,
      low_usefulness: low_count,
    },
    items,
  });
});

app.get('/api/hygiene', async (req, res) => {
  try {
    const ns = req.query.namespace || 'hermes:hermes:default';
    const confRes = await backend.getConflicts('open');
    const openConflicts = confRes.items || [];
    const lowUsefulness = seedData.recallFeedback.filter(x => x.low_usefulness);

    const memRes = await backend.getMemories({ namespace: ns, limit: 1000, status: 'all' });
    const memories = memRes.items || [];

    const active = memories.filter(m => m.consolidation_status === 'active').length;
    const consolidated = memories.filter(m => m.consolidation_status === 'consolidated').length;
    const tombstoned = memories.filter(m => m.consolidation_status === 'tombstoned').length;

    res.json({
      namespace: ns,
      summary: {
        active_memories: active,
        consolidated_memories: consolidated,
        tombstoned_memories: tombstoned,
        open_conflicts: openConflicts.length,
        low_usefulness: lowUsefulness.length,
      },
      engine: {
        active_memories: active,
        consolidated_memories: consolidated,
        tombstoned_memories: tombstoned,
      },
      open_conflicts: openConflicts,
      low_usefulness_candidates: lowUsefulness,
      feedback: {
        tracked: seedData.recallFeedback.length,
        surfaced: seedData.recallFeedback.reduce((a, b) => a + b.surfaced, 0),
        reinforced: seedData.recallFeedback.reduce((a, b) => a + b.reinforced, 0),
        low_usefulness: lowUsefulness.length,
      },
      recommended_actions: [
        openConflicts.length > 0 ? 'Review open contradictions before resolving or forgetting memories.' : 'No open contradictions surfaced.',
        lowUsefulness.length > 0 ? 'Review low-usefulness candidates; forget only confirmed stale or redundant rids.' : 'No low-usefulness recall candidates surfaced.',
      ],
    });
  } catch (err) {
    handleBackendError(err, res);
  }
});

app.post('/api/hygiene', async (req, res) => {
  // Admin Mode Guard
  if (!seedData.settings.admin_mode) {
    return res.status(403).json({
      error: 'admin_mode_required',
      message: 'Admin Mode must be enabled for hygiene cleanup',
    });
  }
  const { namespace = 'hermes:hermes:default', consolidate, forget_rids = [] } = req.body || {};
  const priorSeq = realityModel.lastObservedSeq;
  const forgotten = [];
  for (const rid of forget_rids) {
    const result = await backend.forgetMemory(rid, { reason: 'Hygiene pass' });
    forgotten.push(result);
  }

  const latestSeq = forgotten.length > 0 ? forgotten[forgotten.length - 1].cluster_seq : priorSeq;
  realityModel.recordMutation({
    actionId: 'hygiene_cleanup',
    actionName: 'Bulk Memory Hygiene Pass',
    initiatedBy: 'operator',
    authority: 'admin',
    requestPayload: { namespace, consolidate, forget_rids },
    resultPayload: { forgotten_count: forgotten.length, consolidate },
    priorSeq,
    resultingSeq: latestSeq,
    affectedRids: forget_rids,
    outcomeSummary: `Hygiene cleanup performed: ${forgotten.length} memories tombstoned in scope ${namespace}. Monotonic sequence: ${latestSeq}.`,
  });

  res.json({
    namespace,
    consolidation: consolidate ? { ok: true, result: 'Consolidation pass executed' } : null,
    forgotten,
  });
});

app.post('/api/think', async (req, res) => {
  // Admin Mode Guard
  if (!seedData.settings.admin_mode) {
    return res.status(403).json({
      error: 'admin_mode_required',
      message: 'Admin Mode must be enabled to trigger think pass',
    });
  }
  try {
    const priorSeq = realityModel.lastObservedSeq;
    const result = await backend.think(req.body || {});
    
    realityModel.recordMutation({
      actionId: 'think_maintenance',
      actionName: 'Execute Cognitive Maintenance Pass',
      initiatedBy: 'operator',
      authority: 'admin',
      requestPayload: req.body || {},
      resultPayload: result,
      priorSeq,
      resultingSeq: result.cluster_seq,
      affectedRids: [],
      outcomeSummary: `Think pass finished. Dry run: ${Boolean(req.body?.dry_run)}. Scanned ${result.result?.scanned_conflicts ?? 0} conflicts. Monotonic sequence: ${result.cluster_seq}.`,
    });

    res.json(result);
  } catch (err) {
    handleBackendError(err, res);
  }
});

// 14. Identity & Scope
app.get('/api/identity-scope', async (req, res) => {
  try {
    const scope = await backend.getIdentityScope();
    res.json(scope);
  } catch (err) {
    handleBackendError(err, res);
  }
});

app.post('/api/identity-scope', async (req, res) => {
  // Admin Mode Guard
  if (!seedData.settings.admin_mode) {
    return res.status(403).json({
      error: 'admin_mode_required',
      message: 'Admin Mode must be enabled to update Identity & Scope',
    });
  }
  try {
    const result = await backend.saveIdentityScope(req.body?.identity_scope);
    realityModel.recordMutation({
      actionId: 'identity_scope_mapping',
      actionName: 'Identity Scope Configuration',
      initiatedBy: 'operator',
      authority: 'admin',
      requestPayload: req.body || {},
      resultPayload: result,
      priorSeq: realityModel.lastObservedSeq,
      resultingSeq: realityModel.lastObservedSeq,
      affectedRids: [],
      outcomeSummary: 'Identity Scope mapping updated for namespaces.',
    });
    res.json(result);
  } catch (err) {
    handleBackendError(err, res);
  }
});

// 15. Streaming Export Memories JSONL (Chunked / Non-buffering)
app.get('/api/export/memories.jsonl', async (req, res) => {
  const ns = req.query.namespace || '__all__';
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Content-Disposition', 'attachment; filename=yantrikdb-memories.jsonl');

  let offset = 0;
  const limit = 50;
  let hasMore = true;

  try {
    while (hasMore) {
      const page = await backend.getMemories({
        namespace: ns,
        status: req.query.status || 'active',
        limit,
        offset,
      });
      const items = page.items || [];
      for (const item of items) {
        res.write(JSON.stringify(item) + '\n');
      }
      offset += items.length;
      hasMore = Boolean(page.has_more && items.length > 0);
      if (items.length === 0) break;
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      handleBackendError(err, res);
    } else {
      res.end();
    }
  }
});

// Serve static assets from /static
app.use('/static', express.static(path.join(__dirname, 'static')));

// Serve index.html on root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// Fallback for SPA routing if needed
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'static', 'index.html'));
  }
  next();
});

app.listen(PORT, HOST, () => {
  console.log(`YantrikDB for Hermes dashboard v0.3.0 running at http://${HOST}:${PORT}`);
});
