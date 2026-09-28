/**
 * Automated JSON Database & Flat-File Backup Script
 *
 * Backs up all 53 JSON files from `local host/data/` to:
 *  1. Local Backup Database Directory: `local host/data_backup/`
 *  2. Versioned Snapshot Directory: `local host/data_backup/snapshots/<timestamp>/`
 *  3. Neon PostgreSQL Database Table: `JsonBackupDatabase` (as queryable raw JSON with metadata & SHA-256 hash)
 *
 * Usage:
 *   node scripts/backupToDatabase.mjs
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "..", "data");
const BACKUP_DIR = path.resolve(__dirname, "..", "data_backup");
const SNAPSHOTS_DIR = path.resolve(BACKUP_DIR, "snapshots");

const prisma = new PrismaClient();

function getSha256(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

async function runBackup() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const currentSnapshotDir = path.join(SNAPSHOTS_DIR, timestamp);

  console.log("===============================================================");
  console.log("📦 Starting Complete JSON Database & Flat-File Backup Process");
  console.log(`⏱️  Timestamp: ${new Date().toISOString()}`);
  console.log(`📂 Source Directory: ${DATA_DIR}`);
  console.log(`📂 Backup Directory: ${BACKUP_DIR}`);
  console.log(`📂 Snapshot Directory: ${currentSnapshotDir}`);
  console.log("===============================================================\n");

  // Ensure directories exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  if (!fs.existsSync(currentSnapshotDir)) {
    fs.mkdirSync(currentSnapshotDir, { recursive: true });
  }

  // Connect to PostgreSQL
  try {
    await prisma.$connect();
    console.log("✅ Connected to PostgreSQL Neon Cloud Database.\n");
  } catch (err) {
    console.warn("⚠️ Warning: Could not connect to PostgreSQL. Proceeding with file backups only.", err.message);
  }

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  console.log(`🔍 Found ${files.length} JSON database files to back up.\n`);

  const manifest = {
    backupTimestamp: new Date().toISOString(),
    totalFiles: files.length,
    totalBytes: 0,
    totalRecords: 0,
    files: []
  };

  let dbBackedUpCount = 0;
  let fileCopiedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const srcPath = path.join(DATA_DIR, fileName);
    const destBackupPath = path.join(BACKUP_DIR, fileName);
    const destSnapshotPath = path.join(currentSnapshotDir, fileName);

    const rawContent = fs.readFileSync(srcPath, "utf8");
    const stat = fs.statSync(srcPath);
    const sha256 = getSha256(rawContent);

    let parsedContent;
    let recordCount = 0;

    try {
      parsedContent = JSON.parse(rawContent);
      if (Array.isArray(parsedContent)) {
        recordCount = parsedContent.length;
      } else if (typeof parsedContent === "object" && parsedContent !== null) {
        recordCount = Object.keys(parsedContent).length;
      } else {
        recordCount = 1;
      }
    } catch (parseErr) {
      console.error(`❌ Error parsing JSON for ${fileName}:`, parseErr.message);
      parsedContent = { rawError: "INVALID_JSON", raw: rawContent };
      recordCount = 0;
    }

    // 1. Copy to data_backup
    fs.copyFileSync(srcPath, destBackupPath);
    // 2. Copy to snapshot
    fs.copyFileSync(srcPath, destSnapshotPath);
    fileCopiedCount++;

    // 3. Upsert into Neon PostgreSQL JsonBackupDatabase table
    try {
      await prisma.jsonBackupDatabase.upsert({
        where: { fileName },
        update: {
          content: parsedContent,
          recordCount,
          sizeBytes: stat.size,
          sha256Hash: sha256,
          backedUpAt: new Date()
        },
        create: {
          fileName,
          content: parsedContent,
          recordCount,
          sizeBytes: stat.size,
          sha256Hash: sha256,
          backedUpAt: new Date()
        }
      });
      dbBackedUpCount++;
    } catch (dbErr) {
      console.warn(`   ⚠️ DB upsert warning for ${fileName}:`, dbErr.message);
    }

    manifest.totalBytes += stat.size;
    manifest.totalRecords += recordCount;
    manifest.files.push({
      fileName,
      recordCount,
      sizeBytes: stat.size,
      sha256
    });

    console.log(
      ` [${String(i + 1).padStart(2, "0")}/${files.length}] ` +
      `✅ ${fileName.padEnd(32)} | ` +
      `${String(recordCount).padStart(5)} records | ` +
      `${(stat.size / 1024).toFixed(2).padStart(6)} KB | ` +
      `Hash: ${sha256.substring(0, 10)}...`
    );
  }

  // Write manifest file
  const manifestPath = path.join(BACKUP_DIR, "backup_manifest.json");
  const snapshotManifestPath = path.join(currentSnapshotDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  fs.writeFileSync(snapshotManifestPath, JSON.stringify(manifest, null, 2), "utf8");

  console.log("\n===============================================================");
  console.log("🎉 JSON DATABASE BACKUP COMPLETED SUCCESSFULLY");
  console.log(`📁 Files Backed Up to data_backup/: ${fileCopiedCount}/${files.length}`);
  console.log(`🗄️ Tables/Files Backed Up to Postgres: ${dbBackedUpCount}/${files.length}`);
  console.log(`📊 Total Records Preserved: ${manifest.totalRecords.toLocaleString()}`);
  console.log(`💾 Total Storage: ${(manifest.totalBytes / 1024).toFixed(2)} KB`);
  console.log(`📋 Backup Manifest: ${manifestPath}`);
  console.log(`⏱️ Duration: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
  console.log("===============================================================\n");

  await prisma.$disconnect();
}

runBackup().catch((e) => {
  console.error("❌ Fatal error during backup:", e);
  prisma.$disconnect().finally(() => process.exit(1));
});
