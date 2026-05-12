const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');

// ─── SKIN RESOLUTION HELPERS ─────────────────────────────────────────────────
// Crafatar is DOWN (521). We use:
//   Head:  https://mc-heads.net/avatar/{username}/64        (always works)
//   Bust:  https://nmsr.nickac.dev/bust/{textureHash}       (3D render, needs hash)
//   Bust fallback: https://mc-heads.net/body/{username}/100
//
// We store skin_url as:  "mcskin:{username}:{textureHash}"
// textureHash comes from MineSkin API lookup.
// If no hash available, we store: "mcskin:{username}:"
// The client reads this format and builds the correct URLs.

/**
 * Fetch image bytes from a URL, following redirects.
 */
async function fetchImageBytes(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PrimeTiers/1.0)', 'Accept': 'image/png,image/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.warn('[fetchImageBytes] HTTP', res.status, 'for', url); return null; }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 100) { console.warn('[fetchImageBytes] Too small:', buffer.length); return null; }
    return buffer;
  } catch (err) { console.warn('[fetchImageBytes] Error:', err.message); return null; }
}

/**
 * Upload skin PNG bytes to MineSkin. Returns texture hash string or null.
 */
async function uploadToMineSkin(imageBuffer) {
  try {
    const form = new FormData();
    form.append('file', new Blob([imageBuffer], { type: 'image/png' }), 'skin.png');
    form.append('visibility', '1');
    const res = await fetch('https://api.mineskin.org/generate/upload', {
      method: 'POST', headers: { 'User-Agent': 'PrimeTiers/1.0' }, body: form,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { console.warn('[MineSkin] Upload HTTP', res.status); return null; }
    const data = await res.json();
    // Extract texture hash from the texture value (base64 JSON)
    const textureValue = data?.data?.texture?.value;
    if (textureValue) {
      try {
        const decoded = JSON.parse(Buffer.from(textureValue, 'base64').toString());
        const textureUrl = decoded?.textures?.SKIN?.url || '';
        const hashMatch = textureUrl.match(/texture\/([a-f0-9]{64})/i);
        if (hashMatch) { console.log('[MineSkin] Texture hash:', hashMatch[1]); return hashMatch[1]; }
      } catch(e) {}
    }
    console.warn('[MineSkin] No texture hash in response');
    return null;
  } catch (err) { console.warn('[MineSkin] Upload error:', err.message); return null; }
}

/**
 * Resolve a cracked player skin.
 * Stores result as "mcskin:{username}:{textureHash}" or "mcskin:{username}:"
 * Returns { url: "mcskin:...", source }
 */
async function resolveCrackedSkin(skinImageUrl, username) {
  let textureHash = null;

  // ── minesk.in / mineskin.org short URL → API lookup ───────────────────────
  const hashMatch = skinImageUrl.match(/(?:minesk\.in|mineskin\.org)\/([a-f0-9]{32})/i);
  if (hashMatch) {
    try {
      const r = await fetch(`https://api.mineskin.org/get/uuid/${hashMatch[1]}`, {
        headers: { 'User-Agent': 'PrimeTiers/1.0' }, signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const data = await r.json();
        const textureValue = data?.data?.texture?.value;
        if (textureValue) {
          const decoded = JSON.parse(Buffer.from(textureValue, 'base64').toString());
          const tUrl = decoded?.textures?.SKIN?.url || '';
          const m = tUrl.match(/texture\/([a-f0-9]{64})/i);
          if (m) { textureHash = m[1]; console.log('[MineSkin] Hash lookup texture:', textureHash); }
        }
      }
    } catch (err) { console.warn('[MineSkin] Hash lookup error:', err.message); }
  }

  // ── Raw PNG URL → fetch → upload ──────────────────────────────────────────
  if (!textureHash && skinImageUrl && !hashMatch) {
    const buf = await fetchImageBytes(skinImageUrl);
    if (buf) textureHash = await uploadToMineSkin(buf);
  }

  const stored = `mcskin:${username}:${textureHash || ''}`;
  return { url: stored, source: textureHash ? 'mineskin' : 'mc-heads' };
}

const VALID_MODES = ['crystal', 'sword', 'uhc', 'pot', 'neth_pot', 'smp', 'axe', 'mace'];


// ─── SKIN RESOLUTION ENDPOINT ────────────────────────────────────────────────

/**
 * POST /api/admin/resolve-skin
 * Body: { skin_url: string, username: string }
 * Resolves a skin URL (minesk.in, direct PNG, etc.) to a texture hash.
 * Returns: { hash: string|null, source: string }
 */
router.post('/resolve-skin', requireAdmin, async (req, res) => {
  const { skin_url, username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  if (!skin_url) return res.json({ hash: null, source: 'none' });

  let textureHash = null;
  let source = 'none';

  console.log('[resolve-skin] Resolving:', skin_url.slice(0, 80), 'for', username);

  // 1. textures.minecraft.net — extract hash directly, no upload needed
  const mojangHashMatch = skin_url.match(/textures\.minecraft\.net\/texture\/([a-f0-9]{64})/i);
  if (mojangHashMatch) {
    textureHash = mojangHashMatch[1];
    source = 'mojang-direct';
    console.log('[resolve-skin] Mojang texture hash direct:', textureHash);
    return res.json({ hash: textureHash, source });
  }

  // 2. minesk.in / mineskin.org hash URL → API lookup
  const hashMatch = skin_url.match(/(?:minesk\.in|mineskin\.org)\/([a-f0-9]{32})/i);
  if (hashMatch) {
    try {
      const r = await fetch(`https://api.mineskin.org/get/uuid/${hashMatch[1]}`, {
        headers: { 'User-Agent': 'PrimeTiers/1.0' }, signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const data = await r.json();
        const textureValue = data?.data?.texture?.value;
        if (textureValue) {
          const decoded = JSON.parse(Buffer.from(textureValue, 'base64').toString());
          const tUrl = decoded?.textures?.SKIN?.url || '';
          const m = tUrl.match(/texture\/([a-f0-9]{64})/i);
          if (m) {
            textureHash = m[1];
            source = 'mineskin-lookup';
            console.log('[resolve-skin] minesk.in hash:', textureHash);
            return res.json({ hash: textureHash, source });
          }
        }
      }
      console.warn('[resolve-skin] minesk.in API status:', r.status);
    } catch (err) { console.warn('[resolve-skin] minesk.in error:', err.message); }
  }

  // 3. Any other URL (direct PNG) → fetch bytes → upload to MineSkin
  const buf = await fetchImageBytes(skin_url);
  if (buf) {
    console.log('[resolve-skin] Fetched', buf.length, 'bytes, uploading to MineSkin...');
    textureHash = await uploadToMineSkin(buf);
    if (textureHash) {
      source = 'mineskin-upload';
      console.log('[resolve-skin] Uploaded, hash:', textureHash);
    } else {
      console.warn('[resolve-skin] MineSkin upload returned no hash');
    }
  } else {
    console.warn('[resolve-skin] Could not fetch image from URL');
  }

  return res.json({ hash: textureHash, source });
});

// ─── AUTH ────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/login
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const admin = result.rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.adminId = admin.id;
    req.session.adminUsername = admin.username;
    return res.json({ success: true, username: admin.username });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/logout
 */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

/**
 * GET /api/admin/me
 */
router.get('/me', requireAdmin, (req, res) => {
  res.json({ username: req.session.adminUsername });
});

// ─── PLAYERS ─────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/players
 */
router.get('/players', requireAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 25);
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  try {
    let where = '';
    const params = [];
    if (search) {
      where = 'WHERE username ILIKE $1 OR uuid ILIKE $1';
      params.push(`%${search}%`);
    }

    const countRes = await pool.query(`SELECT COUNT(*) FROM players ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    const playersRes = await pool.query(
      `SELECT id, uuid, username, country_code, region, platform, is_banned, created_at, last_active, skin_url
       FROM players ${where}
       ORDER BY username ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const playerIds = playersRes.rows.map(r => r.id);
    let tiersMap = {};
    if (playerIds.length > 0) {
      const tiersRes = await pool.query(
        'SELECT player_id, gamemode, tier, pos, peak_tier, peak_pos, attained, retired FROM player_tiers WHERE player_id = ANY($1)',
        [playerIds]
      );
      for (const t of tiersRes.rows) {
        if (!tiersMap[t.player_id]) tiersMap[t.player_id] = {};
        tiersMap[t.player_id][t.gamemode] = t;
      }
    }

    const players = playersRes.rows.map(p => ({ ...p, tiers: tiersMap[p.id] || {} }));
    return res.json({ players, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('GET /api/admin/players error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/players
 * Create a new player.
 */
router.post('/players', requireAdmin, async (req, res) => {
  const { uuid, username, country_code = '', region = 'NA', platform = 'Java', skin_url = '' } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }
  // For cracked players uuid may be auto-generated — still must be provided by client
  if (!uuid) {
    return res.status(400).json({ error: 'uuid is required' });
  }
  const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    return res.status(400).json({ error: 'Invalid UUID format' });
  }

  // For cracked players the client sends skin_url already as "mcskin:{username}:{hash}"
  // No server-side resolution needed — just store it as-is
  const resolvedSkinUrl = skin_url || '';

  try {
    const result = await pool.query(
      `INSERT INTO players (uuid, username, country_code, region, platform, skin_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [uuid.toLowerCase(), username, country_code, region, platform, resolvedSkinUrl]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A player with this UUID already exists' });
    }
    console.error('POST /api/admin/players error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/players/:id
 */
router.get('/players/:id', requireAdmin, async (req, res) => {
  try {
    const playerRes = await pool.query('SELECT * FROM players WHERE id = $1', [req.params.id]);
    if (playerRes.rows.length === 0) return res.status(404).json({ error: 'Player not found' });

    const tiersRes = await pool.query(
      'SELECT * FROM player_tiers WHERE player_id = $1 ORDER BY gamemode',
      [req.params.id]
    );
    const historyRes = await pool.query(
      `SELECT th.*, a.username as changed_by_name
       FROM tier_history th
       LEFT JOIN admins a ON th.changed_by = a.id
       WHERE th.player_id = $1
       ORDER BY th.changed_at DESC LIMIT 50`,
      [req.params.id]
    );

    return res.json({
      ...playerRes.rows[0],
      tiers: tiersRes.rows,
      history: historyRes.rows,
    });
  } catch (err) {
    console.error('GET /api/admin/players/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/players/:id
 * Update player info.
 */
router.put('/players/:id', requireAdmin, async (req, res) => {
  const { username, country_code, region, platform, is_banned, notes, bonus_points, skin_url } = req.body;
  try {
    // skin_url: if explicitly sent (even empty string), update it. If not sent (undefined), keep existing.
    const skinUrlValue = skin_url !== undefined ? (skin_url || null) : undefined;
    const params = [username, country_code, region, platform, is_banned, notes, bonus_points ?? null, req.params.id];
    let query;
    if (skinUrlValue !== undefined) {
      // Include skin_url in update
      params.splice(7, 0, skinUrlValue); // insert before id
      query = `UPDATE players SET
        username = COALESCE($1, username),
        country_code = COALESCE($2, country_code),
        region = COALESCE($3, region),
        platform = COALESCE($4, platform),
        is_banned = COALESCE($5, is_banned),
        notes = COALESCE($6, notes),
        bonus_points = COALESCE($7, bonus_points),
        skin_url = $8,
        last_active = NOW()
       WHERE id = $9 RETURNING *`;
    } else {
      query = `UPDATE players SET
        username = COALESCE($1, username),
        country_code = COALESCE($2, country_code),
        region = COALESCE($3, region),
        platform = COALESCE($4, platform),
        is_banned = COALESCE($5, is_banned),
        notes = COALESCE($6, notes),
        bonus_points = COALESCE($7, bonus_points),
        last_active = NOW()
       WHERE id = $8 RETURNING *`;
    }
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/admin/players/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/players/:id/skin
 * Re-resolve and update a player's skin via MineSkin → SkinRestorer → mc-heads fallback.
 */
router.put('/players/:id/skin', requireAdmin, async (req, res) => {
  try {
    const playerRes = await pool.query('SELECT * FROM players WHERE id = $1', [req.params.id]);
    if (playerRes.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    const player = playerRes.rows[0];

    const rawSkinUrl = req.body.skin_url || player.skin_url || '';
    const { url: resolvedUrl, source } = await resolveCrackedSkin(rawSkinUrl, player.username);

    await pool.query('UPDATE players SET skin_url = $1 WHERE id = $2', [resolvedUrl, player.id]);
    console.log(`[Skin] Re-resolved for ${player.username} via ${source}: ${resolvedUrl}`);
    return res.json({ success: true, skin_url: resolvedUrl, source });
  } catch (err) {
    console.error('PUT /api/admin/players/:id/skin error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/players/:id
 */
router.delete('/players/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM players WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/players/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── TIERS ────────────────────────────────────────────────────────────────────

/**
 * PUT /api/admin/players/:id/tiers/:gamemode
 * Upsert a tier for a player in a specific gamemode.
 */
router.put('/players/:id/tiers/:gamemode', requireAdmin, async (req, res) => {
  const { gamemode } = req.params;
  const playerId = parseInt(req.params.id);

  if (!VALID_MODES.includes(gamemode)) {
    return res.status(400).json({ error: `Invalid gamemode. Valid: ${VALID_MODES.join(', ')}` });
  }

  const { tier, pos, retired = false, notes = '' } = req.body;

  if (tier === undefined || pos === undefined) {
    return res.status(400).json({ error: 'tier and pos are required' });
  }
  if (![1, 2, 3, 4, 5].includes(Number(tier))) {
    return res.status(400).json({ error: 'tier must be 1–5' });
  }
  if (![0, 1].includes(Number(pos))) {
    return res.status(400).json({ error: 'pos must be 0 (HT) or 1 (LT)' });
  }

  const tierNum = Number(tier);
  const posNum = Number(pos);

  try {
    // Check player exists
    const playerRes = await pool.query('SELECT id FROM players WHERE id = $1', [playerId]);
    if (playerRes.rows.length === 0) return res.status(404).json({ error: 'Player not found' });

    // Get existing tier to determine peak
    const existingRes = await pool.query(
      'SELECT * FROM player_tiers WHERE player_id = $1 AND gamemode = $2',
      [playerId, gamemode]
    );

    let peakTier = tierNum;
    let peakPos = posNum;

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      // Lower tier number = better rank; pos 0 (HT) > pos 1 (LT) at same tier
      const isBetter =
        tierNum < existing.peak_tier ||
        (tierNum === existing.peak_tier && posNum < existing.peak_pos);
      peakTier = isBetter ? tierNum : existing.peak_tier;
      peakPos = isBetter ? posNum : existing.peak_pos;

      // Log history
      await pool.query(
        `INSERT INTO tier_history (player_id, gamemode, old_tier, old_pos, new_tier, new_pos, changed_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [playerId, gamemode, existing.tier, existing.pos, tierNum, posNum, req.session.adminId, notes]
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const result = await pool.query(
      `INSERT INTO player_tiers (player_id, gamemode, tier, pos, peak_tier, peak_pos, attained, retired)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (player_id, gamemode) DO UPDATE SET
         tier = EXCLUDED.tier,
         pos = EXCLUDED.pos,
         peak_tier = EXCLUDED.peak_tier,
         peak_pos = EXCLUDED.peak_pos,
         attained = EXCLUDED.attained,
         retired = EXCLUDED.retired,
         updated_at = NOW()
       RETURNING *`,
      [playerId, gamemode, tierNum, posNum, peakTier, peakPos, now, retired]
    );

    // Update player last_active
    await pool.query('UPDATE players SET last_active = NOW() WHERE id = $1', [playerId]);

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/admin/players/:id/tiers/:gamemode error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/players/:id/tiers/:gamemode
 */
router.delete('/players/:id/tiers/:gamemode', requireAdmin, async (req, res) => {
  const { gamemode } = req.params;
  if (!VALID_MODES.includes(gamemode)) {
    return res.status(400).json({ error: 'Invalid gamemode' });
  }
  try {
    const result = await pool.query(
      'DELETE FROM player_tiers WHERE player_id = $1 AND gamemode = $2 RETURNING id',
      [req.params.id, gamemode]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tier not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE tier error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── TESTERS ─────────────────────────────────────────────────────────────────

router.get('/testers', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM testers ORDER BY is_active DESC, username ASC');
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/testers', requireAdmin, async (req, res) => {
  const { username, uuid='', skin_url='', discord_id='', role='Tester', specialties='', notes='' } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  try {
    const r = await pool.query(
      `INSERT INTO testers (username, uuid, skin_url, discord_id, role, specialties, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [username, uuid, skin_url, discord_id, role, specialties, notes]
    );
    res.status(201).json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/testers/:id', requireAdmin, async (req, res) => {
  const { username, uuid, skin_url, discord_id, role, specialties, is_online, is_active, notes } = req.body;
  try {
    const r = await pool.query(
      `UPDATE testers SET
        username=COALESCE($1,username), uuid=COALESCE($2,uuid),
        skin_url=COALESCE($3,skin_url), discord_id=COALESCE($4,discord_id),
        role=COALESCE($5,role), specialties=COALESCE($6,specialties),
        is_online=COALESCE($7,is_online), is_active=COALESCE($8,is_active),
        notes=COALESCE($9,notes), last_seen=NOW()
       WHERE id=$10 RETURNING *`,
      [username, uuid, skin_url, discord_id, role, specialties, is_online, is_active, notes, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/testers/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM testers WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN MANAGEMENT ────────────────────────────────────────────────────────

/**
 * POST /api/admin/change-password
 */
router.post('/change-password', requireAdmin, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Both current and new password required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  try {
    const adminRes = await pool.query('SELECT * FROM admins WHERE id = $1', [req.session.adminId]);
    const admin = adminRes.rows[0];
    const valid = await bcrypt.compare(current_password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [newHash, req.session.adminId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/stats
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [playersRes, tiersRes, historyRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM players WHERE is_banned = FALSE'),
      pool.query('SELECT COUNT(*) FROM player_tiers'),
      pool.query('SELECT COUNT(*) FROM tier_history WHERE changed_at > NOW() - INTERVAL \'7 days\''),
    ]);

    const modeStatsRes = await pool.query(
      `SELECT gamemode, COUNT(*) as count FROM player_tiers GROUP BY gamemode ORDER BY count DESC`
    );

    return res.json({
      total_players: parseInt(playersRes.rows[0].count),
      total_tiers: parseInt(tiersRes.rows[0].count),
      changes_this_week: parseInt(historyRes.rows[0].count),
      mode_breakdown: modeStatsRes.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
