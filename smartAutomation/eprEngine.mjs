/*
  ============================================================
  SYSTEM 5 — EPR (Extended Producer Responsibility) Engine
  ============================================================
  Pure-function module for EPR certificate pricing, ID generation,
  tamper-evident hashing, and compliance calculation. Same pattern
  as creditEngine.mjs and environmentalImpact.mjs — no side effects,
  no file I/O; the decision engine calls these and persists the results.

  India's E-Waste (Management) Rules, 2022 (CPCB) require electronics
  producers to meet annual recycling weight targets. This engine:
    1. Prices certificates based on category difficulty & weight
    2. Generates sequential certificate IDs
    3. Computes SHA-256 verification hashes for tamper-evident audit
    4. Calculates obligation compliance status per producer/category
    5. Builds full compliance reports for CPCB submission readiness
*/

import crypto from "crypto";
import { RULES } from "./rules.mjs";

// ============================================================
// Certificate Pricing
// ============================================================

/**
 * Calculates the INR price of an EPR certificate based on CPCB
 * category pricing tiers and verified recycled weight.
 *
 * @param {string} category - E-waste category (e.g. "Laptop", "Battery / Power")
 * @param {number} weightKg - Verified recycled weight in kg
 * @param {object} [environmentalImpact] - Optional impact data (unused for pricing today, reserved for future premium tiers)
 * @returns {{ priceINR: number, pricePerKgINR: number, category: string, weightKg: number }}
 */
export function calculateCertificatePrice(category, weightKg, environmentalImpact = null) {
  const eprRules = RULES.epr;
  const pricePerKg = eprRules.pricePerKg[category] || eprRules.pricePerKg.default;
  const priceINR = Math.round(pricePerKg * weightKg * 100) / 100;
  return { priceINR, pricePerKgINR: pricePerKg, category, weightKg };
}

/**
 * Resolves the weight to use for an EPR certificate. Prefers a verified
 * weight from the facility; falls back to a category-based default
 * estimate so certificates are never generated with 0 kg.
 *
 * @param {object} item - The recycled item record
 * @param {object} [verificationData] - Optional verification data with weightKg
 * @returns {number} Weight in kg (always > 0)
 */
export function resolveWeight(item, verificationData = {}) {
  if (verificationData && verificationData.weightKg > 0) return verificationData.weightKg;
  if (item.weightKg > 0) return item.weightKg;
  const defaults = RULES.epr.defaultWeightKg;
  return defaults[item.category] || defaults.default;
}

// ============================================================
// Certificate ID Generation
// ============================================================

/**
 * Generates a sequential EPR certificate ID: EPR-CERT-YYYY-XXXXXX.
 * Same pattern as generateItemId / generateRequestId in decisionEngine.mjs.
 *
 * @param {Array} existingCerts - Current certificates array
 * @returns {string} New unique certificate ID
 */
