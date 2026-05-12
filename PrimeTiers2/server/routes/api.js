const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

const VALID_MODES = ['crystal', 'sword', 'uhc', 'pot', 'neth_pot', 'smp', 'axe', 'mace'];

// ─── TIER CONVERSION HELPERS ──────────────────────────────────────────────────

/**
 * Convert bot tier string (HT1, LT1, HT2...) to website format { tier, pos }
 * HT = pos 0 (High Tier), LT = pos 1 (Low Tier)
 */
function parseBotTier(tierStr) {
  if (!tierStr) return null;
  const match = tierStr.toUpperCase().match(/^(HT|LT)(\d)$/);
  if (!match) return null;
  return {
    tier: parseInt(match[2]),   // 1–5
    pos:  match[1] === 'HT' ? 0 : 1,  // 0=HT, 1=LT
  };
}

/**
 * Map bot gamemode keys to website gamemode keys.
 * Bot uses: axe-and-shield, neth-pot, dia-pot, smp-kit, mace, sword, uhc, cpvp
 * Website uses: axe, neth_pot, pot (dia-pot), smp, mace, sword, uhc, cpvp (crystal)
 */
function mapGamemode(botGamemode) {
  const map = {
    'axe-and-shield': 'axe',
    'axe':            'axe',
    'neth-pot':       'neth_pot',
    'neth_pot':       'neth_pot',
    'nethpot':        'neth_pot',
    'dia-pot':        'pot',
    'dia_pot':        'pot',
    'diapot':         'pot',
    'smp-kit':        'smp',
    'smp_kit':        'smp',
    'smp':            'smp',
    'mace':           'mace',
    'sword':          'sword',
    'uhc':            'uhc',
    'cpvp':           'crystal',
    'crystal':        'crystal',
  };
  return map[botGamemode?.toLowerCase()] || null;
}

// ─── WEBHOOK HELPERS ──────────────────────────────────────────────────────────

/**
 * Fetch UUID from Mojang API by username.
 * Returns dashed UUID string or null if not found (cracked/offline player).
 */
async function fetchMojangUUID(username) {
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.id) return null;
    // Convert undashed UUID to dashed format
    const id = data.id;
    return `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}`;
  } catch {
    return null;
  }
}

/**
 * Get or create a player by IGN.
 * 1. Look up by username in DB.
 * 2. If not found, fetch UUID from Mojang and auto-create.
 * 3. If Mojang fails (cracked player), generate a deterministic offline UUID.
 * Returns player id.
 */
