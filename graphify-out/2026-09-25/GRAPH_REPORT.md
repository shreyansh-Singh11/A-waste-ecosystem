# Graph Report - local host  (2026-09-25)

## Corpus Check
- 99 files · ~116,608 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .css 2, (none) 1, .prisma 1)

## Summary
- 624 nodes · 1051 edges · 38 communities (36 shown, 2 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- decisionEngine.mjs
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
- system7.test.mjs
- seed-from-json.mjs
- p
- d
- system1.test.mjs
- system3.test.mjs
- system5.test.mjs
- bi
- ref_node_fs
- creditEngine.mjs
- system2.test.mjs
- Jt
- system4.test.mjs
- m
- oi
- AGENTS.md
- loadGovernmentData
- eventTypes.mjs
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
- `How it fits together` --references--> `identifyElectronicItem()`  [INFERRED]
  README.md → ewasteVision.mjs
- `New files` --references--> `calculateCredits()`  [INFERRED]
  README.md → smartAutomation/creditEngine.mjs
- `Files modified` --references--> `processEvent()`  [INFERRED]
  README.md → smartAutomation/decisionEngine.mjs
- `Object storage` --references--> `read()`  [INFERRED]
  .agents/skills/prisma-platform-core-concepts/SKILL.md → smartAutomation/medicalEngine.mjs
- `Object storage` --references--> `read()`  [INFERRED]
  .claude/skills/prisma-platform-core-concepts/SKILL.md → smartAutomation/medicalEngine.mjs

## Import Cycles
- None detected.

## Communities (38 total, 2 thin omitted)

### Community 0 - "decisionEngine.mjs"
Cohesion: 0.05
Nodes (77): Environment variables, Files modified, Files modified, Files modified, Files modified, How the systems communicate, How the systems communicate, How the systems communicate (+69 more)

### Community 1 - "server.js"
Cohesion: 0.04
Nodes (43): ACTIVITY_FEED_FILE, ALERTS_FILE, ALLOWED_IMAGE_MIME_TYPES, app, auctionEnginePromise, COLLECTION_REQUESTS_FILE, COLLECTORS_FILE, complianceEnginePromise (+35 more)

### Community 2 - "medicalEngine.mjs"
Cohesion: 0.27
Nodes (20): assignTransport(), audit(), createManifest(), dataDir, __dirname, getAllCertificates(), getAllManifests(), getAllStaffTraining() (+12 more)

### Community 3 - "package.json"
Cohesion: 0.06
Nodes (32): ALLOWED_MIME_TYPES, buildSchema(), demoIdentification(), GEMINI_AVAILABLE, GEMINI_MODELS, identifyElectronicItem(), looksLikeDeclaredImageType(), MAGIC_BYTES (+24 more)

### Community 4 - "E-Waste Platform — 3 Websites, 1 Shared Backend"
Cohesion: 0.06
Nodes (30): Change: QR Scanning moved to the Collector interface, E-Waste Platform — 3 Websites, 1 Shared Backend, Environment variables, Files modified, Files NOT touched, Honest limitations (please read), How it fits together, How this maps to what you already know (+22 more)

### Community 5 - "governmentAnalytics.mjs"
Cohesion: 0.14
Nodes (21): Demo credentials, How the systems communicate, How to run tests, New APIs (all require `GOVERNMENT` or `ADMIN` role via `Authorization: Bearer <token>`), New files, New files, Remaining limitations, System 3 — Government Command, Analytics & Integration System (+13 more)

### Community 6 - "leaflet.js"
Cohesion: 0.08
Nodes (6): a(), Ci(), l(), me(), x(), ze()

### Community 7 - "municipalEngine.mjs"
Cohesion: 0.17
Nodes (26): appendAudit(), AUDIT_LOGS_FILE, createRecyclerOrder(), createShift(), DATA_DIR, __dirname, generateGatePass(), getAllShifts() (+18 more)

### Community 8 - "auctionEngine.mjs"
Cohesion: 0.10
Nodes (36): ref_node_crypto, appendAudit(), AUDIT_FILE, BIDS_FILE, closeAuction(), COMPONENT_VALUES, createAuctionLot(), DATA_DIR (+28 more)

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

### Community 19 - "system7.test.mjs"
Cohesion: 0.33
Nodes (4): DATA_DIR, __dirname, FIXTURE_COLLECTORS(), resetData()

### Community 20 - "seed-from-json.mjs"
Cohesion: 0.13
Nodes (13): prisma, { PrismaClient }, ref_fs, ref_path, @prisma/client, ref_url, dataDir, __dirname (+5 more)

### Community 21 - "p"
Cohesion: 0.22
Nodes (9): Ae(), be(), De(), ei(), Ie(), ii(), p(), pe() (+1 more)

### Community 22 - "d"
Cohesion: 0.25
Nodes (9): at(), d(), ht(), i(), Li(), Mi(), v(), W() (+1 more)

### Community 23 - "system1.test.mjs"
Cohesion: 0.25
Nodes (5): Pages redesigned, DATA_DIR, __dirname, registerItem(), requestCollection()

### Community 24 - "system3.test.mjs"
Cohesion: 0.28
Nodes (7): ref_node_path, COLLECTORS(), DATA_DIR, __dirname, registerAndRequest(), resetData(), takeToRecycled()

### Community 25 - "system5.test.mjs"
Cohesion: 0.33
Nodes (8): DATA_DIR, __dirname, FIXTURE_COLLECTORS(), FIXTURE_OBLIGATIONS(), FIXTURE_PRODUCERS(), loadJson(), recycleItem(), resetData()

### Community 26 - "bi"
Cohesion: 0.25
Nodes (8): bi(), c(), e(), hi(), Pi(), Qe(), Ti(), u()

### Community 27 - "ref_node_fs"
Cohesion: 0.31
Nodes (5): ref_node_assert, ref_node_fs, ref_node_test, DATA_DIR, __dirname

### Community 28 - "creditEngine.mjs"
Cohesion: 0.36
Nodes (7): ref_node_url, calculateCredits(), calculatePreciousMetalBonus(), __dirname, loadMetalsDb(), lookupPreciousMetals(), METALS_FILE

### Community 29 - "system2.test.mjs"
Cohesion: 0.32
Nodes (6): COLLECTORS(), DATA_DIR, __dirname, resetData(), takeItemToProcessing(), takeItemToReceived()

### Community 30 - "Jt"
Cohesion: 0.29
Nodes (7): Jt(), Le(), O(), Qt(), Re(), $t(), te()

### Community 31 - "system4.test.mjs"
Cohesion: 0.33
Nodes (4): DATA_DIR, __dirname, loadJson(), runFullFlow()

### Community 32 - "m"
Cohesion: 0.60
Nodes (5): m(), ve(), xe(), ye(), z()

### Community 33 - "oi"
Cohesion: 0.67
Nodes (4): Je(), ni(), oi(), si()

### Community 36 - "eventTypes.mjs"
Cohesion: 0.50
Nodes (3): ACTIVITY_LABELS, ALERT_TYPES, EVENT_TYPES

### Community 37 - "routeEngine.mjs"
Cohesion: 0.83
Nodes (3): calculateDistanceKm(), optimizeCollectionRoute(), resolveRequestCoordinates()

## Knowledge Gaps
- **265 isolated node(s):** `{ PrismaClient }`, `prisma`, `GEMINI_AVAILABLE`, `GEMINI_MODELS`, `ALLOWED_MIME_TYPES` (+260 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 317 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `read()` connect `medicalEngine.mjs` to `Prisma Platform core concepts`, `Prisma Platform core concepts`, `Prisma Platform core concepts`, `Prisma Platform core concepts`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **Why does `E-Waste Platform — 3 Websites, 1 Shared Backend` connect `E-Waste Platform — 3 Websites, 1 Shared Backend` to `decisionEngine.mjs`, `shared.js`, `governmentAnalytics.mjs`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `UI/UX Polish Pass — Government-Grade Visual Redesign` connect `shared.js` to `E-Waste Platform — 3 Websites, 1 Shared Backend`, `system1.test.mjs`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `processEvent()` (e.g. with `Files modified` and `How the systems communicate`) actually correct?**
  _`processEvent()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `read()` (e.g. with `Object storage` and `Object storage`) actually correct?**
  _`read()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ PrismaClient }`, `prisma`, `GEMINI_AVAILABLE` to the rest of the system?**
  _265 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `decisionEngine.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.05189873417721519 - nodes in this community are weakly interconnected._