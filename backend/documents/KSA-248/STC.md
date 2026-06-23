# Software Test Cases (STC)

## FEC Code Intelligence — KSA-248: KB Contradiction Resolution

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-248 |
| Version | 1.0 |
| Date | 2026-06-09 |
| Related STP | STP-v1-KSA-248.docx |

---

## 1. Property-Based Tests (PBT)

| ID | Property | Generator | Oracle | Priority |
|----|----------|-----------|--------|----------|
| PBT-01 | Any string containing a SUPERSESSION_SIGNAL keyword is detected | Random strings with signal injected at random position | detectSignal() returns non-null | High |
| PBT-02 | Any string NOT containing any signal keyword returns null | Random strings from alphabet without signal substrings | detectSignal() returns null | High |
| PBT-03 | Confidence is always in [0.0, 1.0] | Random entry combinations (varying source, type, timestamps) | 0.0 <= computeConfidence() <= 1.0 | High |
| PBT-04 | Confidence with strong signal is always >= 0.7 | Random entries + strong signal | computeConfidence() >= 0.7 | High |
| PBT-05 | filterSuperseded never adds entries (only removes) | Random result lists with mixed statuses | filtered.size <= original.size | Medium |
| PBT-06 | Revalidated entry always has ACTIVE status | Random entry IDs after revalidate | validity_status == ACTIVE | Medium |

---

## 2. Unit Tests (UT)

### 2.1 Signal Detection

| ID | Name | Input | Expected | Priority |
|----|------|-------|----------|----------|
| UT-01 | Detect Vietnamese signal | content="Quyết định hủy bỏ feature X" | signal="hủy bỏ" | High |
| UT-02 | Detect English signal | content="This requirement is cancelled" | signal="cancelled" | High |
| UT-03 | No signal in content | content="Implement login page with OAuth" | signal=null | High |
| UT-04 | Case insensitive detection | content="DEPRECATED: use new API" | signal="deprecated" | High |

### 2.2 Confidence Scoring

| ID | Name | Input | Expected | Priority |
|----|------|-------|----------|----------|
| UT-05 | Strong signal + newer + same source + same type | signal="cancel", newer=true, sameSource=true, sameType=true | confidence=1.0 (capped) | High |
| UT-06 | Weak signal + not newer + diff source + diff type | signal="thay đổi", newer=false, sameSource=false, sameType=false | confidence=0.5 (base only) | High |
| UT-07 | Exactly at threshold | signal="sửa lại" + newer only | confidence=0.65 | High |
| UT-08 | Below threshold | signal="thay đổi" + nothing else | confidence=0.5 | High |

### 2.3 Conflict Discovery

| ID | Name | Input | Expected | Priority |
|----|------|-------|----------|----------|
| UT-09 | Find by entity overlap | Entry shares entity "UserService" with 3 existing | Returns 3 candidates | High |
| UT-10 | FTS fallback when no entities | Entry has no entities in entity_index | FTS returns similar by summary | High |
| UT-11 | Exclude SUPERSEDED from candidates | 2 ACTIVE + 1 SUPERSEDED share entity | Returns only 2 ACTIVE | High |
| UT-12 | Exclude archived from candidates | 2 ACTIVE + 1 archived share entity | Returns only 2 ACTIVE | Medium |

### 2.4 Filtering

| ID | Name | Input | Expected | Priority |
|----|------|-------|----------|----------|
| UT-13 | Filter by validity_status | Results: [ACTIVE, SUPERSEDED, ACTIVE] | Returns [ACTIVE, ACTIVE] | High |
| UT-14 | Filter by SUPERSEDES edge (active superseder) | Entry has incoming edge from ACTIVE entry | Entry filtered out | High |
| UT-15 | Chain resolution - inactive superseder | B supersedes A, C supersedes B | A NOT filtered (B is SUPERSEDED) | High |
| UT-16 | Both strategies disabled | config: all disabled | Returns original unchanged | Medium |

### 2.5 LLM Consolidation

| ID | Name | Input | Expected | Priority |
|----|------|-------|----------|----------|
| UT-17 | LLM disabled (no endpoint) | config.llmEndpoint=null | Returns original results | High |
| UT-18 | LLM returns valid IDs | Mock LLM returns "[2, 5]" | Results minus IDs 2 and 5 | High |
| UT-19 | LLM returns invalid IDs | Mock LLM returns "[99, 100]" | Original results (IDs not in set) | Medium |
| UT-20 | LLM returns unparseable response | Mock LLM returns "I cannot help" | Original results (graceful) | High |

### 2.6 Manual Operations

| ID | Name | Input | Expected | Priority |
|----|------|-------|----------|----------|
| UT-21 | Manual supersede | manualSupersede(1, 2, "wrong info") | Entry 1: SUPERSEDED, edge 2->1 exists | High |
| UT-22 | Revalidate | revalidate(1) after supersession | Entry 1: ACTIVE, superseded_by=null | High |
| UT-23 | Get stats empty DB | No resolutions done | {superseded:0, active:N, edges:0} | Low |
| UT-24 | Get stats after resolutions | 3 entries superseded, 2 edges | {superseded:3, active:N-3, edges:2} | Low |

---

## 3. Integration Tests (IT)

