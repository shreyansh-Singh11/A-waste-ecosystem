// smartAutomation/medicalEngine.mjs
// ── Bio-Medical Waste (BMW) engine: manifest → transport → treatment → certificate ──

import fs   from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/* ── tiny helpers ─────────────────────────────────────────────── */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir   = path.join(__dirname, '..', 'data');

const read = (file) => {
  const fp = path.join(dataDir, file);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, '[]');
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
};
const write = (file, arr) =>
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(arr, null, 2));

const shortCode = (prefix) =>
  `${prefix}-${randomUUID().slice(0, 6).toUpperCase()}`;

/** Append an audit-log entry and return its id. */
function audit(action, entityId, actorId, details = {}) {
  const logs = read('medicalAuditLogs.json');
  const entry = {
    id:        randomUUID(),
    action,
    entityId,
    actorId,
    timestamp: new Date().toISOString(),
    details,
  };
  logs.push(entry);
  write('medicalAuditLogs.json', logs);
  return entry.id;
}

/* ── 1. Create Manifest ──────────────────────────────────────── */
export function createManifest({ hospitalId, wasteType, colorCode, weightKg, qrTag }) {
  const manifests = read('medicalManifests.json');
  const batchCode = shortCode('MED');
  const record = {
    id:         randomUUID(),
    batchCode,
    hospitalId,
    wasteType,   // 'YELLOW' | 'RED' | 'WHITE' | 'BLUE'
    colorCode,
    weightKg,
    qrTag,
    status:     'COLLECTED',
    createdAt:  new Date().toISOString(),
  };
  manifests.push(record);
  write('medicalManifests.json', manifests);

  audit('CREATE_MANIFEST', record.id, hospitalId, { batchCode, wasteType, weightKg });

  return { batchCode: record.batchCode, status: record.status, createdAt: record.createdAt };
}

/* ── 2. Assign Transport ─────────────────────────────────────── */
export function assignTransport({ batchCode, vehicleId, driverId }) {
  const transports = read('medicalTransport.json');
  const manifests  = read('medicalManifests.json');

  // update manifest status
  const manifest = manifests.find((m) => m.batchCode === batchCode);
  if (manifest) {
    manifest.status = 'IN_TRANSIT';
    write('medicalManifests.json', manifests);
  }

  const record = {
    id:          randomUUID(),
    transportId: shortCode('TRN'),
    batchCode,
    vehicleId,
    driverId,
    status:      'IN_TRANSIT',
    assignedAt:  new Date().toISOString(),
  };
  transports.push(record);
  write('medicalTransport.json', transports);

  audit('ASSIGN_TRANSPORT', record.id, driverId, { batchCode, vehicleId });

  return { transportId: record.transportId, status: record.status };
}

/* ── 3. Record Facility Arrival (weighbridge check-in) ───────── */
export function recordFacilityArrival({ batchCode, facilityId, grossWeightKg, tareWeightKg }) {
  const transports = read('medicalTransport.json');
  const manifests  = read('medicalManifests.json');

  const netWeightKg = +(grossWeightKg - tareWeightKg).toFixed(2);

  // update manifest status
  const manifest = manifests.find((m) => m.batchCode === batchCode);
  if (manifest) {
    manifest.status = 'RECEIVED';
    write('medicalManifests.json', manifests);
  }

  // update transport record
  const transport = transports.find((t) => t.batchCode === batchCode);
  if (transport) {
    transport.status     = 'DELIVERED';
    transport.arrivedAt  = new Date().toISOString();
    write('medicalTransport.json', transports);
  }

  const receiptId = shortCode('RCP');

  audit('FACILITY_ARRIVAL', receiptId, facilityId, { batchCode, grossWeightKg, tareWeightKg, netWeightKg });

  return { receiptId, netWeightKg, status: 'RECEIVED' };
}

/* ── 4. Record Treatment ─────────────────────────────────────── */
export function recordTreatment({ batchCode, facilityId, method, weightProcessedKg, temperatureC, pressureBar, durationMinutes }) {
  const treatments = read('medicalTreatments.json');
  const manifests  = read('medicalManifests.json');

  // update manifest status
  const manifest = manifests.find((m) => m.batchCode === batchCode);
  if (manifest) {
    manifest.status = 'TREATED';
    write('medicalManifests.json', manifests);
  }

  const record = {
    id:                randomUUID(),
    treatmentId:       shortCode('TRT'),
    batchCode,
    facilityId,
    method,            // 'AUTOCLAVE' | 'INCINERATION' | 'SHREDDER' | 'CHEMICAL'
    weightProcessedKg,
    temperatureC,
    pressureBar,
    durationMinutes,
    status:            'TREATED',
    treatedAt:         new Date().toISOString(),
  };
  treatments.push(record);
  write('medicalTreatments.json', treatments);

  audit('RECORD_TREATMENT', record.id, facilityId, { batchCode, method, weightProcessedKg });

  return { treatmentId: record.treatmentId, status: record.status };
}

