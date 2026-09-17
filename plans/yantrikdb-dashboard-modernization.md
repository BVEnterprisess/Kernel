# Modernization Plan: YantrikDB Hermes Dashboard

**Version Target:** 0.3.0  
**Upstream Engine:** YantrikDB 0.23.0  
**Upstream Server:** YantrikDB Server 0.19.0  

## Phase 1: Backend Architecture & Upstream HTTP Adapter
- Create modular backend structure:
  - `src/backend/interface.js`: Common interface definition for dashboard backends.
  - `src/backend/sqlite.js`: Embedded SQLite mode implementation.
  - `src/backend/http.js`: Current `yantrikdb-server` (v0.19.0) client with `min_seq`, keyset cursor pagination, centralized error envelope normalization, and explicit 501 capability reporting.
  - `src/backend/index.js`: Factory returning the active backend based on configuration.
- Wire `server.js` to dispatch through the active backend.
- Ensure all mutations (`forget`, `conflict resolution`, `think`) check Admin Mode.

## Phase 2: Schema & Data Model Modernization
- Update memory model to support:
  - `event_time` / `event_time_start` / `event_time_end`
  - `certainty`, `importance`, `decay_rate`, `embedding_dim`, `embedding_bytes`
  - `scores`: `similarity`, `recency`, `relevance`, `contributions`
  - `fallback: "fts5_keyword"` indication on recall
  - Keyset cursor metadata (`next_cursor`, `has_more`, `cluster_seq`)
- Streaming NDJSON/JSONL export implementation with cursor iteration to avoid unbounded memory buffer.

## Phase 3: Capabilities & Explicit Mode Reporting
- Expose `/api/capabilities` endpoint reporting available features by backend mode (`embedded` vs `http`).
- In HTTP mode, return HTTP 501 for unexposed endpoints (`/api/entities`, `/api/graph/:entity`, `/api/patterns`, `/api/triggers`, `/api/stale`, `/api/upcoming`, `/api/sessions`) with clear JSON response:
  ```json
  {
    "error": "feature_unsupported_by_upstream_server",
    "feature": "entity_graph",
    "reason": "Entity graph queries are not exposed in yantrikdb-server HTTP mode yet",
    "upstream_reference": "https://github.com/yantrikos/yantrikdb-server/issues/39",
    "mode": "http"
  }
  ```

## Phase 4: Frontend UI Updates & Security Hardening
- Audit `static/app.js` and `static/index.html` for XSS safety (`esc()` on all untrusted text).
- Add support in `static/app.js` for:
  - Showing event-time timestamps and score contribution breakdowns.
  - Handling cursor pagination alongside offset pagination.
  - Showing helpful capability banners when an operator navigates to an endpoint that is unsupported in HTTP mode.
- Update version references across all files to `0.3.0`.

## Phase 5: Automated Verification & Contract Test Suite
- Write comprehensive test suite in `tests/contract.test.js`:
  - Health endpoint verification.
  - Stats endpoint verification.
  - Memories listing with filters, pagination, and `min_seq`.
  - Memory point-read with RYW (`min_seq`) consistency.
  - Recall with explanation scores and event-time fields.
  - Conflicts listing and Admin Mode resolution.
  - Identity & Scope authoritative mapping.
  - Large export streaming.
  - Capability matrix test (SQLite vs HTTP mode).
  - Error normalization test.
  - XSS escaping test.
- Run tests and verify full compilation.
