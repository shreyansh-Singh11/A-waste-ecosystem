# Graph Report - local host  (2026-09-25)

## Corpus Check
- 104 files · ~122,568 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .css 2, (none) 1, .prisma 1)

## Summary
- 640 nodes · 1088 edges · 37 communities (35 shown, 2 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- processEvent
- server.js
- medicalEngine.mjs
- package.json
- E-Waste Platform — 3 Websites, 1 Shared Backend
- governmentAnalytics.mjs
- leaflet.js
- municipalEngine.mjs
- auctionEngine.mjs
- shared.js
- Prisma Platform core concepts
- Prisma Platform core concepts
- Prisma Platform core concepts
- Prisma Composer core concepts
- Prisma Composer core concepts
- Prisma Composer core concepts
- Prisma Composer core concepts
- Prisma Platform core concepts
- F
- decisionEngine.mjs
- seed-from-json.mjs
- p
- d
- system5.test.mjs
- complianceEngine.mjs
- esgEngine.mjs
- bi
- System 1 — Automated Collection & Recycler System
- creditEngine.mjs
- System 2 — Automated Credit, Reward & Verification System
- Jt
- eprEngine.mjs
- m
- oi
- AGENTS.md
- loadGovernmentData
- routeEngine.mjs

## God Nodes (most connected - your core abstractions)
1. `processEvent()` - 37 edges
2. `read()` - 20 edges
3. `loadJson()` - 16 edges
4. `Prisma Platform core concepts` - 15 edges
5. `Prisma Platform core concepts` - 15 edges
6. `Prisma Platform core concepts` - 15 edges
7. `Prisma Platform core concepts` - 15 edges
8. `E-Waste Platform — 3 Websites, 1 Shared Backend` - 15 edges
9. `loadJson()` - 13 edges
10. `Prisma Composer core concepts` - 13 edges

## Surprising Connections (you probably didn't know these)
- `New files` --references--> `calculateCredits()`  [INFERRED]
  README.md → smartAutomation/creditEngine.mjs
- `Files modified` --references--> `processEvent()`  [INFERRED]
  README.md → smartAutomation/decisionEngine.mjs
- `How the systems communicate` --references--> `processEvent()`  [INFERRED]
  README.md → smartAutomation/decisionEngine.mjs
- `How to run tests` --references--> `processEvent()`  [INFERRED]
  README.md → smartAutomation/decisionEngine.mjs
- `How to run tests` --references--> `processEvent()`  [INFERRED]
  README.md → smartAutomation/decisionEngine.mjs

## Import Cycles
- None detected.

## Communities (37 total, 2 thin omitted)

### Community 0 - "processEvent"
Cohesion: 0.21
Nodes (20): How the systems communicate, What's new, addHistoryEntry(), checkRepeatedScans(), computePriority(), createAlert(), createNotification(), fail() (+12 more)

### Community 1 - "server.js"
Cohesion: 0.04
Nodes (44): ACTIVITY_FEED_FILE, ALERTS_FILE, ALLOWED_IMAGE_MIME_TYPES, app, auctionEnginePromise, COLLECTION_REQUESTS_FILE, COLLECTORS_FILE, complianceEnginePromise (+36 more)

### Community 2 - "medicalEngine.mjs"
Cohesion: 0.27
Nodes (20): assignTransport(), audit(), createManifest(), dataDir, __dirname, getAllCertificates(), getAllManifests(), getAllStaffTraining() (+12 more)

### Community 3 - "package.json"
Cohesion: 0.06
Nodes (28): prisma, { PrismaClient }, dependencies, dotenv, express, @google/genai, multer, qrcode (+20 more)

### Community 4 - "E-Waste Platform — 3 Websites, 1 Shared Backend"
Cohesion: 0.06
Nodes (32): ALLOWED_MIME_TYPES, buildSchema(), demoIdentification(), GEMINI_AVAILABLE, GEMINI_MODELS, identifyElectronicItem(), looksLikeDeclaredImageType(), MAGIC_BYTES (+24 more)

### Community 5 - "governmentAnalytics.mjs"
Cohesion: 0.11
Nodes (29): Demo credentials, Environment variables, Files modified, Files modified, How the systems communicate, How to run tests, How to run tests, New APIs (+21 more)

### Community 6 - "leaflet.js"
Cohesion: 0.08
Nodes (6): a(), Ci(), l(), me(), x(), ze()

### Community 7 - "municipalEngine.mjs"
Cohesion: 0.17
Nodes (26): appendAudit(), AUDIT_LOGS_FILE, createRecyclerOrder(), createShift(), DATA_DIR, __dirname, generateGatePass(), getAllShifts() (+18 more)

### Community 8 - "auctionEngine.mjs"
Cohesion: 0.17
Nodes (22): appendAudit(), AUDIT_FILE, BIDS_FILE, closeAuction(), COMPONENT_VALUES, createAuctionLot(), DATA_DIR, __dirname (+14 more)

### Community 9 - "shared.js"
Cohesion: 0.13
Nodes (16): DS_STATUS_TONE, dsBadge(), dsEmptyState(), dsErrorState(), dsFormatDate(), dsInitNotificationBell(), dsShowEducationModal(), dsSkeletonRows() (+8 more)

### Community 10 - "Prisma Platform core concepts"
Cohesion: 0.12
Nodes (15): Branches are preview environments, Environment variables, Failure modes quick reference, Local development, Object storage, Prisma Platform core concepts, Prisma Postgres, Project setup (+7 more)

### Community 11 - "Prisma Platform core concepts"
Cohesion: 0.12
Nodes (15): Branches are preview environments, Environment variables, Failure modes quick reference, Local development, Object storage, Prisma Platform core concepts, Prisma Postgres, Project setup (+7 more)

### Community 12 - "Prisma Platform core concepts"
Cohesion: 0.12
Nodes (15): Branches are preview environments, Environment variables, Failure modes quick reference, Local development, Object storage, Prisma Platform core concepts, Prisma Postgres, Project setup (+7 more)

### Community 13 - "Prisma Composer core concepts"
Cohesion: 0.14
Nodes (13): Building blocks and extensions, Builds are yours, Contracts and RPC, Databases and migrations, Declarations are data, Deploy model: converge, don't script, Failure modes quick reference, Local development (+5 more)

### Community 14 - "Prisma Composer core concepts"
Cohesion: 0.14
Nodes (13): Building blocks and extensions, Builds are yours, Contracts and RPC, Databases and migrations, Declarations are data, Deploy model: converge, don't script, Failure modes quick reference, Local development (+5 more)

### Community 15 - "Prisma Composer core concepts"
Cohesion: 0.14
Nodes (13): Building blocks and extensions, Builds are yours, Contracts and RPC, Databases and migrations, Declarations are data, Deploy model: converge, don't script, Failure modes quick reference, Local development (+5 more)

### Community 16 - "Prisma Composer core concepts"
Cohesion: 0.14
Nodes (13): Building blocks and extensions, Builds are yours, Contracts and RPC, Databases and migrations, Declarations are data, Deploy model: converge, don't script, Failure modes quick reference, Local development (+5 more)

### Community 17 - "Prisma Platform core concepts"
Cohesion: 0.12
Nodes (15): Branches are preview environments, Environment variables, Failure modes quick reference, Local development, Object storage, Prisma Platform core concepts, Prisma Postgres, Project setup (+7 more)

### Community 18 - "F"
Cohesion: 0.24
Nodes (12): F(), G(), h(), j(), k(), ke(), ne(), e() (+4 more)

### Community 19 - "decisionEngine.mjs"
Cohesion: 0.11
Nodes (18): ACTIVITY_FEED_FILE, ALERTS_FILE, COLLECTION_REQUESTS_FILE, COLLECTORS_FILE, DATA_DIR, __dirname, EPR_CERTIFICATES_FILE, EPR_OBLIGATIONS_FILE (+10 more)

### Community 20 - "seed-from-json.mjs"
Cohesion: 0.22
Nodes (9): ref_fs, ref_path, ref_url, dataDir, __dirname, __filename, prisma, readJson() (+1 more)

### Community 21 - "p"
Cohesion: 0.22
Nodes (9): Ae(), be(), De(), ei(), Ie(), ii(), p(), pe() (+1 more)

### Community 22 - "d"
Cohesion: 0.25
Nodes (9): at(), d(), ht(), i(), Li(), Mi(), v(), W() (+1 more)

### Community 23 - "system5.test.mjs"
Cohesion: 0.05
Nodes (43): Pages redesigned, ref_node_assert, ref_node_fs, ref_node_path, ref_node_test, ref_node_url, ACTIVITY_LABELS, ALERT_TYPES (+35 more)

### Community 24 - "complianceEngine.mjs"
Cohesion: 0.26
Nodes (14): ref_node_crypto, computeSwachhScore(), DATA_DIR, __dirname, getAnomalyFlags(), getCompostBatches(), getCrossTrackSummary(), getUserFeeLedger() (+6 more)

### Community 25 - "esgEngine.mjs"
Cohesion: 0.31
Nodes (13): calculateContractorSettlement(), calculateMultiTrackCarbonOffsets(), DATA_DIR, __dirname, getCarbonCredits(), getCarbonTransactions(), getContractorSettlements(), getEsgSummary() (+5 more)

### Community 26 - "bi"
Cohesion: 0.25
Nodes (8): bi(), c(), e(), hi(), Pi(), Qe(), Ti(), u()

### Community 27 - "System 1 — Automated Collection & Recycler System"
Cohesion: 0.18
Nodes (12): Environment variables, Files modified, How the systems communicate, How to run tests, New APIs, New events, Remaining limitations (please read), System 1 — Automated Collection & Recycler System (+4 more)

### Community 28 - "creditEngine.mjs"
Cohesion: 0.23
Nodes (10): New files, calculateCredits(), calculatePreciousMetalBonus(), __dirname, loadMetalsDb(), lookupPreciousMetals(), METALS_FILE, findBestCollector() (+2 more)

### Community 29 - "System 2 — Automated Credit, Reward & Verification System"
Cohesion: 0.22
Nodes (11): Files modified, How the systems communicate, How to run tests, New APIs, New events, New files, Remaining limitations, System 2 — Automated Credit, Reward & Verification System (+3 more)

### Community 30 - "Jt"
Cohesion: 0.29
Nodes (7): Jt(), Le(), O(), Qt(), Re(), $t(), te()

### Community 31 - "eprEngine.mjs"
Cohesion: 0.24
Nodes (10): ref_crypto, buildComplianceReport(), calculateCertificatePrice(), checkObligationCompliance(), computeObligationStatus(), computeVerificationHash(), generateCertificateId(), generateTransactionId() (+2 more)

### Community 32 - "m"
Cohesion: 0.60
Nodes (5): m(), ve(), xe(), ye(), z()

### Community 33 - "oi"
Cohesion: 0.67
Nodes (4): Je(), ni(), oi(), si()

### Community 37 - "routeEngine.mjs"
Cohesion: 0.83
Nodes (3): calculateDistanceKm(), optimizeCollectionRoute(), resolveRequestCoordinates()

## Knowledge Gaps
- **268 isolated node(s):** `{ PrismaClient }`, `prisma`, `GEMINI_AVAILABLE`, `GEMINI_MODELS`, `ALLOWED_MIME_TYPES` (+263 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 320 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `read()` connect `medicalEngine.mjs` to `Prisma Platform core concepts`, `Prisma Platform core concepts`, `Prisma Platform core concepts`, `Prisma Platform core concepts`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Why does `E-Waste Platform — 3 Websites, 1 Shared Backend` connect `E-Waste Platform — 3 Websites, 1 Shared Backend` to `shared.js`, `governmentAnalytics.mjs`, `System 1 — Automated Collection & Recycler System`, `System 2 — Automated Credit, Reward & Verification System`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `UI/UX Polish Pass — Government-Grade Visual Redesign` connect `shared.js` to `E-Waste Platform — 3 Websites, 1 Shared Backend`, `system5.test.mjs`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `processEvent()` (e.g. with `Files modified` and `How the systems communicate`) actually correct?**
  _`processEvent()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `read()` (e.g. with `Object storage` and `Object storage`) actually correct?**
  _`read()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ PrismaClient }`, `prisma`, `GEMINI_AVAILABLE` to the rest of the system?**
  _268 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._