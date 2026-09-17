import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRankingDecay,
  explainRecallScore,
  AGREEMENT_SCALE,
  DEFAULT_HALF_LIFE_SECONDS,
  YantrikMemory,
} from '../src/domain/index.js';

test('Domain Scoring: computeRankingDecay respects exponential decay and half-life', () => {
  const now = 1700000000;
  // Zero elapsed time should yield decay factor of 1.0
  const decayZero = computeRankingDecay(now, now, DEFAULT_HALF_LIFE_SECONDS);
  assert.equal(decayZero, 1.0);

  // Exactly one half-life elapsed should yield decay factor of ~0.5
  const decayHalf = computeRankingDecay(now - DEFAULT_HALF_LIFE_SECONDS, now, DEFAULT_HALF_LIFE_SECONDS);
  assert.ok(Math.abs(decayHalf - 0.5) < 0.01);

  // Two half-lives elapsed should yield decay factor of ~0.25
  const decayQuarter = computeRankingDecay(now - (2 * DEFAULT_HALF_LIFE_SECONDS), now, DEFAULT_HALF_LIFE_SECONDS);
  assert.ok(Math.abs(decayQuarter - 0.25) < 0.01);

  // Floor is bounded at 0.01
  const decayOld = computeRankingDecay(now - (100 * DEFAULT_HALF_LIFE_SECONDS), now, DEFAULT_HALF_LIFE_SECONDS);
  assert.equal(decayOld, 0.01);
});

test('Domain Scoring: explainRecallScore decomposes multi-signal contributions with AGREEMENT_SCALE', () => {
  const memory = new YantrikMemory({
    rid: 'mem-test-01',
    text: 'PostgreSQL database setup and indexing for production performance',
    created_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    importance: 0.8,
    entities: [{ entity_name: 'PostgreSQL' }],
  });

  const explanation = explainRecallScore({
    memory,
    terms: ['postgresql', 'database'],
    current_ts: Math.floor(Date.now() / 1000),
    graph_boost: 0.1,
  });

  assert.ok(explanation.final_score > 0.5);
  assert.equal(explanation.fallback, null);
  assert.ok(explanation.agreement_multiplier >= 1.0);
  assert.ok(explanation.agreement_multiplier <= 1.0 + AGREEMENT_SCALE);

  // Check contributions breakdown
  assert.ok(typeof explanation.contributions.semantic_vector === 'number');
  assert.ok(typeof explanation.contributions.lexical_bm25 === 'number');
  assert.ok(typeof explanation.contributions.temporal_decay === 'number');
  assert.ok(typeof explanation.contributions.importance_weight === 'number');
  assert.ok(typeof explanation.contributions.cross_lane_agreement === 'number');

  // Verify explainability reasons
  assert.ok(Array.isArray(explanation.why_retrieved));
  assert.ok(explanation.why_retrieved.some(r => r.includes('lexical match')));
  assert.ok(explanation.why_retrieved.some(r => r.includes('decay factor')));
});

test('Domain Scoring: explainRecallScore flags fallback when no lexical terms match', () => {
  const memory = new YantrikMemory({
    rid: 'mem-test-02',
    text: 'Baking sourdough bread in cast iron Dutch oven',
    created_at: Math.floor(Date.now() / 1000) - 86400,
  });

  const explanation = explainRecallScore({
    memory,
    terms: ['quantum', 'cryptography'],
  });

  assert.equal(explanation.fallback, 'fts5_keyword');
  assert.equal(explanation.lanes.lexical_fts5, 0);
  assert.ok(explanation.why_retrieved.some(r => r.includes('approximate vector similarity')));
});
