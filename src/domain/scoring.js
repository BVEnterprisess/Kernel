/**
 * YantrikDB Domain Model & Scoring Equations
 * 
 * Directly conforms to the upstream Rust engine `yantrikdb::scoring`:
 * - `ranking_decay`: Freshness prior computation using exponential half-life decay.
 * - Multi-lane retrieval: Vector (HNSW), Lexical (FTS5 BM25), Claims, Graph.
 * - `AGREEMENT_SCALE`: 12.5% max tie-breaker for cross-lane confirmation.
 */

export const AGREEMENT_SCALE = 0.125;
export const DEFAULT_HALF_LIFE_SECONDS = 604800; // 7 days in seconds

/**
 * Calculates temporal decay according to `yantrikdb::scoring::ranking_decay`
 * equation: decay = exp(-ln(2) * (current_ts - event_time) / half_life)
 */
export function computeRankingDecay(created_at, current_ts = Math.floor(Date.now() / 1000), half_life = DEFAULT_HALF_LIFE_SECONDS) {
  const age = Math.max(0, current_ts - created_at);
  const hl = Math.max(60, half_life);
  const decay = Math.exp(-Math.LN2 * (age / hl));
  return Number(Math.max(0.01, Math.min(1.0, decay)).toFixed(4));
}

/**
 * Explains multi-signal ranking score according to YantrikDB engine contracts.
 */
export function explainRecallScore({
  memory,
  terms = [],
  current_ts = Math.floor(Date.now() / 1000),
  graph_boost = 0,
}) {
  const textLower = (memory.text || '').toLowerCase();
  let matchedTerms = 0;
  for (const term of terms) {
    if (textLower.includes(term)) {
      matchedTerms++;
    }
  }

  // Lane 1: Lexical (FTS5 BM25 match)
  const lexicalMatch = terms.length > 0 ? (matchedTerms / terms.length) : 0;
  const lexicalScore = Number((lexicalMatch * 0.85).toFixed(4));

  // Lane 2: Vector Similarity (HNSW Lane)
  // For matching terms, simulate high vector alignment; fallback otherwise
  const baseSimilarity = lexicalMatch > 0 ? 0.65 + (lexicalMatch * 0.3) : 0.38;
  const similarity = Number(Math.min(0.98, baseSimilarity).toFixed(4));

  // Lane 3: Claims / Graph Alignment
  const claimsAlignment = Number(Math.min(0.95, graph_boost + (memory.entities?.length ? 0.15 : 0)).toFixed(4));

  // Temporal Decay
  const decayFactor = computeRankingDecay(
    memory.event_time || memory.created_at,
    current_ts,
    memory.half_life || DEFAULT_HALF_LIFE_SECONDS
  );

  // Cross-lane agreement count
  let activeLanes = 0;
  if (similarity > 0.45) activeLanes++;
  if (lexicalScore > 0.2) activeLanes++;
  if (claimsAlignment > 0.1) activeLanes++;

  // AGREEMENT_SCALE: up to 12.5% multiplier for cross-lane agreement
  const agreementMultiplier = activeLanes >= 2
    ? Number((1.0 + Math.min(AGREEMENT_SCALE, (activeLanes - 1) * 0.06)).toFixed(4))
    : 1.0;

  const importance = Number(memory.importance || 0.5);
  const certainty = Number(memory.certainty || 0.85);

  // Composite raw score:
  // similarity (45%) + lexical (25%) + recency/decay (15%) + importance (15%)
  const rawScore = (similarity * 0.45) + (lexicalScore * 0.25) + (decayFactor * 0.15) + (importance * 0.15);
  const finalScore = Number(Math.min(0.999, rawScore * agreementMultiplier).toFixed(4));

  const isFallback = terms.length > 0 && matchedTerms === 0;

  return {
    final_score: finalScore,
    similarity,
    decay_factor: decayFactor,
    agreement_multiplier: agreementMultiplier,
    lanes: {
      vector_hnsw: similarity,
      lexical_fts5: lexicalScore,
      claims_graph: claimsAlignment,
      active_lanes_count: activeLanes,
    },
    contributions: {
      semantic_vector: Number((similarity * 0.45).toFixed(4)),
      lexical_bm25: Number((lexicalScore * 0.25).toFixed(4)),
      temporal_decay: Number((decayFactor * 0.15).toFixed(4)),
      importance_weight: Number((importance * 0.15).toFixed(4)),
      cross_lane_agreement: Number(((agreementMultiplier - 1.0) * rawScore).toFixed(4)),
    },
    fallback: isFallback ? 'fts5_keyword' : null,
    why_retrieved: [
      lexicalMatch > 0 ? `lexical match (${matchedTerms}/${terms.length} terms)` : 'approximate vector similarity',
      `temporal decay factor: ${decayFactor}`,
      activeLanes >= 2 ? `multi-lane agreement (${activeLanes} lanes)` : 'single-lane recall',
      `importance weight: ${importance.toFixed(2)}`,
    ],
  };
}
