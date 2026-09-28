# Graph Report - local host  (2026-09-28)

## Corpus Check
- 216 files · ~256,869 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .css 2, .prisma 1)

## Summary
- 719 nodes · 1223 edges · 42 communities (38 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `28560bea`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- communityEngine.mjs
- server.js
- medicalEngine.mjs
- package.json
- ♻️ CirculaSync / EcoTrack 360
- regulatoryEngine.mjs
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
- edgeOperationsEngine.mjs
- p
- d
- system4.test.mjs
- complianceEngine.mjs
- esgEngine.mjs
- bi
- system1.test.mjs
- creditEngine.mjs
- system3.test.mjs
- Jt
- system5.test.mjs
- m
- oi
- AGENTS.md
- loadGovernmentData
- ref_node_assert
- routeEngine.mjs
- system2.test.mjs
- system7.test.mjs
- manifest.json
- sw.js

## God Nodes (most connected - your core abstractions)
1. `processEvent()` - 31 edges
2. `read()` - 20 edges
3. `loadJson()` - 16 edges
4. `loadJson()` - 16 edges
5. `Prisma Platform core concepts` - 15 edges
6. `Prisma Platform core concepts` - 15 edges
7. `Prisma Platform core concepts` - 15 edges
8. `Prisma Platform core concepts` - 15 edges
9. `loadJson()` - 13 edges
10. `Prisma Composer core concepts` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Object storage` --references--> `read()`  [INFERRED]
  .agents/skills/prisma-platform-core-concepts/SKILL.md → smartAutomation/medicalEngine.mjs
- `Object storage` --references--> `read()`  [INFERRED]
  .claude/skills/prisma-platform-core-concepts/SKILL.md → smartAutomation/medicalEngine.mjs
- `Object storage` --references--> `read()`  [INFERRED]
  .cursor/skills/prisma-platform-core-concepts/SKILL.md → smartAutomation/medicalEngine.mjs
- `Object storage` --references--> `read()`  [INFERRED]
  .devin/skills/prisma-platform-core-concepts/SKILL.md → smartAutomation/medicalEngine.mjs
- `processEvent()` --calls--> `calculateCredits()`  [EXTRACTED]
  smartAutomation/decisionEngine.mjs → smartAutomation/creditEngine.mjs

## Import Cycles
- None detected.

## Communities (42 total, 4 thin omitted)

### Community 0 - "communityEngine.mjs"
Cohesion: 0.19
Nodes (24): appendAudit(), awardCitizenKarma(), DATA_DIR, __dirname, dispatchCleanupCrew(), FACILITY_SPECS, __filename, forecastFacilityLoad() (+16 more)

### Community 1 - "server.js"
Cohesion: 0.04
Nodes (47): ACTIVITY_FEED_FILE, ALERTS_FILE, ALLOWED_IMAGE_MIME_TYPES, app, auctionEnginePromise, COLLECTION_REQUESTS_FILE, COLLECTORS_FILE, communityEnginePromise (+39 more)

### Community 2 - "medicalEngine.mjs"
Cohesion: 0.27
Nodes (20): assignTransport(), audit(), createManifest(), dataDir, __dirname, getAllCertificates(), getAllManifests(), getAllStaffTraining() (+12 more)

### Community 3 - "package.json"
Cohesion: 0.06
Nodes (35): ALLOWED_MIME_TYPES, buildSchema(), demoIdentification(), GEMINI_AVAILABLE, GEMINI_MODELS, identifyElectronicItem(), looksLikeDeclaredImageType(), MAGIC_BYTES (+27 more)

### Community 4 - "♻️ CirculaSync / EcoTrack 360"
Cohesion: 0.05
Nodes (39): 1. Executive Summary & Vision, 2. Multi-Stream Circular Economy Framework, 3. High-Level System Architecture, 4. Phase-by-Phase Technical Breakdown, 5. Database Schema & Data Persistence, 6. Cryptography, Security & Verification Standards, 7. Complete REST API Directory, 8. Quality Assurance & Verification (+31 more)

### Community 5 - "regulatoryEngine.mjs"
Cohesion: 0.23
Nodes (12): DATA_DIR, __dirname, __filename, generateCpcbForm3(), generateCpcbForm4(), generateCpcbForm5(), generateCryptographicAuditChain(), getDumpingHotspots() (+4 more)

### Community 6 - "leaflet.js"
Cohesion: 0.08
Nodes (6): a(), Ci(), l(), me(), x(), ze()

### Community 7 - "municipalEngine.mjs"
Cohesion: 0.15
Nodes (27): appendAudit(), AUDIT_LOGS_FILE, createRecyclerOrder(), createShift(), DATA_DIR, __dirname, generateGatePass(), getAllShifts() (+19 more)

### Community 8 - "auctionEngine.mjs"
Cohesion: 0.16
Nodes (23): ref_node_crypto, appendAudit(), AUDIT_FILE, BIDS_FILE, closeAuction(), COMPONENT_VALUES, createAuctionLot(), DATA_DIR (+15 more)

### Community 9 - "shared.js"
Cohesion: 0.14
Nodes (8): DS_STATUS_TONE, dsEnhanceList(), dsEnhanceTable(), dsErrorState(), dsFormatDate(), dsInitNotificationBell(), dsShowEducationModal(), dsSkeletonRows()

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
Cohesion: 0.07
Nodes (63): ACTIVITY_FEED_FILE, addHistoryEntry(), ALERTS_FILE, applyWalletTransaction(), checkRepeatedScans(), COLLECTION_REQUESTS_FILE, COLLECTORS_FILE, computePriority() (+55 more)

### Community 20 - "edgeOperationsEngine.mjs"
Cohesion: 0.05
Nodes (55): prisma, { PrismaClient }, ref_crypto, ref_fs, ref_path, @prisma/client, ref_url, BACKUP_DIR (+47 more)

### Community 21 - "p"
Cohesion: 0.22
Nodes (9): Ae(), be(), De(), ei(), Ie(), ii(), p(), pe() (+1 more)

### Community 22 - "d"
Cohesion: 0.25
Nodes (9): at(), d(), ht(), i(), Li(), Mi(), v(), W() (+1 more)

### Community 23 - "system4.test.mjs"
Cohesion: 0.20
Nodes (8): ref_node_path, ref_node_url, DATA_DIR, __dirname, loadJson(), runFullFlow(), DATA_DIR, __dirname

### Community 24 - "complianceEngine.mjs"
Cohesion: 0.25
Nodes (15): calculateHRI(), computeSwachhScore(), DATA_DIR, __dirname, getAnomalyFlags(), getCompostBatches(), getCrossTrackSummary(), getUserFeeLedger() (+7 more)

### Community 25 - "esgEngine.mjs"
Cohesion: 0.31
Nodes (13): calculateContractorSettlement(), calculateMultiTrackCarbonOffsets(), DATA_DIR, __dirname, getCarbonCredits(), getCarbonTransactions(), getContractorSettlements(), getEsgSummary() (+5 more)

### Community 26 - "bi"
Cohesion: 0.25
Nodes (8): bi(), c(), e(), hi(), Pi(), Qe(), Ti(), u()

### Community 27 - "system1.test.mjs"
Cohesion: 0.17
Nodes (5): ACTIVITY_LABELS, ALERT_TYPES, EVENT_TYPES, DATA_DIR, __dirname

### Community 28 - "creditEngine.mjs"
Cohesion: 0.43
Nodes (6): calculateCredits(), calculatePreciousMetalBonus(), __dirname, loadMetalsDb(), lookupPreciousMetals(), METALS_FILE

### Community 29 - "system3.test.mjs"
Cohesion: 0.28
Nodes (7): ref_node_fs, COLLECTORS(), DATA_DIR, __dirname, registerAndRequest(), resetData(), takeToRecycled()

### Community 30 - "Jt"
Cohesion: 0.29
Nodes (7): Jt(), Le(), O(), Qt(), Re(), $t(), te()

### Community 31 - "system5.test.mjs"
Cohesion: 0.33
Nodes (8): DATA_DIR, __dirname, FIXTURE_COLLECTORS(), FIXTURE_OBLIGATIONS(), FIXTURE_PRODUCERS(), loadJson(), recycleItem(), resetData()

### Community 32 - "m"
Cohesion: 0.60
Nodes (5): m(), ve(), xe(), ye(), z()

### Community 33 - "oi"
Cohesion: 0.67
Nodes (4): Je(), ni(), oi(), si()

### Community 37 - "routeEngine.mjs"
Cohesion: 0.83
Nodes (3): calculateDistanceKm(), optimizeCollectionRoute(), resolveRequestCoordinates()

### Community 38 - "system2.test.mjs"
Cohesion: 0.32
Nodes (6): COLLECTORS(), DATA_DIR, __dirname, resetData(), takeItemToProcessing(), takeItemToReceived()

### Community 39 - "system7.test.mjs"
Cohesion: 0.33
Nodes (4): DATA_DIR, __dirname, FIXTURE_COLLECTORS(), resetData()

### Community 40 - "manifest.json"
Cohesion: 0.33
Nodes (5): backupTimestamp, files, totalBytes, totalFiles, totalRecords

## Knowledge Gaps
- **306 isolated node(s):** `backupTimestamp`, `totalFiles`, `totalBytes`, `totalRecords`, `files` (+301 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 369 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `read()` connect `medicalEngine.mjs` to `Prisma Platform core concepts`, `Prisma Platform core concepts`, `Prisma Platform core concepts`, `Prisma Platform core concepts`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `Object storage` connect `Prisma Platform core concepts` to `medicalEngine.mjs`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `Object storage` connect `Prisma Platform core concepts` to `medicalEngine.mjs`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `read()` (e.g. with `Object storage` and `Object storage`) actually correct?**
  _`read()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `backupTimestamp`, `totalFiles`, `totalBytes` to the rest of the system?**
  _306 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.037037037037037035 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0553306342780027 - nodes in this community are weakly interconnected._