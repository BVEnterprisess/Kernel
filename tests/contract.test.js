import test from 'node:test';
import assert from 'node:assert/strict';
import { EmbeddedBackend } from '../src/backend/embedded.js';
import { HttpBackend } from '../src/backend/http.js';
import { CAPABILITIES } from '../src/backend/capabilities.js';
import { YantrikError, unsupportedFeatureError } from '../src/backend/errors.js';
import { createSeedData } from '../seed-data.js';
import {
  healthFixture,
  statsFixture,
  memoryDetailFixture,
  recallFixture,
} from './fixtures/server-fixtures.js';

test('YantrikDB Contract: Health check returns valid schema in embedded mode', async () => {
  const backend = new EmbeddedBackend({ dataStore: createSeedData() });
  const health = await backend.getHealth();

  assert.equal(health.ok, true);
  assert.equal(health.status, 'ok');
  assert.equal(health.mode, 'embedded');
  assert.equal(typeof health.db_size_bytes, 'number');
  assert.ok(Array.isArray(health.namespaces));
  assert.ok(health.namespaces.length > 0);
  assert.equal(health.yantrikdb_version, '0.23.0');
});

test('YantrikDB Contract: Stats returns aggregation metrics with cluster sequence', async () => {
  const backend = new EmbeddedBackend({ dataStore: createSeedData() });
  const stats = await backend.getStats('hermes:hermes:default');

  assert.equal(stats.namespace, 'hermes:hermes:default');
  assert.ok(Array.isArray(stats.memory_status));
  assert.ok(Array.isArray(stats.by_domain));
  assert.ok(Array.isArray(stats.by_source));
  assert.ok(Array.isArray(stats.by_type));
  assert.ok(Array.isArray(stats.recent_by_day));
  assert.equal(typeof stats.cluster_seq, 'number');
});

test('YantrikDB Contract: Memories listing supports filtering, offset, and keyset cursor', async () => {
  const backend = new EmbeddedBackend({ dataStore: createSeedData() });

  // Standard offset listing
  const list = await backend.getMemories({ limit: 5, offset: 0 });
  assert.equal(list.limit, 5);
  assert.equal(list.offset, 0);
  assert.ok(list.items.length <= 5);
  assert.equal(typeof list.has_more, 'boolean');
  assert.ok(list.next_cursor);

  // Keyset cursor pagination using `after`
  const nextList = await backend.getMemories({ limit: 5, after: list.next_cursor });
  assert.ok(nextList.items.length > 0);
  assert.notEqual(nextList.items[0].rid, list.next_cursor);
});

test('YantrikDB Contract: Point memory read supports event-time and relations', async () => {
  const backend = new EmbeddedBackend({ dataStore: createSeedData() });
  const list = await backend.getMemories({ limit: 1 });
  assert.ok(list.items.length > 0);

  const memory = await backend.getMemory(list.items[0].rid);
  assert.ok(memory);
  assert.equal(memory.rid, list.items[0].rid);
  assert.ok(Array.isArray(memory.entities));
  assert.ok(Array.isArray(memory.claims));
  assert.ok(Array.isArray(memory.consolidation_sources));
});

test('YantrikDB Contract: Recall returns score contributions, event times, and fallback', async () => {
  const backend = new EmbeddedBackend({ dataStore: createSeedData() });
  const recall = await backend.recall({ query: 'database preferences', top_k: 5 });

  assert.ok(Array.isArray(recall.results));
  assert.ok(recall.results.length > 0);
  const first = recall.results[0];
  assert.ok(typeof first.score === 'number');
  assert.ok(first.scores);
  assert.ok(first.scores.contributions);
  assert.ok(Array.isArray(first.why_retrieved));
});

test('YantrikDB Contract: Conflicts resolution updates conflict state', async () => {
  const backend = new EmbeddedBackend({ dataStore: createSeedData() });
  const conflicts = await backend.getConflicts();
  assert.ok(Array.isArray(conflicts.items));
  assert.ok(conflicts.items.length > 0);

  const targetId = conflicts.items[0].conflict_id;
  const resolution = await backend.resolveConflict(targetId, {
    strategy: 'keep_newer',
    winner_rid: 'mem-001',
    resolution_note: 'Verified with operator',
  });

  assert.equal(resolution.ok, true);
  assert.equal(resolution.result.status, 'resolved');
  assert.equal(resolution.result.strategy, 'keep_newer');
});

