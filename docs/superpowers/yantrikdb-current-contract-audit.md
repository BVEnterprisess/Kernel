# YantrikDB Deep Contract & Architecture Audit (Pass 2)

**Baseline Date:** September 17, 2026  
**Upstream Ecosystem Target:**
- `yantrikdb` Rust Core Engine: **v0.23.0** (`yantrikdb::scoring`, `yantrikdb::ranking_decay`, `AGREEMENT_SCALE`)
- `yantrikdb-server`: **v0.19.0** (`/v1/*`, read-your-writes `min_seq`, keyset pagination, multi-tenant cognitive memory)
- `yantrikdb-hermes-plugin`: **v0.2.1**
- Dashboard Version: **v0.3.0**

---

## 1. YantrikDB Core Concepts Inventory & Mapping

| YantrikDB Concept | Engine Definition (`yantrikdb` Rust) | Server Representation (`yantrikdb-server`) | Dashboard Domain Representation | Dashboard Current Status | Action in This Pass |
|---|---|---|---|---|---|
| **Memory / Content** | Record in SQLite unified table: `rid`, `text`, `type`, `domain`, `source`, `importance`, `certainty` | DTO: `{ rid, text, type, domain, source, importance, certainty, ... }` | `YantrikMemory` domain model | Implemented | Enforce strict property contract |
| **Event Time** | `event_time`, `event_time_start`, `event_time_end` (observation/occurrence timestamp, distinct from `created_at`) | `event_time`, `event_time_start`, `event_time_end` | Temporal occurrence dimension | Partially shown | Expose prominently in drawers & search inspectors |
| **Temporal Decay** | `yantrikdb::scoring::ranking_decay(importance, created_at, ts)` with authored `half_life` | `decay_factor`, `temporal_score` | `ranking_decay` math model in domain scoring | Approximated | Implement exact engine formula with half-life & elapsed seconds |
| **Multi-Signal Relevance Scoring** | 4 distinct retrieval lanes: Vector (HNSW), Lexical (FTS5 BM25), Claims, Graph | Lane contributions + `AGREEMENT_SCALE` tie-breaker | `YantrikScoreExplanation` | Heuristic mockup | Expose real cross-lane score decomposition (`vector`, `lexical_bm25`, `claims_match`, `graph_proximity`, `temporal_decay`, `cross_lane_agreement`) |
| **Cross-Lane Agreement** | Multiplier when multiple lanes surface the same record, capped at 12.5% tie-break | `scores.cross_lane_agreement` / `agreement_multiplier` | Explicit agreement indicator & factor | Missing | Add lane agreement breakdown |
| **Retrieval Reason & Fallback** | `why_retrieved` explainability list + `fallback: "fts5_keyword"` when HNSW is degraded | `why_retrieved: string[]`, `fallback: string \| null` | Diagnostic badge & fallback alert | Basic badge | Surface degraded retrieval warning prominently |
| **Explicit Graph Relationships** | Structured claims (`src`, `dst`, `rel_type`, `weight`, `source_memory_rid`) + entity index | Direct claim links & entity co-occurrence | Diagnostic relationship inspector | Basic visual SVG | Transform into high-signal relationship & evidence tool |
| **Provenances & Evidence** | `source_memory_rid`, `detected_by`, `origin_actor`, `consolidation_sources` | Nested provenance records | First-class provenance trail in memory drawer | Nested JSON | High-signal UI inspection cards for claims & provenance |
| **Contradictions & Conflicts** | Single-valued claim collisions with `priority`, `strategy`, `winner_rid`, `detected_by` | `/v1/conflicts`, `/v1/conflicts/:id/resolve` | Authoritative governance state | Implemented | Guard with Admin Mode, preserve resolution audits |
| **Read-Your-Writes Consistency** | Cluster sequence `min_seq`, `cluster_seq` monotonic tracking | `?min_seq=N` header/query, `412 replica_behind` | `ConsistencyMetadata` | Basic propagation | Full observable sequence tracking across all requests |
| **Deterministic Keyset Traversal** | Cursor-based traversal (`after=<rid>`) ordered stably | Keyset `next_cursor` | Keyset pagination adapter | Offset prioritized | Expose cursor status and test strict non-skipping traversal |
| **Governance & Tombstones** | Destructive tombstoning (`tombstone_reason`, `consolidated_into`) | `/v1/forget`, `/v1/think` | Explicit administrative mutation | Implemented | Highlight tombstone reasons and maintain audit trail |
| **Capabilities Negotiation** | Dynamic server features (`CAPABILITIES.embedded` vs `CAPABILITIES.http`) | Route availability & HTTP 501 on unexposed features | `BackendCapabilities` | Implemented | Expand to cover exact features & expose in UI header/status |

---

## 2. Gap Analysis & Modernization Strategy

1. **Scoring Engine Realism**:
   Replace ad-hoc score estimation with a domain-level `explainRecallScore(item, query, currentTime)` conforming to `yantrikdb::scoring`:
   - `decay = Math.exp(-Math.LN2 * (now - created_at) / half_life)`
   - `semantic_similarity = cosine / HNSW lane`
   - `lexical_score = FTS5 BM25 lane`
   - `cross_lane_agreement = min(1.125, 1 + lane_count * 0.04)`
   - `final_score = (similarity * 0.5 + recency * 0.3 + importance * 0.2) * agreement`
   
2. **First-Class Provenance & Relationships**:
   In the memory detail drawer and recall inspector, expose the exact path:
   `Source/Actor -> Memory (Event Time) -> Claims Generated -> Contradictions/Consolidations`.

3. **OpenClaw Future Extraction Surface**:
   Ensure all domain types and business logic reside in pure ES modules under `/src/domain/` with zero dependency on Express, DOM, or browser state.
