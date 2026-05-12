/**
 * botSync.js
 * Periodically fetches all player + tier data from the Discord bot plugin's
 * REST API and upserts it into the website's PostgreSQL database.
 *
 * Bot API base: http://paid10.skilloraclouds.site:20004
 * Endpoints used:
 *   GET /api/players   → { players: [{ ign, tiers: { "axe-and-shield": "HT2", ... } }] }
 *
 * Runs every BOT_SYNC_INTERVAL_MS (default: 5 minutes).
 */

const pool = require('../db/pool');
const crypto = require('crypto');

const BOT_API_BASE = process.env.BOT_API_URL || 'http://paid10.skilloraclouds.site:20004';
const SYNC_INTERVAL = parseInt(process.env.BOT_SYNC_INTERVAL_MS) || 5 * 60 * 1000; // 5 min

// ─── GAMEMODE MAPPING ─────────────────────────────────────────────────────────
// Bot gamemode keys  →  website gamemode keys
const GAMEMODE_MAP = {
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

// ─── TIER PARSING ─────────────────────────────────────────────────────────────
// Bot tier string "HT1"/"LT2" → { tier: 1, pos: 0/1 }
function parseTier(tierStr) {
  if (!tierStr) return null;
  const match = tierStr.toUpperCase().match(/^(HT|LT)(\d)$/);
  if (!match) return null;
  return {
    tier: parseInt(match[2]),        // 1–5
    pos:  match[1] === 'HT' ? 0 : 1, // 0 = HT, 1 = LT
  };
}

// ─── UUID HELPERS ─────────────────────────────────────────────────────────────

// Fetch real UUID from Mojang (premium/Java players)
async function fetchMojangUUID(username) {
  try {
    const res = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.id) return null;
    const id = data.id;
    return `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}`;
  } catch {
    return null;
  }
}

// Generate offline/cracked UUID (same algorithm Minecraft uses for offline mode)
function offlineUUID(username) {
  const hash = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x30; // version 3
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant
  const h = hash.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// ─── CORE SYNC LOGIC ──────────────────────────────────────────────────────────

async function syncFromBot() {
  const startTime = Date.now();
  console.log(`[BotSync] Starting sync from ${BOT_API_BASE}/api/players ...`);

  let data;
  try {
    const res = await fetch(`${BOT_API_BASE}/api/players`, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'PrimeTiersWebsite/1.0' },
    });
    if (!res.ok) {
      console.error(`[BotSync] Bot API returned HTTP ${res.status}`);
      return;
    }
    data = await res.json();
  } catch (err) {
    console.error(`[BotSync] Failed to reach bot API: ${err.message}`);
    return;
  }

  const players = data?.players;
  if (!Array.isArray(players) || players.length === 0) {
    console.log('[BotSync] No players returned from bot API.');
    return;
  }

  let created = 0;
  let updated = 0;
  let tiersUpserted = 0;
  let skipped = 0;

  for (const entry of players) {
    const ign = entry.ign?.trim();
    const tiers = entry.tiers; // { "axe-and-shield": "HT2", ... }
    const skinUrl = entry.skin_url || '';

    if (!ign || !tiers || Object.keys(tiers).length === 0) {
      skipped++;
      continue;
    }

    try {
      // ── 1. Find or create player ────────────────────────────────────────
      let playerRow = await pool.query(
        `SELECT id FROM players WHERE username ILIKE $1 LIMIT 1`,
        [ign]
      );

      let playerId;

      if (playerRow.rows.length > 0) {
        playerId = playerRow.rows[0].id;
        // Update skin if provided
        if (skinUrl) {
          await pool.query(
            `UPDATE players SET skin_url = $1, last_active = NOW() WHERE id = $2 AND (skin_url IS NULL OR skin_url = '')`,
            [skinUrl, playerId]
          );
        } else {
          await pool.query(`UPDATE players SET last_active = NOW() WHERE id = $1`, [playerId]);
        }
        updated++;
      } else {
        // New player — fetch UUID from Mojang
        let uuid = await fetchMojangUUID(ign);
        let platform = 'Java';
        let resolvedSkin = skinUrl || '';

        if (!uuid) {
          // Cracked / offline player
          uuid = offlineUUID(ign);
          platform = 'Cracked';
          console.log(`[BotSync] "${ign}" not on Mojang — using offline UUID`);
        }

        const inserted = await pool.query(
          `INSERT INTO players (uuid, username, platform, region, skin_url)
           VALUES ($1, $2, $3, 'NA', $4)
           ON CONFLICT (uuid) DO UPDATE
             SET username = EXCLUDED.username,
                 skin_url = COALESCE(NULLIF(EXCLUDED.skin_url,''), players.skin_url),
                 last_active = NOW()
           RETURNING id`,
          [uuid, ign, platform, resolvedSkin]
        );
        playerId = inserted.rows[0].id;
        created++;
        console.log(`[BotSync] Created player "${ign}" (${platform}, id=${playerId})`);
      }

      // ── 2. Upsert each tier ─────────────────────────────────────────────
      for (const [botGamemode, tierStr] of Object.entries(tiers)) {
        const websiteGamemode = GAMEMODE_MAP[botGamemode?.toLowerCase()];
        if (!websiteGamemode) continue;

        const parsed = parseTier(tierStr);
        if (!parsed) continue;

        const { tier, pos } = parsed;

        // Keep best peak
        const existingTier = await pool.query(
          `SELECT peak_tier, peak_pos FROM player_tiers WHERE player_id = $1 AND gamemode = $2`,
          [playerId, websiteGamemode]
        );

        let peakTier = tier;
        let peakPos  = pos;

        if (existingTier.rows.length > 0) {
          const ex = existingTier.rows[0];
          const isBetter =
            tier < ex.peak_tier ||
            (tier === ex.peak_tier && pos < ex.peak_pos);
          peakTier = isBetter ? tier : ex.peak_tier;
          peakPos  = isBetter ? pos  : ex.peak_pos;
        }

        await pool.query(
          `INSERT INTO player_tiers (player_id, gamemode, tier, pos, peak_tier, peak_pos, attained, retired)
           VALUES ($1, $2, $3, $4, $5, $6, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE)
           ON CONFLICT (player_id, gamemode) DO UPDATE SET
             tier       = EXCLUDED.tier,
             pos        = EXCLUDED.pos,
             peak_tier  = EXCLUDED.peak_tier,
             peak_pos   = EXCLUDED.peak_pos,
             attained   = EXCLUDED.attained,
             retired    = FALSE,
             updated_at = NOW()`,
          [playerId, websiteGamemode, tier, pos, peakTier, peakPos]
        );
        tiersUpserted++;
      }

    } catch (err) {
      console.error(`[BotSync] Error processing "${ign}": ${err.message}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[BotSync] Done in ${elapsed}s — ` +
    `${created} players created, ${updated} updated, ` +
    `${tiersUpserted} tiers upserted, ${skipped} skipped`
  );
}

// ─── START ────────────────────────────────────────────────────────────────────

function startBotSync() {
  const intervalMin = Math.round(SYNC_INTERVAL / 60000);
  console.log(`[BotSync] Sync enabled — running every ${intervalMin} min (bot: ${BOT_API_BASE})`);

  // Run immediately on startup, then on interval
  syncFromBot();
  setInterval(syncFromBot, SYNC_INTERVAL);
}

module.exports = { startBotSync, syncFromBot };