export function generateCertificateId(existingCerts) {
  const year = new Date().getFullYear();
  const maxNum = existingCerts.reduce((max, c) => {
    const match = c.id && c.id.match(/^EPR-CERT-\d{4}-(\d{6})$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `EPR-CERT-${year}-${String(maxNum + 1).padStart(6, "0")}`;
}

/**
 * Generates a sequential EPR transaction ID: EPR-TXN-YYYY-XXXXXX.
 *
 * @param {Array} existingTxns - Current transactions array
 * @returns {string} New unique transaction ID
 */
export function generateTransactionId(existingTxns) {
  const year = new Date().getFullYear();
  const maxNum = existingTxns.reduce((max, t) => {
    const match = t.id && t.id.match(/^EPR-TXN-\d{4}-(\d{6})$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `EPR-TXN-${year}-${String(maxNum + 1).padStart(6, "0")}`;
}

// ============================================================
// Tamper-Evident Verification Hash
// ============================================================

/**
 * Computes a SHA-256 hash of the certificate's core identity fields.
 * Anyone can recalculate this hash from the certificate's public data
 * to verify it hasn't been tampered with in the database.
 *
 * @param {{ id: string, itemId: string, recyclerId: string, recycledAt: string, weightKg: number, category: string }} cert
 * @returns {string} Hex SHA-256 hash prefixed with "sha256:"
 */
export function computeVerificationHash(cert) {
  const payload = [
    cert.id,
    cert.itemId,
    cert.recyclerId,
    cert.recycledAt,
    String(cert.weightKg),
    cert.category,
  ].join("|");
  return "sha256:" + crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Verifies a certificate's hash matches its data fields.
 *
 * @param {object} cert - Certificate record with verificationHash field
 * @returns {{ valid: boolean, expected: string, actual: string }}
 */
export function verifyCertificateHash(cert) {
  const expected = computeVerificationHash(cert);
  return { valid: cert.verificationHash === expected, expected, actual: cert.verificationHash || "" };
}

// ============================================================
// Obligation Compliance Calculation
// ============================================================

/**
 * Calculates compliance status for a single obligation given
 * the certificates purchased against it.
 *
 * @param {object} obligation - EPR obligation record
 * @param {Array} purchasedCerts - Certificates purchased by this producer for this category
 * @returns {{ targetKg: number, fulfilledKg: number, remainingKg: number, compliancePct: number, status: string }}
 */
export function computeObligationStatus(obligation, purchasedCerts) {
  const categoryMatch = purchasedCerts.filter(c => c.category === obligation.category);
  const fulfilledKg = categoryMatch.reduce((sum, c) => sum + (c.weightKg || 0), 0);
  const targetKg = obligation.targetWeightKg || 0;
  const remainingKg = Math.max(0, targetKg - fulfilledKg);
  const compliancePct = targetKg > 0 ? Math.round((fulfilledKg / targetKg) * 100) : 100;

  const now = new Date();
  const deadline = new Date(obligation.deadline);
  const pastDeadline = now > deadline;

  let status;
  if (compliancePct >= 100) {
    status = "COMPLIANT";
  } else if (pastDeadline) {
    status = "OVERDUE";
  } else if (compliancePct >= 50) {
    status = "AT_RISK";
  } else {
    status = "NON_COMPLIANT";
  }

  return { targetKg, fulfilledKg, remainingKg, compliancePct, status };
}

/**
 * Calculates compliance across all obligations for a given producer.
 *
 * @param {Array} obligations - All obligations for this producer
 * @param {Array} certificates - All SOLD certificates purchased by this producer
 * @param {string} producerId - Producer ID
 * @param {string} [financialYear] - Optional filter by financial year
 * @returns {{ producerId: string, financialYear: string|null, categories: Array, overallCompliancePct: number, overallStatus: string }}
 */
export function checkObligationCompliance(obligations, certificates, producerId, financialYear = null) {
  let filtered = obligations.filter(o => o.producerId === producerId);
  if (financialYear) filtered = filtered.filter(o => o.financialYear === financialYear);

  const producerCerts = certificates.filter(c => c.purchasedBy === producerId && c.status === "SOLD");

  const categories = filtered.map(obl => {
    const oblStatus = computeObligationStatus(obl, producerCerts);
    return {
      obligationId: obl.id,
      financialYear: obl.financialYear,
      category: obl.category,
      deadline: obl.deadline,
      ...oblStatus,
    };
  });

  const totalTarget = categories.reduce((s, c) => s + c.targetKg, 0);
  const totalFulfilled = categories.reduce((s, c) => s + c.fulfilledKg, 0);
  const overallCompliancePct = totalTarget > 0 ? Math.round((totalFulfilled / totalTarget) * 100) : 100;

  let overallStatus = "COMPLIANT";
  if (categories.some(c => c.status === "OVERDUE")) overallStatus = "OVERDUE";
  else if (categories.some(c => c.status === "NON_COMPLIANT")) overallStatus = "NON_COMPLIANT";
  else if (categories.some(c => c.status === "AT_RISK")) overallStatus = "AT_RISK";

  return { producerId, financialYear: financialYear || null, categories, overallCompliancePct, overallStatus };
}

// ============================================================
// Full Compliance Report
// ============================================================

/**
 * Builds a comprehensive compliance report for CPCB-style submission.
 *
 * @param {object} producerProfile - Producer record from producers.json
 * @param {Array} obligations - Producer's obligations
 * @param {Array} certificates - All certificates (will filter to this producer's SOLD ones)
 * @param {Array} transactions - All EPR transactions (will filter to this producer)
 * @returns {object} Full compliance report
 */
export function buildComplianceReport(producerProfile, obligations, certificates, transactions) {
  const producerId = producerProfile.id;
  const producerCerts = certificates.filter(c => c.purchasedBy === producerId && c.status === "SOLD");
  const producerTxns = transactions.filter(t => t.producerId === producerId);

  const compliance = checkObligationCompliance(obligations, certificates, producerId);

  const totalSpendINR = producerTxns.reduce((sum, t) => sum + (t.amountINR || 0), 0);
  const totalWeightRecycledKg = producerCerts.reduce((sum, c) => sum + (c.weightKg || 0), 0);
  const totalCo2SavedKg = producerCerts.reduce((sum, c) => {
    return sum + (c.environmentalImpact ? c.environmentalImpact.co2SavedKg || 0 : 0);
  }, 0);

  return {
    producer: {
      id: producerProfile.id,
      name: producerProfile.name,
      gstin: producerProfile.gstin,
      cpcbRegistration: producerProfile.cpcbRegistration,
    },
    generatedAt: new Date().toISOString(),
    compliance,
    summary: {
      totalCertificatesPurchased: producerCerts.length,
      totalWeightRecycledKg,
      totalSpendINR,
      totalCo2SavedKg,
      estimatedEnvironmentalContribution: true,
    },
    transactions: producerTxns,
  };
}
