# ♻️ CirculaSync / EcoTrack 360

> **Next-Generation Multi-Stream Circular Economy, AI Traceability & Statutory Compliance Platform**  
> *Engineered for Smart India Hackathon (SIH) | Fully Aligned with CPCB E-Waste (2022), Solid Waste (2016) & Biomedical Waste (2016) Rules*

---

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-Neon%20PostgreSQL%20(Prisma)-blue.svg)](https://neon.tech/)
[![Tests](https://img.shields.io/badge/Tests-85%2F85%20Passing-brightgreen.svg)](#-test-suite--quality-metrics)
[![Compliance](https://img.shields.io/badge/Compliance-CPCB%20%7C%20SPCB%20%7C%20MoEFCC-orange.svg)](https://cpcb.nic.in/)
[![Architecture](https://img.shields.io/badge/Architecture-7--Phase%20Modular%20Engines-purple.svg)](docs/ARCHITECTURE.md)

---

## 🌟 Executive Overview

India produces over **62 million tonnes of municipal solid waste**, **1.71 million tonnes of e-waste**, and **600+ tonnes/day of biomedical waste** each year. Informal dumping, unverified handovers, missing chain-of-custody, and paper-based regulatory reporting lead to severe environmental degradation and non-compliance penalties.

**CirculaSync / EcoTrack 360** is an enterprise-grade, unified platform that bridges citizens, municipal corporations, healthcare facilities, collectors, recyclers, brand producers, and government regulators into a **single verifiable circular economy ecosystem**.

---

## 🧭 The 8 Interactive Portals

The application serves **8 dedicated, role-specific portals** on a single unified Express server:

| Portal | URL | Persona / Role | Key Features |
| :--- | :--- | :--- | :--- |
| **Unified Hub** | `http://localhost:3000/` | Public / Entry | Gateway to all portals, role selector & live platform stats |
| **Citizen Portal** | `http://localhost:3000/user` | Citizens & Households | AI e-waste scanner, pickup booking, eco-wallet & rewards, whistleblower reporting |
| **Collector / Facility** | `http://localhost:3000/collector` | Recyclers & Collectors | QR scanner, intake verification, TSP route planning, precious metals reverse auction |
| **Municipal Portal** | `http://localhost:3000/municipal` | Urban Local Bodies (ULBs) | SWM shifts, Eulerian Snake routing (zero-skipped streets), weighbridge & MRF inventory |
| **Biomedical Portal** | `http://localhost:3000/medical` | Hospitals & BMW Facilities | Color-coded biohazard manifests, GPS transport, autoclave/incineration certificates |
| **Producer / Brand** | `http://localhost:3000/producer` | Electronics Brands | EPR obligations tracker, CPCB certificate purchase, Voluntary Carbon Credits (VCC) |
| **Government Command** | `http://localhost:3000/government`| CPCB / SPCB / MoEFCC | Real-time map, Swachh Survekshan score, CPCB Forms 2/4/IV generator, Merkle audit chain |
| **Public Digital Passport** | `http://localhost:3000/track/:token`| General Public & Consumers | Tamper-proof, PII-masked circular lifecycle history for any scanned item |

---

## 🚀 Key Innovations Across the 7 Phases

```
┌────────────────────────────────────────────────────────────────────────┐
│                      7-PHASE ARCHITECTURE OVERVIEW                     │
├────────────────────────────────────────────────────────────────────────┤
│ Phase 1: Core E-Waste & Municipal Logistics (Matching, GHG Impact)      │
│ Phase 2: Circular Refurbishment & Precious Metals Reverse Auctions      │
│ Phase 3: Swachh Compliance, Compost Offtake & Anomaly Detection         │
│ Phase 4: Multi-Track ESG Engine & Voluntary Carbon Credits (VCC)       │
│ Phase 5: Citizen Whistleblower, AI Influx Forecasting & Worker Safety   │
│ Phase 6: CPCB/SPCB Statutory Returns & Merkle Root Audit Chain          │
│ Phase 7: Edge AI Vision Conveyor, Snake Routing & Hazmat Lockdown       │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Phase 1 — Core Multi-Stream Traceability:** Dynamic collector matching (least-loaded algorithm), real-time carbon avoidance calculations, and public QR passports.
2. **Phase 2 — Precious Metal Reverse Auctions:** AI forensic grading (SSQI), intrinsic gold/silver/copper valuation, and 5-minute competitive English bidding rooms.
3. **Phase 3 — Statutory Municipal Compliance:** SWM 2016 compliance scoring, Swachh Survekshan scorecard (0–100), FCO compost offtake booking, and volumetric user-fee billing.
4. **Phase 4 — Multi-Track ESG & Carbon Offsets:** Verified Voluntary Carbon Credit (VCC) minting from diverted waste, corporate offset retirement, and contractor hauling settlements.
5. **Phase 5 — Community & Worker Empowerment:** Anonymous geotagged illegal dump reporting, ARIMA-style material volume forecasting, B2B secondary materials exchange, and sanitation worker vaccination passports.
6. **Phase 6 — CPCB/SPCB Statutory Compliance & Cryptographic Merkle Chain:** Automated generation of CPCB Form-4, SWM Form-2, and BMW Form-IV annual returns with cryptographic SHA-256 Merkle root audit proofs and real-time fleet GPS telemetry.
7. **Phase 7 — Edge AI Vision, Snake Routing & HAZMAT Lockdown:** Automated optical conveyor purity inspection, Eulerian circuit (Chinese Postman) zero-skipped street routing, emergency perimeter containment, and offline-first PWA sync queue.

---

## ⚡ Quick Start Guide

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* **npm** (v9.0.0 or higher)

### 1. Installation
```bash
cd "local host"
npm install
```

### 2. Environment Configuration
Verify or create `.env` in the `local host/` directory:
```env
PORT=3000
DATABASE_URL="postgresql://neondb_owner:npg_VdK2I6kQWjgu@ep-blue-truth-b5d9ycvi-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"
MAX_IMAGE_SIZE_MB=5
```

### 3. Prime Live Demo State (Recommended)
Populate realistic active records across PostgreSQL and JSON mirror (accounts, active auction lot, HAZMAT emergency, Eulerian Snake route):
```bash
npm run seed
```

### 4. Start the Server
```bash
npm start
```
*Server starts at:* **`http://localhost:3000`**

### 5. Run the Full Test Suite
Execute all 85 unit and end-to-end integration tests:
```bash
npm test
```

---

## 🐳 Docker Deployment

The platform is container-ready with a multi-stage production Docker setup:

```bash
# Build and run with Docker Compose
docker compose up --build -d

# View server logs
docker compose logs -f
```
The server will be reachable at `http://localhost:3000` with offline PWA service worker enabled.

---

## 🗄️ Database Architecture & Operational CLI

The platform operates on a resilient **dual-persistence model**:
* **Live Production Database:** **Neon Cloud PostgreSQL** managed through **Prisma ORM** (v5.22.0) across 24 normalized domain tables.
* **Redundant Cloud Backup Mirror:** Every JSON flat-file is continuously snapshotted and synchronized to the `JsonBackupDatabase` PostgreSQL table with SHA-256 integrity hashes.

```bash
# Synchronize local state with Neon Cloud PostgreSQL
npm run migrate

# Execute complete local and cloud backup snapshot
npm run backup

# Push Prisma schema updates to Neon DB
npm run db:push
```

---

## 🧪 Test Suite & Quality Metrics

All **85 tests** pass deterministically with zero flaky assertions or external dependencies:

```
✔ Phase 1: Core E-Waste & Municipal Platform (10 tests)
✔ Phase 2: Refurbishment & Precious Metals Reverse Auction (10 tests)
✔ Phase 3: Swachh Compliance, Compost Offtake & Anomaly Detection (1 test suite)
✔ Phase 4: Multi-Track ESG Engine & Voluntary Carbon Credits (1 test suite)
✔ Phase 5: Citizen Whistleblower, AI Forecasting & Worker Safety (1 test suite)
✔ Phase 6: CPCB/SPCB Statutory Returns & Merkle Audit Trail (1 test suite)
✔ Phase 7: Edge AI Vision, Snake Route & Hazmat Emergency (1 test suite)
✔ Extended Lifecycle: Municipal SWM Engine & Biomedical BMW Engine (2 test suites)
✔ Environmental Impact, Wallet Transactions & EPR Trading (58 tests)

Total Tests: 85 Passed, 0 Failed, 0 Flaky
Execution Duration: ~11.6 seconds
```

---

## 📱 5-Minute End-to-End Jury Demo Flow

1. **Citizen Experience (`/user`):**
   * Upload an e-waste photo → AI classifies model and grades condition.
   * Book a pickup request → Automatically assigned to the nearest certified collector.
2. **Field Operations (`/collector` & `/collector/scan.html`):**
   * Collector verifies QR code upon intake.
   * View optimized TSP routing polyline to minimize transport emissions.
3. **Recovery & Auction (`/collector`):**
   * MRF harvests precious metals (e.g. 0.034g Au, 0.35g Ag from smartphone).
   * Aggregates items into a lot and initiates a live 5-minute reverse auction.
4. **Corporate ESG Offsets (`/producer`):**
   * Brand purchases EPR compliance certificates.
   * Retires Voluntary Carbon Credits (VCC) to offset scope-3 corporate emissions.
5. **Municipal Operations (`/municipal`):**
   * Launch a sanitation shift with Eulerian Snake routing guaranteeing zero skipped streets.
   * Lock weighbridge scale weights at the processing center.
6. **Regulatory Oversight (`/government`):**
   * View live fleet telemetry and Swachh Survekshan compliance scores.
   * One-click download of statutory CPCB Form-4 and SWM Form-2 annual returns.
   * Verify mathematical Merkle root cryptographic proof for any manifest.

---

## 📂 Repository Layout

```
local host/
├── data/                    # 53 Master JSON flat-file tables
├── data_backup/             # Encrypted snapshots & backup manifests
├── prisma/
│   └── schema.prisma        # 24 Relational Models + Cloud Backup Table
├── public-landing/          # Central launchpad & role gateway
├── public-user/             # Citizen portal & eco-wallet
├── public-collector/        # Collector intake, QR scanner & auctions
├── public-municipal/        # Municipal SWM, MRF & Snake routing
├── public-medical/          # Biomedical BMW manifest & autoclave tracking
├── public-producer/         # Brand EPR obligations & carbon credits
├── public-government/       # CPCB/SPCB regulatory command center
├── public-track/            # Public QR digital product passport
├── public-shared/           # Shared UI design system & CSS tokens
├── scripts/
│   ├── backupToDatabase.mjs # Automated cloud & local backup mirror
│   └── migrateToPostgres.mjs# PostgreSQL schema & data sync
├── smartAutomation/         # Core ES module business decision engines
│   ├── auctionEngine.mjs
│   ├── communityEngine.mjs
│   ├── complianceEngine.mjs
│   ├── decisionEngine.mjs
│   ├── edgeOperationsEngine.mjs
│   ├── eprEngine.mjs
│   ├── esgEngine.mjs
│   ├── medicalEngine.mjs
│   ├── municipalEngine.mjs
│   ├── regulatoryEngine.mjs
│   └── routeEngine.mjs
├── tests/                   # 85 automated unit and end-to-end tests
└── server.js                # Unified Express API & RBAC Gateway
```

---

## 📖 Complete Architecture Specification

For in-depth mathematical formulas, Merkle tree specifications, Chinese Postman algorithms, and full REST API endpoint documentation, refer to the [Technical Architecture Document](docs/ARCHITECTURE.md).

---

## 📜 Regulatory Standards & Acknowledgments

Built in compliance with:
* **E-Waste (Management) Rules, 2022** (Ministry of Environment, Forest and Climate Change)
* **Solid Waste Management (SWM) Rules, 2016** (Central Pollution Control Board)
* **Bio-Medical Waste Management Rules, 2016** (CPCB Guidelines)
* **Swachh Bharat Mission (Urban 2.0)** & **Swachh Survekshan Assessment Framework**
