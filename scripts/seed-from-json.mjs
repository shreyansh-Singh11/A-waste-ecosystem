import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const dataDir = path.join(__dirname, '../data');

function readJson(filename) {
  const filePath = path.join(dataDir, filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    return [];
  }
}

async function seed() {
  console.log('🌱 Starting migration of JSON data into PostgreSQL...');

  // 1. Seed Users
  const users = readJson('users.json');
  console.log(`Migrating ${users.length} Users...`);
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: String(u.id) },
      update: {},
      create: {
        id: String(u.id),
        name: u.name || 'Anonymous User',
        email: u.email || `${u.id}@example.com`,
        phone: u.phone || null,
        role: u.role || 'citizen'
      }
    });
  }

  // Ensure fallback default user exists
  const defaultUser = await prisma.user.upsert({
    where: { id: 'default_user' },
    update: {},
    create: {
      id: 'default_user',
      name: 'Default User',
      email: 'default@example.com',
      role: 'citizen'
    }
  });

  // 2. Seed Collectors
  const collectors = readJson('collectors.json');
  console.log(`Migrating ${collectors.length} Collectors...`);
  for (const c of collectors) {
    await prisma.collector.upsert({
      where: { id: String(c.id) },
      update: {},
      create: {
        id: String(c.id),
        name: c.name || 'Collector',
        phone: c.phone || '0000000000',
        vehicleNo: c.vehicleNo || null,
        status: c.status || 'AVAILABLE',
        latitude: parseFloat(c.lat || c.latitude || 28.6139),
        longitude: parseFloat(c.lng || c.longitude || 77.2090),
        capacityKg: parseFloat(c.capacityKg || 100)
      }
    });
  }

  // 3. Seed Items
  const items = readJson('items.json');
  console.log(`Migrating ${items.length} Items...`);
  for (const item of items) {
    let ownerId = item.userId || item.ownerId || users[0]?.id || defaultUser.id;
    // Ensure owner exists
    const userExists = await prisma.user.findUnique({ where: { id: String(ownerId) } });
    if (!userExists) {
      await prisma.user.create({
        data: { id: String(ownerId), name: `User ${ownerId}`, email: `user_${ownerId}@example.com` }
      });
    }

    await prisma.item.upsert({
      where: { id: String(item.id) },
      update: {},
      create: {
        id: String(item.id),
        ownerId: String(ownerId),
        title: item.title || item.name || 'Electronic Item',
        category: item.category || 'General E-Waste',
        subcategory: item.subcategory || null,
        weightKg: parseFloat(item.weightKg || item.weight || 1.0),
        condition: item.condition || 'USED',
        declaredImages: item.declaredImages || item.images || [],
        aiDetected: Boolean(item.aiDetected),
        aiConfidence: item.aiConfidence ? parseFloat(item.aiConfidence) : null
      }
    });
  }

  // 4. Seed Producers
  const producers = readJson('producers.json');
  console.log(`Migrating ${producers.length} Producers...`);
  for (const p of producers) {
    await prisma.producer.upsert({
      where: { id: String(p.id) },
      update: {},
      create: {
        id: String(p.id),
        brandName: p.brandName || p.name || 'Brand',
        companyName: p.companyName || p.name || 'Company',
        gstin: p.gstin || `GSTIN-${p.id}`,
        email: p.email || `producer-${p.id}@example.com`
      }
    });
  }

  // 5. Seed Collection Requests
  const requests = readJson('collectionRequests.json');
  console.log(`Migrating ${requests.length} Collection Requests...`);
  for (const r of requests) {
    let userId = String(r.userId || users[0]?.id || defaultUser.id);
    let itemId = String(r.itemId || items[0]?.id);

    // Ensure user exists
    const uExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!uExists) {
      await prisma.user.create({
        data: { id: userId, name: `User ${userId}`, email: `user_${userId}@example.com` }
      });
    }

    // Ensure item exists
    const iExists = await prisma.item.findUnique({ where: { id: itemId } });
    if (!iExists) {
      await prisma.item.create({
        data: {
          id: itemId,
          ownerId: userId,
          title: 'Imported Item',
          category: 'E-Waste',
          weightKg: 1.0
        }
      });
    }

    // Ensure collector exists if referenced
    if (r.collectorId) {
      const cExists = await prisma.collector.findUnique({ where: { id: String(r.collectorId) } });
      if (!cExists) {
        await prisma.collector.create({
          data: { id: String(r.collectorId), name: `Collector ${r.collectorId}`, phone: '0000000000', latitude: 28.6139, longitude: 77.2090 }
        });
      }
    }

    await prisma.collectionRequest.upsert({
      where: { id: String(r.id) },
      update: {},
      create: {
        id: String(r.id),
        itemId: itemId,
        userId: userId,
        collectorId: r.collectorId ? String(r.collectorId) : null,
        status: r.status || 'REQUESTED',
        qrToken: r.qrToken || r.token || null,
        pickupLat: r.pickupLat ? parseFloat(r.pickupLat) : null,
        pickupLng: r.pickupLng ? parseFloat(r.pickupLng) : null
      }
    });
  }

  console.log('✅ Seeding completed successfully!');
}

seed()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