/* ── 5. Issue Certificate ────────────────────────────────────── */
export function issueCertificate({ batchCode, treatmentId }) {
  const certs     = read('medicalCertificates.json');
  const manifests = read('medicalManifests.json');

  // update manifest status
  const manifest = manifests.find((m) => m.batchCode === batchCode);
  if (manifest) {
    manifest.status = 'CERTIFIED';
    write('medicalManifests.json', manifests);
  }

  const record = {
    id:              randomUUID(),
    certificateId:   shortCode('CID'),
    certificateCode: shortCode('CERT'),
    batchCode,
    treatmentId,
    issuedAt:        new Date().toISOString(),
  };
  certs.push(record);
  write('medicalCertificates.json', certs);

  audit('ISSUE_CERTIFICATE', record.id, 'SYSTEM', { batchCode, treatmentId, certificateCode: record.certificateCode });

  return { certificateId: record.certificateId, certificateCode: record.certificateCode, issuedAt: record.issuedAt };
}

/* ── 6. Whistleblower / Open-Dump Report ─────────────────────── */
export function reportOpenDump({ reporterId, photoUrl, gpsLat, gpsLng, description }) {
  const reports = read('medicalWhistleblower.json');

  const record = {
    id:          randomUUID(),
    reportId:    shortCode('RPT'),
    reporterId,
    photoUrl,
    gpsLat,
    gpsLng,
    description,
    status:      'SUBMITTED',
    submittedAt: new Date().toISOString(),
  };
  reports.push(record);
  write('medicalWhistleblower.json', reports);

  audit('REPORT_OPEN_DUMP', record.id, reporterId, { gpsLat, gpsLng });

  return { reportId: record.reportId, status: record.status };
}

/* ── 7. Log Staff Training ───────────────────────────────────── */
export function logStaffTraining({ staffId, hospitalId, trainingType, completionDate, expiryDate }) {
  const trainings = read('medicalStaffTraining.json');

  const record = {
    id:             randomUUID(),
    trainingId:     shortCode('STR'),
    staffId,
    hospitalId,
    trainingType,
    completionDate,
    expiryDate,
    loggedAt:       new Date().toISOString(),
  };
  trainings.push(record);
  write('medicalStaffTraining.json', trainings);

  audit('LOG_STAFF_TRAINING', record.id, staffId, { hospitalId, trainingType });

  return { trainingId: record.trainingId };
}

/* ── 8. Get Audit Trail ──────────────────────────────────────── */
export function getAuditTrail({ batchCode }) {
  const logs       = read('medicalAuditLogs.json');
  const manifests  = read('medicalManifests.json');
  const transports = read('medicalTransport.json');
  const treatments = read('medicalTreatments.json');
  const certs      = read('medicalCertificates.json');

  // Collect all entity IDs associated with this batchCode
  const entityIds = new Set();

  manifests.filter((m) => m.batchCode === batchCode).forEach((m) => entityIds.add(m.id));
  transports.filter((t) => t.batchCode === batchCode).forEach((t) => entityIds.add(t.id));
  treatments.filter((t) => t.batchCode === batchCode).forEach((t) => entityIds.add(t.id));
  certs.filter((c) => c.batchCode === batchCode).forEach((c) => entityIds.add(c.id));

  // Also match audit entries whose details mention this batchCode
  return logs.filter(
    (entry) => entityIds.has(entry.entityId) || entry.details?.batchCode === batchCode
  );
}

/* ── Query Helpers for UI / Dashboard ────────────────────────── */
export function getAllManifests() {
  return read('medicalManifests.json');
}

export function getAllTransports() {
  return read('medicalTransport.json');
}

export function getAllTreatments() {
  return read('medicalTreatments.json');
}

export function getAllCertificates() {
  return read('medicalCertificates.json');
}

export function getAllStaffTraining() {
  return read('medicalStaffTraining.json');
}

export function getWhistleblowerReports() {
  return read('medicalWhistleblower.json');
}

