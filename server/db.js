import 'dotenv/config';
import pg from 'pg';
// Postgres by default returns bigint (int8, type 20) as a string. Map it securely to Number for timestamps
pg.types.setTypeParser(20, parseInt);
const { Pool } = pg;

// Neon/PostgreSQL requires a connection string
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️ WARNING: DATABASE_URL environment variable is missing.");
  console.warn("Make sure to provide your Neon connection string.");
}

const db = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

export const initDB = async () => {
  if (!connectionString) return;
  console.log("Initializing PostgreSQL Tables...");
  const client = await db.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "selfiePath" TEXT NOT NULL,
        "district" TEXT DEFAULT '',
        "state" TEXT DEFAULT '',
        "pincode" TEXT DEFAULT '',
        "contact" TEXT DEFAULT '',
        "location" TEXT DEFAULT '',
        "nearestCity" TEXT DEFAULT '',
        "deviceId" TEXT,
        "deviceToken" TEXT,
        "isBlocked" INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS listings (
        "id" TEXT PRIMARY KEY,
        "sellerId" TEXT NOT NULL,
        "sellerName" TEXT NOT NULL,
        "cropName" TEXT DEFAULT '',
        "quantity" TEXT DEFAULT '',
        "price" TEXT DEFAULT '',
        "location" TEXT NOT NULL,
        "nearestCity" TEXT DEFAULT '',
        "district" TEXT DEFAULT '',
        "state" TEXT DEFAULT '',
        "pincode" TEXT DEFAULT '',
        "timestamp" BIGINT NOT NULL,
        "status" TEXT DEFAULT 'active',
        FOREIGN KEY ("sellerId") REFERENCES users("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS listing_images (
        "id" SERIAL PRIMARY KEY,
        "listingId" TEXT NOT NULL,
        "imagePath" TEXT NOT NULL,
        FOREIGN KEY ("listingId") REFERENCES listings("id") ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS support_messages (
        "id" TEXT PRIMARY KEY,
        "senderId" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "adminReply" TEXT DEFAULT NULL,
        "unreadAdminReply" INTEGER DEFAULT 0,
        "isResolved" INTEGER DEFAULT 0,
        "timestamp" BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        "id" TEXT PRIMARY KEY,
        "senderId" TEXT NOT NULL,
        "receiverId" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "timestamp" BIGINT NOT NULL,
        "isRead" INTEGER DEFAULT 0,
        FOREIGN KEY ("senderId") REFERENCES users("id") ON DELETE CASCADE,
        FOREIGN KEY ("receiverId") REFERENCES users("id") ON DELETE CASCADE
      );

      -- Migration: Ensure status column exists for old databases
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active';
    `);
    console.log("✓ PostgreSQL Database Ready");
  } catch (err) {
    console.error("Database initialization failed:", err);
  } finally {
    client.release();
  }
};

export default db;
