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
        "email" TEXT,
        "googleId" TEXT,
        "picture" TEXT,
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

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        "id" SERIAL PRIMARY KEY,
        "userId" TEXT UNIQUE,
        "subscription" JSONB NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES users("id") ON DELETE CASCADE
      );

      -- Migration: Ensure columns exist
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS "email" TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS "googleId" TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS "picture" TEXT;
    `);
    
    // 🛡️ Nuclear Constraint Cleanup: Dynamic removal of all UNIQUE constraints/indexes
    // This ensures multi-role support regardless of what names PostgreSQL gave the constraints.
    try {
      await client.query(`
        DO $$ 
        DECLARE 
          r RECORD;
        BEGIN 
          -- 1. Drop all UNIQUE constraints on the users table
          FOR r IN (
            SELECT conname 
            FROM pg_constraint con 
            JOIN pg_class rel ON rel.oid = con.conrelid 
            WHERE rel.relname = 'users' AND con.contype = 'u'
          ) LOOP 
            EXECUTE 'ALTER TABLE users DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE'; 
          END LOOP; 

          -- 2. Drop all UNIQUE indexes on the users table (specifically targeting googleId/email)
          FOR r IN (
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'users' AND indexdef LIKE '%UNIQUE%' AND (indexdef LIKE '%googleId%' OR indexdef LIKE '%email%')
          ) LOOP 
            EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(r.indexname) || ' CASCADE'; 
          END LOOP; 
        END $$;
      `);
      console.log("✓ Dynamic Migration: All unique constraints/indexes on identity columns cleared.");
    } catch (migErr) {
      console.warn("⚠️ Dynamic Migration Warning:", migErr.message);
    }

    console.log("✓ PostgreSQL Tables & Constraints Audited");
  } catch (err) {
    console.error("Core Table initialization failed:", err);
  } finally {
    client.release();
  }

  // Independent Migration: Ensure status column exists
  const mClient = await db.connect();
  try {
    await mClient.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT \'active\'');
    console.log("✓ Migration: Listing Status column verified");
  } catch (mErr) {
    console.warn("Migration Warning (status column):", mErr.message);
  } finally {
    mClient.release();
  }
};

export default db;
