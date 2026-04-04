import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  const client = await pool.connect();
  try {
    console.log("--- TABLE CONSTRAINTS ---");
    const { rows: constraints } = await client.query(`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conrelid = 'users'::regclass;
    `);
    console.log(JSON.stringify(constraints, null, 2));

    console.log("--- TABLE INDEXES ---");
    const { rows: indexes } = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'users';
    `);
    console.log(JSON.stringify(indexes, null, 2));

    console.log("--- DROP ATTEMPT ---");
    try {
      await client.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS "users_googleId_key"');
      console.log("Successfully dropped users_googleId_key");
    } catch (e) {
      console.error("Failed to drop constraint:", e.message);
    }
    
    try {
      await client.query('DROP INDEX IF EXISTS "users_googleId_key"');
      console.log("Successfully dropped index users_googleId_key");
    } catch (e) {
        console.error("Failed to drop index:", e.message);
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

inspect();
