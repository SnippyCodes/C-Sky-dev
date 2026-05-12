require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const pool = require('./db/pool');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── SESSION STORE ────────────────────────────────────────────────────────────
const pgSession = require('connect-pg-simple')(session);

app.use(session({
  store: new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use('/api', require('./routes/api'));
app.use('/api/admin', require('./routes/adminApi'));

// ─── ADMIN PANEL HTML ROUTES ──────────────────────────────────────────────────
const { requireAdmin } = require('./middleware/auth');

// Login page
app.get('/admin/login', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, '../public/admin/login.html'));
});

// Admin panel (protected)
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// ─── FRONTEND PAGE ROUTES ─────────────────────────────────────────────────────
const pageMap = {
  '/rankings':   'rankings/index.html',
  '/apply':      'apply/index.html',
  '/compare':    'compare/index.html',
  '/about':      'about/index.html',
  '/testers':    'testers/index.html',
  '/privacy':    'privacy/index.html',
  '/terms':      'terms/index.html',
  '/cookies':    'cookies/index.html',
};

// Register each page route explicitly
Object.entries(pageMap).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', file));
  });
});

// Player profile
app.get('/player/:username', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/player/index.html'));
});

// Removed pages — redirect to home
app.get('/leaderboard', (req, res) => res.redirect('/'));
app.get('/guides', (req, res) => res.redirect('/'));
app.get('/guides/:slug', (req, res) => res.redirect('/'));

// Homepage fallback
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ─── START ────────────────────────────────────────────────────────────────────

// Auto-migrate: create missing tables/columns on startup
async function migrate() {
  try {
    await pool.query(`
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
    await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS bonus_points INTEGER DEFAULT 0;`);
    await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS skin_url TEXT DEFAULT '';`);
    console.log('✅ DB migration OK');
  } catch(e) {
    console.error('Migration error:', e.message);
  }
}

app.listen(PORT, async () => {
  await migrate();
  
  // Start bot data sync (fetches players + tiers from bot API every 5 min)
  if (process.env.BOT_SYNC_ENABLED !== 'false') {
    const { startBotSync } = require('./sync/botSync');
    startBotSync();
  }

  console.log(`\n🏆 PrimeTiers server running at http://localhost:${PORT}`);
  console.log(`   Admin panel: http://localhost:${PORT}/admin`);
  console.log(`   API:         http://localhost:${PORT}/api/profile/:uuid\n`);
});