| ID | Name | Setup | Steps | Expected | Priority |
|----|------|-------|-------|----------|----------|
| IT-01 | Full ingest resolution flow | DB with entry A (entity "X"), insert entry B with "cancel" + entity "X" | 1. Store B. 2. detectAndResolve(B.id) | A marked SUPERSEDED, edge B->A, audit logged | High |
| IT-02 | FTS fallback resolution | DB with entry A (no entity_index), insert B with similar summary + "replaced" | 1. Store B. 2. detectAndResolve(B.id) | A found via FTS, marked SUPERSEDED | High |
| IT-03 | Below threshold no resolution | DB with entry A, insert B with weak signal "thay đổi" + different source/type | detectAndResolve(B.id) | Detection recorded, A NOT marked | High |
| IT-04 | Schema idempotent | Resolver constructed twice on same DB | No error, columns exist once | Medium |
| IT-05 | Search filter integration | DB with SUPERSEDED + ACTIVE entries, call filterSuperseded | Only ACTIVE returned | High |
| IT-06 | Chain resolution integration | A superseded by B, B superseded by C. Search returns A,B,C | A returned (B inactive), B filtered, C returned | High |
| IT-07 | LLM mock integration | Mock HTTP server, resolver with LLM configured | consolidateWithLlm removes LLM-identified entries | Medium |
| IT-08 | LLM timeout graceful | Mock HTTP server with 15s delay | Original results returned after timeout | High |
| IT-09 | Multiple entities multiple candidates | Entry shares 3 entities with 5 different entries | All 5 found as candidates (deduplicated) | Medium |
| IT-10 | Duplicate edge prevention | Same contradiction triggered twice | Only 1 SUPERSEDES edge exists | Medium |
| IT-11 | Manual supersede + filter | manualSupersede(A, B) then search includes A | A filtered from results | High |
| IT-12 | Revalidate + filter | Supersede A, revalidate A, search | A appears in results again | High |

---

## 4. End-to-End API Tests (E2E-API)

| ID | Name | Precondition | Steps | Expected | Priority |
|----|------|-------------|-------|----------|----------|
| E2E-01 | Ingest triggers detection | KB has existing entry about "use Redis for caching" | Ingest: "Cancel Redis caching decision, use Memcached instead" | Old entry SUPERSEDED, new entry ACTIVE | High |
| E2E-02 | Search excludes superseded | After E2E-01 | Search "caching strategy" | Only Memcached entry returned, Redis entry hidden | High |
| E2E-03 | Manual supersede via API | KB has entry A and B | Call manualSupersede(A, B) | A no longer in search results | High |
| E2E-04 | Revalidate via API | Entry A is SUPERSEDED | Call revalidate(A) | A appears in search results | High |
| E2E-05 | Config toggle strategy 1 off | Entries with SUPERSEDED status | updateConfig(enableStatusMarking=false), search | SUPERSEDED entries appear (strategy disabled) | Medium |
| E2E-06 | Config toggle strategy 3 off | Entries with SUPERSEDES edges | updateConfig(enableGraphSupersedes=false), search | Edge-superseded entries appear | Medium |
| E2E-07 | Stats reflect reality | After multiple operations | getStats() | Counts match actual DB state | Low |
| E2E-08 | Bilingual signal detection | Vietnamese entry + English signal in same KB | Ingest with "deprecated" | Detects Vietnamese entries sharing entity | High |

---

## 5. System Integration Tests (SIT)

| ID | Name | Platforms | Steps | Expected | Priority |
|----|------|-----------|-------|----------|----------|
| SIT-01 | Same signal detected across platforms | All 4 | Run same 40 signals through detectSignal() on each platform | Same results on all platforms | High |
| SIT-02 | Same confidence on all platforms | All 4 | Same input scenarios through computeConfidence() | Same scores (within float precision) | High |
| SIT-03 | Same resolution outcome | All 4 | Same DB state + same new entry | Same entries superseded on all platforms | High |
| SIT-04 | Visual verification of audit logs | All 4 | Review audit log format and content | Same JSON structure across platforms | Low (Manual) |

---

## 6. Test Data

### 6.1 Signal Test Data (signals.csv)

```csv
signal,language,strength,expected_detected
hủy bỏ,vi,strong,true
cancel,en,strong,true
replaced,en,weak,true
thay đổi,vi,weak,true
implement,en,none,false
feature,en,none,false
login page,en,none,false
```

### 6.2 Confidence Scenarios (confidence-scenarios.csv)

```csv
signal_type,is_newer,same_source,same_type,expected_min,expected_max
strong,true,true,true,0.95,1.0
strong,true,true,false,0.90,0.95
strong,true,false,false,0.80,0.90
strong,false,false,false,0.65,0.75
weak,true,true,true,0.75,0.85
weak,true,false,false,0.60,0.70
weak,false,false,false,0.45,0.55
```

### 6.3 Resolution Scenarios (resolution-scenarios.csv)

```csv
scenario,signal,entities_overlap,confidence_range,should_resolve
cancel_shared_entity,cancel,true,0.7-1.0,true
deprecated_same_source,deprecated,true,0.8-1.0,true
weak_no_overlap,thay đổi,false,0.5-0.6,false
replace_different_type,replace,true,0.7-0.9,true
```

---

## 7. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Overview | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |