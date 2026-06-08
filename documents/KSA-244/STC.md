# Software Test Cases (STC)

## KSA-244: Context Compression Module

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-244 |
| Title | Context Compression Module - Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Related STP | STP-v1-KSA-244.docx |

---

## 1. Property-Based Tests (PBT)

| ID | Property | Generator | Assertion | BR |
|----|----------|-----------|-----------|-----|
| PBT-01 | Any valid JSON array detected as json | fc.array(fc.object(), {minLength:5}) | detect(JSON.stringify(arr)).type === json | BR-01 |
| PBT-02 | Content < 100 chars never compressed | fc.string({maxLength:99}) | detect(s).shouldCompress === false | BR-04 |
| PBT-03 | Arrays < 5 items always skipped | fc.array(fc.object(), {maxLength:4}) | compress(arr).skipped === true | BR-10 |
| PBT-04 | Compressed size <= original size | fc.array(fc.record(...), {minLength:20}) | result.skipped or compressedSize <= originalSize | BR-15 |
| PBT-05 | preserveFields always present in output | fc.array(fc.record({name:fc.string(), id:fc.nat()})) | All output items have name field | BR-13 |
| PBT-06 | Ratio always between 0 and 1 | fc.array(fc.object(), {minLength:10}) | 0 < result.ratio and result.ratio <= 1 | BR-15 |
| PBT-07 | CacheAligner produces stable prefix | fc.string() | Two calls same input = same prefix | BR-33 |
| PBT-08 | Pipeline never throws (failsafe) | fc.array(fc.anything()) | compress(msgs, sid) does not throw | BR-63 |

---

## 2. Unit Tests (UT)

### 2.1 ContentRouter

| ID | Test Case | Input | Expected Output | Steps | BR |
|----|-----------|-------|-----------------|-------|-----|
| UT-01 | Detect JSON array | '[{"a":1},{"a":2},...] (200+ chars)' | type:json, shouldCompress:true | 1. Call detect(content) 2. Assert type 3. Assert shouldCompress | BR-01 |
| UT-02 | Detect JSON array with leading whitespace | '  \n[{"a":1},...]\n' | type:json | 1. Call detect(content) 2. Assert type=json | BR-01 |
| UT-03 | Detect source code | 'import fs from "fs";\nfunction...' (100+ chars) | type:code, shouldCompress:false | 1. Call detect(content) 2. Assert type | BR-02 |
| UT-04 | Detect log output | 20 lines, 12 with timestamps | type:logs | 1. Call detect(logContent) 2. Assert type | BR-03 |
| UT-05 | Skip short content | 'hello' (50 chars) | type:short, shouldCompress:false | 1. Call detect(shortStr) 2. Assert | BR-04 |
| UT-06 | Default to text | 'Lorem ipsum...' (100+ chars, no patterns) | type:text | 1. Call detect(prose) 2. Assert type | BR-05 |
| UT-07 | Detect JSON object | '{"key":"value",...}' (100+ chars) | type:json_object, shouldCompress:false | 1. Call detect(obj) 2. Assert | - |
| UT-08 | Use hint override | content:any, hint:json | type:json, shouldCompress:true | 1. Call detect(content, 'json') 2. Assert | AF-02 |
| UT-09 | Empty content | '' | type:empty | 1. Call detect('') 2. Assert | EF-01 |

### 2.2 SmartCrusher

| ID | Test Case | Input | Expected Output | Steps | BR |
|----|-----------|-------|-----------------|-------|-----|
| UT-10 | Skip small array | [item1, item2, item3] (3 items) | skipped:true | 1. Call compress(arr) 2. Assert skipped | BR-10 |
| UT-11 | Default ratio keeps ~30% | 100 items, default options | ~30 items in result | 1. compress(100items) 2. Parse output 3. Count items | BR-11 |
| UT-12 | Field reduction on low-entropy | 50 items, field status=active for all | status removed from output | 1. compress(items) 2. Parse 3. Assert no status field | BR-12 |
| UT-13 | preserveFields kept | 50 items, preserveFields:[name] | All output items have name | 1. compress(items, {preserveFields:['name']}) 2. Verify | BR-13 |
| UT-14 | Summary header format | 100 items compressed | Starts with [COMPRESSED: 100 items -> N items (X% reduction)] | 1. compress(100items) 2. Check header | BR-14 |
| UT-15 | Skip when not beneficial | 5 unique items, all fields high entropy | skipped:true | 1. compress(smallUnique) 2. Assert skipped | BR-15 |
| UT-16 | Performance < 10ms for 1000 items | 1000-item array | duration < 10ms | 1. Start timer 2. compress(1000items) 3. Assert < 10ms | BR-16 |
| UT-17 | Hybrid strategy | Items with mix of low/high entropy fields | strategy:hybrid | 1. compress(mixedItems) 2. Assert strategy | - |
| UT-18 | Item sampling (all high entropy) | 50 items all fields unique | strategy:item_sampling | 1. compress(uniqueItems) 2. Assert strategy | - |
| UT-19 | Primitive array sampling | [1,2,3,...100] numbers | Evenly sampled ~30 items | 1. compress(numbers) 2. Count output | - |

### 2.3 CCR Store

| ID | Test Case | Input | Expected Output | Steps | BR |
|----|-----------|-------|-----------------|-------|-----|
| UT-20 | Expired entry not returned | Content stored with 1ms TTL | retrieve returns null | 1. Store with short TTL 2. Wait 5ms 3. retrieve 4. Assert null | BR-20 |
| UT-21 | Capacity limit enforced | Insert 1001 entries | count <= 1000 | 1. Store 1001 items 2. Count DB rows 3. Assert <= 1000 | BR-21 |
| UT-22 | LRU eviction (oldest removed) | Store 1001, oldest not accessed | Oldest key missing | 1. Store 1001 2. Retrieve oldest 3. Assert null | BR-22 |
| UT-23 | Key is valid UUID | Store any content | UUID v4 format | 1. key = store(content) 2. Assert UUID regex | BR-23 |
| UT-24 | Store and retrieve roundtrip | Store "test content" | Retrieve returns "test content" | 1. key = store(data) 2. result = retrieve(key) 3. Assert match | - |
| UT-25 | Non-existent key | retrieve("fake-uuid") | null | 1. retrieve(randomKey) 2. Assert null | - |

### 2.4 CacheAligner

| ID | Test Case | Input | Expected Output | Steps | BR |
|----|-----------|-------|-----------------|-------|-----|
| UT-30 | Extract Today is date | "Today is July 14, 2025" | Placeholder + suffix with date | 1. align(prompt) 2. Assert placeholder 3. Assert suffix | BR-30 |
| UT-31 | Extract ISO date | "Current date: 2025-07-14" | Extracted, placeholder | 1. align(prompt) 2. Assert | BR-30 |
| UT-32 | Only modifies system prompts | Non-system role | No change | 1. Pipeline processes non-system msg 2. Assert unchanged | BR-31 |
| UT-33 | Skip short matches | "v2.0" | Not extracted | 1. align(prompt) 2. Assert modified=false | BR-32 |
| UT-34 | Stable prefix | Same prompt twice | Identical prefix portion | 1. r1=align(p) 2. r2=align(p) 3. Assert prefix match | BR-33 |
| UT-35 | No dates found | "You are a helpful assistant" | modified:false | 1. align(noDatesPrompt) 2. Assert | - |

### 2.5 CompressionCache

| ID | Test Case | Input | Expected Output | Steps | BR |
|----|-----------|-------|-----------------|-------|-----|
| UT-40 | Skip set max 10000 | Insert 10001 | size <= 10000 | 1. Store 10001 skip results 2. Assert size | BR-40 |
| UT-41 | Result cache max 500 | Insert 501 | size <= 500 | 1. Store 501 results 2. Assert size | BR-41 |
| UT-42 | Hash is 32 hex chars | "test content" | 32 char hex string | 1. Hash content 2. Assert length and pattern | BR-42 |
| UT-43 | Cache hit < 0.1ms | Cached content lookup | duration < 0.1ms | 1. Store 2. Start timer 3. lookup 4. Assert time | BR-43 |
| UT-44 | In-memory only | New cache instance | No files created | 1. Create cache 2. Assert no I/O | BR-44 |
| UT-45 | Skip set hit | Previously skipped content | hit:true, source:skip_set | 1. Store skip 2. lookup 3. Assert | - |
| UT-46 | Result cache hit | Previously compressed content | hit:true, source:result_cache, result present | 1. Store result 2. lookup 3. Assert | - |
| UT-47 | Cache miss | New content | hit:false, source:miss | 1. lookup(newContent) 2. Assert | - |

### 2.6 CircuitBreaker

| ID | Test Case | Input | Expected Output | Steps | BR |
|----|-----------|-------|-----------------|-------|-----|
| UT-50 | Opens after 5 failures | 5x recordFailure() | allowRequest()=false | 1. Loop 5x recordFailure 2. Assert allowRequest=false | BR-50 |
| UT-51 | Resets after 60s | Open, advance 60s | allowRequest()=true | 1. Open circuit 2. Mock time+60s 3. Assert allow=true | BR-51 |
| UT-52 | Exception = failure | recordFailure() | failures incremented | 1. recordFailure 2. Assert failures=1 | BR-52 |
| UT-53 | Timeout triggers failure | Record after timeout detected | failures++ | 1. recordFailure 2. Assert failures increased | BR-53 |
| UT-54 | State observable | closed->open transition | getState().state=open | 1. Trigger open 2. getState 3. Assert | BR-54 |
| UT-55 | Half_open success closes | half_open + success | state:closed | 1. Get to half_open 2. recordSuccess 3. Assert closed | - |
| UT-56 | Half_open failure reopens | half_open + failure | state:open | 1. Get to half_open 2. recordFailure 3. Assert open | - |
| UT-57 | Closed allows all | Initial state | allowRequest()=true | 1. New breaker 2. Assert allowRequest=true | - |