async function getOrCreatePlayer(ign, skinUrl = '') {
  // Try find existing player
  const existing = await pool.query(
    `SELECT id FROM players WHERE username ILIKE $1 LIMIT 1`,
    [ign]
  );
  if (existing.rows.length > 0) {
    // Update skin if provided and not already set
    if (skinUrl) {
      await pool.query(
        `UPDATE players SET skin_url = $1, last_active = NOW() WHERE id = $2 AND (skin_url IS NULL OR skin_url = '')`,
        [skinUrl, existing.rows[0].id]
      );
    }
    return existing.rows[0].id;
  }

  // Not found — try Mojang for UUID
  let uuid = await fetchMojangUUID(ign);
  let platform = 'Java';
  let resolvedSkin = skinUrl || '';

  if (!uuid) {
    // Cracked / offline player — generate offline UUID
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(`OfflinePlayer:${ign}`).digest('hex');
    const b = Buffer.from(hash, 'hex');
    b[6] = (b[6] & 0x0f) | 0x30;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = b.toString('hex');
    uuid = `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
    platform = 'Cracked';
    console.log(`[Webhook] Mojang lookup failed for "${ign}" — using offline UUID: ${uuid}`);
  } else {
    console.log(`[Webhook] Mojang UUID for "${ign}": ${uuid}`);
  }

  // Insert new player
  const inserted = await pool.query(
    `INSERT INTO players (uuid, username, platform, region, skin_url)
     VALUES ($1, $2, $3, 'NA', $4)
     ON CONFLICT (uuid) DO UPDATE SET username = EXCLUDED.username, skin_url = COALESCE(NULLIF(EXCLUDED.skin_url,''), players.skin_url), last_active = NOW()
     RETURNING id`,
    [uuid, ign, platform, resolvedSkin]
  );
  console.log(`[Webhook] Auto-created player "${ign}" (id=${inserted.rows[0].id}, platform=${platform})`);
  return inserted.rows[0].id;
}

// ─── WEBHOOK ENDPOINT ─────────────────────────────────────────────────────────

/**
 * POST /api/webhook
 * Receives tier update/removal events from the Discord bot plugin.
 * Body: { action, ign, gamemode, tier, points, timestamp }
 *
 * Secured with WEBHOOK_SECRET env var — bot must send header:
 *   X-Webhook-Secret: <secret>
 *
 * Auto-creates players if they don't exist yet (fetches UUID from Mojang API).
 */
router.post('/webhook', async (req, res) => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers['x-webhook-secret'];
    if (provided !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { action, ign, gamemode, tier, timestamp, skin_url } = req.body;

  if (!action || !ign) {
    return res.status(400).json({ error: 'action and ign are required' });
  }

  // ── Handle skin update ───────────────────────────────────────────────
  if (action === 'skin_update') {
    if (!skin_url) return res.status(400).json({ error: 'skin_url required' });
    try {
      const playerId = await getOrCreatePlayer(ign, skin_url);
      await pool.query(`UPDATE players SET skin_url = $1, last_active = NOW() WHERE id = $2`, [skin_url, playerId]);
      return res.json({ success: true, action: 'skin_updated', ign });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── Handle reset ──────────────────────────────────────────────────────────
  if (action === 'reset') {
    console.log('[Webhook] Leaderboard reset event received from bot');
    return res.json({ success: true, message: 'Reset acknowledged' });
  }

  // ── Map gamemode ──────────────────────────────────────────────────────────
  const mappedGamemode = mapGamemode(gamemode);
  if (!mappedGamemode) {
    return res.status(400).json({ error: `Unknown gamemode: ${gamemode}` });
  }

  try {
    // ── Get or auto-create player ─────────────────────────────────────────
    const playerId = await getOrCreatePlayer(ign, skin_url || '');

    // ── Handle removal ────────────────────────────────────────────────────
    if (action === 'remove') {
      await pool.query(
        `DELETE FROM player_tiers WHERE player_id = $1 AND gamemode = $2`,
        [playerId, mappedGamemode]
      );
      await pool.query(`UPDATE players SET last_active = NOW() WHERE id = $1`, [playerId]);
      console.log(`[Webhook] Removed tier for ${ign} in ${mappedGamemode}`);
      return res.json({ success: true, action: 'removed', ign, gamemode: mappedGamemode });
    }

    // ── Handle update ─────────────────────────────────────────────────────
    if (action === 'update') {
      const parsed = parseBotTier(tier);
      if (!parsed) {
        return res.status(400).json({ error: `Invalid tier format: ${tier}. Expected HT1–HT5 or LT1–LT5` });
      }

      const { tier: tierNum, pos: posNum } = parsed;

      // Determine peak (keep best ever)
      const existingRes = await pool.query(
        `SELECT peak_tier, peak_pos FROM player_tiers WHERE player_id = $1 AND gamemode = $2`,
        [playerId, mappedGamemode]
      );

      let peakTier = tierNum;
      let peakPos  = posNum;

      if (existingRes.rows.length > 0) {
        const ex = existingRes.rows[0];
        const isBetter =
          tierNum < ex.peak_tier ||
          (tierNum === ex.peak_tier && posNum < ex.peak_pos);
        peakTier = isBetter ? tierNum : ex.peak_tier;
        peakPos  = isBetter ? posNum  : ex.peak_pos;
      }

      const attained = timestamp ? Math.floor(timestamp / 1000) : Math.floor(Date.now() / 1000);

      await pool.query(
        `INSERT INTO player_tiers (player_id, gamemode, tier, pos, peak_tier, peak_pos, attained, retired)
         VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
         ON CONFLICT (player_id, gamemode) DO UPDATE SET
           tier       = EXCLUDED.tier,
           pos        = EXCLUDED.pos,
           peak_tier  = EXCLUDED.peak_tier,
           peak_pos   = EXCLUDED.peak_pos,
           attained   = EXCLUDED.attained,
           retired    = FALSE,
           updated_at = NOW()`,
        [playerId, mappedGamemode, tierNum, posNum, peakTier, peakPos, attained]
      );

      await pool.query(`UPDATE players SET last_active = NOW() WHERE id = $1`, [playerId]);

      console.log(`[Webhook] Updated ${ign} → ${mappedGamemode} ${tier} (tier=${tierNum}, pos=${posNum})`);
      return res.json({ success: true, action: 'updated', ign, gamemode: mappedGamemode, tier: tierNum, pos: posNum });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('[Webhook] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/player/:uuid
 * Returns player tier data in the exact format required by the mod.
 * URL: /api/player/{uuid}  (no dashes required)
 */
router.get('/player/:uuid', async (req, res) => {
  const { uuid } = req.params;

  // Accept both dashed and undashed UUIDs
  const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    return res.status(404).json({ detail: 'Not found' });
  }

  // Normalize — store with dashes, query both formats
  const cleanUuid = uuid.replace(/-/g, '');
  const dashedUuid = [
    cleanUuid.slice(0,8),
    cleanUuid.slice(8,12),
    cleanUuid.slice(12,16),
    cleanUuid.slice(16,20),
    cleanUuid.slice(20),
  ].join('-');

  try {
    // Find player (try dashed first, then undashed)
    const playerResult = await pool.query(
      `SELECT id, username, region, is_banned, bonus_points
       FROM players
       WHERE (uuid = $1 OR uuid = $2) AND is_banned = FALSE`,
      [dashedUuid, cleanUuid]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ detail: 'Not found' });
    }

    const player = playerResult.rows[0];

    // Get all tiers
    const tiersResult = await pool.query(
      `SELECT gamemode, tier, pos, peak_tier, peak_pos, attained, retired
       FROM player_tiers
       WHERE player_id = $1`,
      [player.id]
    );

    if (tiersResult.rows.length === 0) {
      return res.json({ name: player.username, region: player.region || 'Unknown', points: player.bonus_points || 0, overall: 0, rankings: {} });
    }

    // Points map
    const POINTS = {
      '1_0': 60, '1_1': 45,
      '2_0': 30, '2_1': 20,
      '3_0': 10, '3_1': 6,
      '4_0': 4,  '4_1': 3,
      '5_0': 2,  '5_1': 1,
    };

    // Build rankings object
    const rankings = {};
    let allPoints = [];

    for (const row of tiersResult.rows) {
      const pts = POINTS[`${row.tier}_${row.pos}`] || 0;
      allPoints.push(pts);
      rankings[row.gamemode] = {
        tier:      Number(row.tier),
        pos:       Number(row.pos),
        peak_tier: Number(row.peak_tier),
        peak_pos:  Number(row.peak_pos),
        attained:  Number(row.attained),
        retired:   row.retired === true || row.retired === 'true',
      };
    }

    // Total points = sum of top 3 modes + bonus_points
    allPoints.sort((a, b) => b - a);
    const totalPoints = allPoints.slice(0, 3).reduce((s, p) => s + p, 0) + (player.bonus_points || 0);

    // Overall rank — count players with more points
    const rankResult = await pool.query(
      `SELECT COUNT(DISTINCT p.id) as cnt
       FROM players p
       JOIN player_tiers pt ON pt.player_id = p.id
       WHERE p.is_banned = FALSE AND p.id != $1`,
      [player.id]
    );
    // Simple rank: position among all ranked players by points
    const overallRankResult = await pool.query(
      `SELECT p.id,
              COALESCE(p.bonus_points,0) + (
                SELECT COALESCE(SUM(pts),0) FROM (
                  SELECT CASE
                    WHEN pt2.tier=1 AND pt2.pos=0 THEN 60
                    WHEN pt2.tier=1 AND pt2.pos=1 THEN 45
                    WHEN pt2.tier=2 AND pt2.pos=0 THEN 30
                    WHEN pt2.tier=2 AND pt2.pos=1 THEN 20
                    WHEN pt2.tier=3 AND pt2.pos=0 THEN 10
                    WHEN pt2.tier=3 AND pt2.pos=1 THEN 6
                    WHEN pt2.tier=4 AND pt2.pos=0 THEN 4
                    WHEN pt2.tier=4 AND pt2.pos=1 THEN 3
                    WHEN pt2.tier=5 AND pt2.pos=0 THEN 2
                    ELSE 1 END as pts
                  FROM player_tiers pt2
                  WHERE pt2.player_id = p.id
                  ORDER BY pts DESC LIMIT 3
                ) top3
              ) as total_pts
       FROM players p
       JOIN player_tiers pt ON pt.player_id = p.id
       WHERE p.is_banned = FALSE
       GROUP BY p.id, p.bonus_points
       ORDER BY total_pts DESC`,
      []
    );

    const overallPos = overallRankResult.rows.findIndex(r => r.id === player.id) + 1;

    return res.json({
      name:     player.username,
      region:   player.region || 'Unknown',
      points:   totalPoints,
      overall:  overallPos || 1,
      rankings,
    });

  } catch (err) {
    console.error('GET /api/player/:uuid error:', err.message);
    return res.status(500).json({ detail: 'Not found' });
  }
});

/**
 * GET /api/profile/:uuid  (legacy alias)
 */
router.get('/profile/:uuid', async (req, res) => {
  // Reuse the same logic as /player/:uuid
  const { uuid } = req.params;
  const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) return res.status(404).json({ detail: 'Not found' });

  const cleanUuid = uuid.replace(/-/g, '');
  const dashedUuid = [cleanUuid.slice(0,8),cleanUuid.slice(8,12),cleanUuid.slice(12,16),cleanUuid.slice(16,20),cleanUuid.slice(20)].join('-');

  try {
    const playerResult = await pool.query(
      `SELECT id, username, region FROM players WHERE (uuid = $1 OR uuid = $2) AND is_banned = FALSE`,
      [dashedUuid, cleanUuid]
    );
    if (!playerResult.rows.length) return res.status(404).json({ detail: 'Not found' });

    const player = playerResult.rows[0];
    const tiersResult = await pool.query(
      `SELECT gamemode, tier, pos, peak_tier, peak_pos, attained, retired FROM player_tiers WHERE player_id = $1`,
      [player.id]
    );
    if (!tiersResult.rows.length) return res.status(404).json({ detail: 'Not found' });

    const rankings = {};
    for (const row of tiersResult.rows) {
      rankings[row.gamemode] = {
        tier: Number(row.tier), pos: Number(row.pos),
        peak_tier: Number(row.peak_tier), peak_pos: Number(row.peak_pos),
        attained: Number(row.attained), retired: row.retired === true || row.retired === 'true',
      };
    }
    return res.json(rankings);
  } catch (err) {
    return res.status(500).json({ detail: 'Not found' });
  }
});

/**
 * GET /api/players
 * Returns paginated list of players with their tiers (for public rankings).
 */
router.get('/players', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const mode = req.query.mode || '';
  const region = req.query.region || '';

  try {
    let whereClause = 'WHERE p.is_banned = FALSE';
    const params = [];
    let paramIdx = 1;

    if (search) {
      whereClause += ` AND p.username ILIKE $${paramIdx++}`;
      params.push(`%${search}%`);
    }
    if (region) {
      whereClause += ` AND p.region = $${paramIdx++}`;
      params.push(region);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM players p ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const exactMatchParam = search || '';
    const playersResult = await pool.query(
      `SELECT p.id, p.uuid, p.username, p.country_code, p.region, p.platform, p.last_active, p.skin_url
       FROM players p
       ${whereClause}
       ORDER BY CASE WHEN LOWER(p.username) = LOWER($${paramIdx++}) THEN 0 ELSE 1 END, p.username ASC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, exactMatchParam, limit, offset]
    );

    const playerIds = playersResult.rows.map(r => r.id);
    let tiersMap = {};

    if (playerIds.length > 0) {
      const tiersResult = await pool.query(
        `SELECT player_id, gamemode, tier, pos, peak_tier, peak_pos, attained, retired
         FROM player_tiers
         WHERE player_id = ANY($1)`,
        [playerIds]
      );
      for (const t of tiersResult.rows) {
        if (!tiersMap[t.player_id]) tiersMap[t.player_id] = {};
        tiersMap[t.player_id][t.gamemode] = {
          tier:      Number(t.tier),
          pos:       Number(t.pos),
          peak_tier: Number(t.peak_tier),
          peak_pos:  Number(t.peak_pos),
          attained:  Number(t.attained),
          retired:   t.retired === true || t.retired === 'true',
        };
      }
    }

    const players = playersResult.rows.map(p => ({
      ...p,
      rankings: tiersMap[p.id] || {},
    }));

    return res.json({ players, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('GET /api/players error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/leaderboard
 * Top players by overall points.
 */
router.get('/leaderboard', async (req, res) => {
  const mode = req.query.mode || '';
  const region = req.query.region || '';
  const limit = Math.min(50000, parseInt(req.query.limit) || 50000);

  // Points map: tier 1 HT=60, LT=45, tier2 HT=30, LT=20, etc.
  const POINTS = {
    '1_0': 60, '1_1': 45,
    '2_0': 30, '2_1': 20,
    '3_0': 10, '3_1': 6,
    '4_0': 4,  '4_1': 3,
    '5_0': 2,  '5_1': 1,
  };

  try {
    let whereClause = 'WHERE p.is_banned = FALSE';
    const params = [];
    let paramIdx = 1;

    if (region) {
      whereClause += ` AND p.region = $${paramIdx++}`;
      params.push(region);
    }

    const playersResult = await pool.query(
      `SELECT p.id, p.uuid, p.username, p.country_code, p.region, p.platform, p.bonus_points, p.skin_url
       FROM players p ${whereClause}`,
      params
    );

    const playerIds = playersResult.rows.map(r => r.id);
    if (playerIds.length === 0) return res.json([]);

    let tiersQuery = `SELECT player_id, gamemode, tier, pos FROM player_tiers WHERE player_id = ANY($1)`;
    const tiersParams = [playerIds];
    if (mode) {
      tiersQuery += ` AND gamemode = $2`;
      tiersParams.push(mode);
    }

    const tiersResult = await pool.query(tiersQuery, tiersParams);

    // Calculate points per player
    const pointsMap = {};
    for (const t of tiersResult.rows) {
      const key = `${t.tier}_${t.pos}`;
      const pts = POINTS[key] || 0;
      if (!pointsMap[t.player_id]) pointsMap[t.player_id] = { total: 0, modes: {} };
      pointsMap[t.player_id].modes[t.gamemode] = { tier: t.tier, pos: t.pos, points: pts };
      // Overall = sum of top 3 mode scores + bonus_points
      const modePoints = Object.values(pointsMap[t.player_id].modes).map(m => m.points).sort((a, b) => b - a);
      pointsMap[t.player_id].total = modePoints.slice(0, 3).reduce((a, b) => a + b, 0);
    }

    const ranked = playersResult.rows
      .filter(p => pointsMap[p.id])
      .map(p => ({
        ...p,
        points: (pointsMap[p.id]?.total || 0) + (p.bonus_points || 0),
        modes: pointsMap[p.id]?.modes || {},
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, limit)
      .map((p, i) => ({ ...p, rank: i + 1 }));

    return res.json(ranked);
  } catch (err) {
    console.error('GET /api/leaderboard error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/testers
 * Public testers list with their player tiers if UUID provided
 */
router.get('/testers', async (req, res) => {
  try {
    const testersRes = await pool.query(
      'SELECT id, username, uuid, skin_url, discord_id, role, specialties, is_online, is_active, joined_at, last_seen FROM testers WHERE is_active=TRUE ORDER BY is_online DESC, username ASC'
    );
    const testers = testersRes.rows;

    // For testers with UUID, fetch their tiers
    const uuids = testers.filter(t => t.uuid).map(t => t.uuid);
    let tiersMap = {};
    if (uuids.length) {
      const playersRes = await pool.query(
        `SELECT p.id, p.uuid, p.username, p.region, p.bonus_points,
                pt.gamemode, pt.tier, pt.pos
         FROM players p
         JOIN player_tiers pt ON pt.player_id = p.id
         WHERE p.uuid = ANY($1) AND p.is_banned = FALSE`,
        [uuids]
      );
      for (const row of playersRes.rows) {
        const key = row.uuid;
        if (!tiersMap[key]) tiersMap[key] = { region: row.region, bonus_points: row.bonus_points || 0, tiers: {} };
        tiersMap[key].tiers[row.gamemode] = { tier: row.tier, pos: row.pos };
      }
    }

    const POINTS = {'1_0':60,'1_1':45,'2_0':30,'2_1':20,'3_0':10,'3_1':6,'4_0':4,'4_1':3,'5_0':2,'5_1':1};

    const result = testers.map(t => {
      const pd = tiersMap[t.uuid] || null;
      let points = 0;
      if (pd) {
        const pts = Object.values(pd.tiers).map(x => POINTS[`${x.tier}_${x.pos}`]||0).sort((a,b)=>b-a);
        points = pts.slice(0,3).reduce((s,p)=>s+p,0) + (pd.bonus_points||0);
      }
      return {
        ...t,
        tiers: pd?.tiers || null,
        region: pd?.region || null,
        points,
      };
    });

    res.json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/discord-presence
 * Returns online status for testers with discord_id via Discord API
 */
router.get('/discord-presence', async (req, res) => {
  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const GUILD_ID  = process.env.DISCORD_GUILD_ID;

  if (!BOT_TOKEN || !GUILD_ID) {
    return res.json({}); // No bot configured — return empty, fallback to stored status
  }

  try {
    // Get all tester discord IDs
    const testersRes = await pool.query('SELECT discord_id FROM testers WHERE discord_id IS NOT NULL AND discord_id != \'\'');
    const ids = testersRes.rows.map(r => r.discord_id).filter(Boolean);
    if (!ids.length) return res.json({});

    const presence = {};

    // Fetch each member's presence from Discord
    await Promise.all(ids.map(async (id) => {
      try {
        const r = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${id}`, {
          headers: { Authorization: `Bot ${BOT_TOKEN}` }
        });
        if (!r.ok) { presence[id] = 'offline'; return; }

        // Get presence via guild member — need presence intent
        const presenceR = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/presences/${id}`, {
          headers: { Authorization: `Bot ${BOT_TOKEN}` }
        });
        if (presenceR.ok) {
          const pd = await presenceR.json();
          presence[id] = pd.status || 'offline';
        } else {
          presence[id] = 'offline';
        }
      } catch { presence[id] = 'offline'; }
    }));

    res.json(presence);
  } catch(e) {
    res.json({});
  }
});

/**
 * GET /api/stats
 * Site-wide stats for homepage counters.
 */
router.get('/stats', async (req, res) => {
  try {
    const [playersRes, tiersRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM players WHERE is_banned = FALSE'),
      pool.query('SELECT COUNT(*) FROM player_tiers'),
    ]);
    return res.json({
      players: parseInt(playersRes.rows[0].count),
      tiers_assigned: parseInt(tiersRes.rows[0].count),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
