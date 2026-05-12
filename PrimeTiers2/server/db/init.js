require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function init() {
  const client = await pool.connect();
  try {
    console.log('Initializing database...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        uuid VARCHAR(36) UNIQUE NOT NULL,
        username VARCHAR(64) NOT NULL,
        country_code VARCHAR(4) DEFAULT '',
        region VARCHAR(10) DEFAULT 'NA',
        platform VARCHAR(10) DEFAULT 'Java',
        skin_url TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_active TIMESTAMPTZ DEFAULT NOW(),
        is_banned BOOLEAN DEFAULT FALSE,
        notes TEXT DEFAULT '',
        bonus_points INTEGER DEFAULT 0
      );
    `);

    // Add missing columns to existing tables if not present
    await client.query(`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS bonus_points INTEGER DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS skin_url TEXT DEFAULT '';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS testers (
        id SERIAL PRIMARY KEY,
        username VARCHAR(64) NOT NULL,
        uuid VARCHAR(36) DEFAULT '',
        skin_url TEXT DEFAULT '',
        discord_id VARCHAR(32) DEFAULT '',
        role VARCHAR(64) DEFAULT 'Tester',
        specialties TEXT DEFAULT '',
        is_online BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        notes TEXT DEFAULT ''
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS player_tiers (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        gamemode VARCHAR(30) NOT NULL,
        tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
        pos INTEGER NOT NULL DEFAULT 0 CHECK (pos IN (0, 1)),
        peak_tier INTEGER NOT NULL CHECK (peak_tier BETWEEN 1 AND 5),
        peak_pos INTEGER NOT NULL DEFAULT 0 CHECK (peak_pos IN (0, 1)),
        attained BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
        retired BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(player_id, gamemode)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tier_history (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        gamemode VARCHAR(30) NOT NULL,
        old_tier INTEGER,
        old_pos INTEGER,
        new_tier INTEGER NOT NULL,
        new_pos INTEGER NOT NULL,
        changed_by INTEGER REFERENCES admins(id),
        changed_at TIMESTAMPTZ DEFAULT NOW(),
        notes TEXT DEFAULT ''
      );
    `);

    // Create default admin if not exists
    const bcrypt = require('bcryptjs');
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'changeme123';
    const hash = await bcrypt.hash(adminPass, 12);

    await client.query(`
      INSERT INTO admins (username, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (username) DO NOTHING;
    `, [adminUser, hash]);

    console.log('✅ Database initialized successfully!');
    console.log(`✅ Admin user "${adminUser}" ready.`);
  } catch (err) {
    console.error('❌ Database init error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

init().catch(() => process.exit(1));