### 2.7 Pipeline + Misc

| ID | Test Case | Input | Expected Output | Steps | BR |
|----|-----------|-------|-----------------|-------|-----|
| UT-60 | Only user/assistant compressed | tool_result message | Unchanged | 1. compress([toolResult]) 2. Assert unchanged | BR-60 |
| UT-61 | Tool_use blocks preserved | Assistant with tool_use | Unchanged | 1. compress([toolUse]) 2. Assert unchanged | BR-61 |
| UT-62 | System prompt CacheAligner | System msg with date | Date extracted | 1. compress([systemMsg]) 2. Assert date replaced | BR-62 |
| UT-63 | Failsafe on error | Content that causes internal throw | Original returned | 1. Mock internal error 2. compress 3. Assert original | BR-63 |
| UT-64 | Short messages pass through | 50-char user message | Unchanged | 1. compress([shortMsg]) 2. Assert unchanged | BR-04 |
| UT-65 | Non-string content pass through | Array content | Unchanged | 1. compress([arrayContent]) 2. Assert unchanged | BR-60 |
| UT-70 | No new dependencies | package.json | No new entries | 1. Read package.json 2. Compare baseline 3. Assert equal | NFR-3 |

---

## 3. Integration Tests (IT)

| ID | Test Case | Components | Scenario | Expected | BR |
|----|-----------|------------|----------|----------|-----|
| IT-01 | Full pipeline compresses JSON | All | JSON array -> pipeline -> compressed | Output has CCR key + compressed data | BR-01 |
| IT-02 | Pipeline < 10ms | All | 100 items, measure time | < 10ms total | BR-16 |
| IT-03 | CCR TTL expiration | CCRStore+SQLite | Store, advance time, retrieve | null after expiry | BR-20 |
| IT-04 | CCR max entries | CCRStore+SQLite | Insert 1001 | Count=1000 | BR-21 |
| IT-05 | CCR LRU eviction | CCRStore+SQLite | Store 1001, check oldest | Oldest gone | BR-22 |
| IT-06 | CCR roundtrip via pipeline | Pipeline+CCRStore | Compress, extract key, retrieve | Original returned | Story-3 |
| IT-07 | Cleanup runs at 100 stores | CCRStore+SQLite | Store 100 with short TTL | Expired cleaned | BR-24 |
| IT-08 | System only gets CacheAligner | Pipeline+CA | System msg | No SmartCrusher applied | BR-31 |
| IT-09 | Circuit opens after 5 fails | Pipeline+CB | Force 5 errors | 6th bypassed | BR-50 |
| IT-10 | Slow op triggers circuit | Pipeline+CB | Mock slow | Failure recorded | BR-53 |
| IT-11 | Non-string passes through | Pipeline | Tool message | Unchanged | BR-60 |
| IT-12 | Mixed messages processed | Pipeline | [sys,json,text,tool] | Only json compressed | BR-60,62 |
| IT-13 | Error in one msg no affect others | Pipeline | [valid,invalid,valid] | 2 compressed, 1 passed | BR-63 |

---

## 4. E2E-API Tests

| ID | Test Case | Method | Endpoint | Payload Summary | Expected | BR |
|----|-----------|--------|----------|-----------------|----------|-----|
| E2E-API-01 | JSON compressed in chat | POST | /api/chat/completions | Large JSON array message | Compressed in API call | BR-01 |
| E2E-API-02 | Summary header present | POST | /api/chat/completions | 100-item array | [COMPRESSED:...] header | BR-14 |
| E2E-API-03 | Non-JSON unchanged | POST | /api/chat/completions | Plain text messages | Passed through | BR-60 |
| E2E-API-04 | Tool blocks preserved | POST | /api/chat/completions | Tool_use blocks | Exactly preserved | BR-61 |
| E2E-API-05 | Error doesn't break request | POST | /api/chat/completions | Malformed content | Request succeeds | BR-63 |
| E2E-API-06 | Response time in budget | POST | /api/chat/completions | 100 items | < 10ms added | NFR-1 |
| E2E-API-07 | ccr_retrieve returns original | Tool | ccr_retrieve | CCR key | Original content | Story-3 |

---

## 5. SIT Tests

| ID | Test Case | Env | Steps | Expected |
|----|-----------|-----|-------|----------|
| SIT-01 | LLM accepts compressed | Staging+Anthropic | 1. Send large JSON 2. Check response | Coherent LLM response |
| SIT-02 | LLM uses ccr_retrieve | Staging+Anthropic | 1. Send compressed with CCR key 2. LLM calls tool | Original retrieved |

---

## 6. Test Data References

| File | Contents | Used By |
|------|----------|---------|
| testdata/json-arrays.csv | JSON arrays of various sizes (10,50,100,500,1000 items) | UT-10-19, IT-01-02, PBT-01-06 |
| testdata/code-samples.csv | Source code snippets for detection | UT-03 |
| testdata/log-samples.csv | Log output with timestamps | UT-04 |
| testdata/system-prompts.csv | System prompts with/without dates | UT-30-35, PBT-07 |