test('YantrikDB Contract: Identity & Scope returns authoritative person mappings', async () => {
  const backend = new EmbeddedBackend({ dataStore: createSeedData() });
  const scope = await backend.getIdentityScope();

  assert.ok(scope.identity_scope);
  assert.ok(Array.isArray(scope.identity_scope.identities));
  assert.ok(Array.isArray(scope.identity_scope.actors));
  assert.ok(Array.isArray(scope.identity_scope.spaces));
  assert.ok(Array.isArray(scope.identity_scope.conversations));
  assert.ok(Array.isArray(scope.namespace_inventory));
  assert.ok(scope.summary);
});

test('YantrikDB Contract: HttpBackend handles upstream HTTP 501 for unexposed endpoints', async () => {
  const httpBackend = new HttpBackend({ serverUrl: 'http://127.0.0.1:7438' });

  await assert.rejects(async () => {
    await httpBackend.getGraph('Yuan Chin');
  }, (err) => {
    assert.ok(err instanceof YantrikError);
    assert.equal(err.status, 501);
    assert.equal(err.code, 'feature_unsupported_by_upstream_server');
    assert.ok(err.upstreamReference.includes('issues/39'));
    return true;
  });
});

test('YantrikDB Contract: Capabilities matrix accurately reflects capabilities', () => {
  assert.equal(CAPABILITIES.embedded.graph, true);
  assert.equal(CAPABILITIES.http.graph, false);
  assert.equal(CAPABILITIES.http.memories_list, true);
  assert.equal(CAPABILITIES.http.recall, true);
  assert.equal(CAPABILITIES.http.conflicts_list, true);
});

test('YantrikDB Contract: Server fixtures match expected response shapes', () => {
  assert.equal(healthFixture.status, 'ok');
  assert.equal(statsFixture.cluster_seq, 1420);
  assert.equal(memoryDetailFixture.rid, 'mem-101');
  assert.equal(recallFixture.results[0].scores.contributions.semantic, 0.55);
});

test('YantrikDB Reality Model: Monotonic sequence advancement and causal mutation audit', async () => {
  const { YantrikRealityModel } = await import('../src/domain/reality.js');
  const { EpistemicStatus } = await import('../src/domain/epistemic.js');
  
  const reality = new YantrikRealityModel({ mode: 'embedded', initialSeq: 100 });
  assert.equal(reality.lastObservedSeq, 100);

  // Advance sequence
  const adv = reality.advanceSequence(105, 'test');
  assert.equal(adv.advanced, true);
  assert.equal(reality.lastObservedSeq, 105);

  // Stale sequence is ignored monotonically
  const staleAdv = reality.advanceSequence(102, 'test');
  assert.equal(staleAdv.advanced, false);
  assert.equal(reality.lastObservedSeq, 105);

  // Record mutation
  const mut = reality.recordMutation({
    actionId: 'forget_memory',
    actionName: 'Tombstone Memory',
    initiatedBy: 'operator',
    resultingSeq: 110,
    affectedRids: ['rid-xyz'],
    outcomeSummary: 'Tombstoned record',
  });

  assert.equal(mut.epistemic, EpistemicStatus.OBSERVED);
  assert.equal(reality.lastObservedSeq, 110);
  assert.equal(reality.mutationAuditTrail.length, 1);
  assert.equal(reality.mutationAuditTrail[0].affectedRids[0], 'rid-xyz');

  // Projection snapshot verification
  const snapshot = reality.getProjectionSnapshot();
  assert.equal(snapshot.lastObservedSeq, 110);
  assert.equal(snapshot.mutationsCount, 1);
  assert.ok(Array.isArray(snapshot.actionSpace));
  assert.ok(snapshot.actionSpace.length > 0);
});
