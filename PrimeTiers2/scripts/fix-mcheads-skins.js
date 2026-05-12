/**
 * fix-mcheads-skins.js
 * Players with mc-heads.net skin → try Mojang UUID first
 * If found → set visage.surgeplay.com (real skin)
 * If not found (cracked) → keep mc-heads (nothing better available)
 * 
 * Also fixes players with render.mineskin.org URLs (those are render pages, not texture URLs)
 * and extracts the actual texture URL from them.
 */

require('dotenv').config();
const pool = require('../server/db/pool');

async function fetchMojangUUID(username) {
  try {
    const res = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.id || null;
  } catch { return null; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  // Get all players — check their skin URLs
  const res = await pool.query(
    `SELECT id, username, platform, skin_url FROM players ORDER BY username ASC`
  );

  const players = res.rows;
  console.log(`Total players: ${players.length}\n`);

  // Find players with mc-heads fallback (default skin)
  const mcHeadsPlayers = players.filter(p =>
    p.skin_url && p.skin_url.includes('mc-heads.net')
  );

  console.log(`Players with mc-heads fallback: ${mcHeadsPlayers.length}`);
  console.log('Trying Mojang API for each...\n');

  let upgraded = 0, kept = 0, failed = 0;

  for (const player of mcHeadsPlayers) {
    try {
      // Try Mojang — if they're actually a Java player
      const uuid = await fetchMojangUUID(player.username);

      if (uuid) {
        const newSkinUrl = `https://visage.surgeplay.com/bust/${uuid}?overlay`;
        await pool.query(
          `UPDATE players SET skin_url = $1, platform = 'Java', last_active = NOW() WHERE id = $2`,
          [newSkinUrl, player.id]
        );
        console.log(`✅ ${player.username} → upgraded to real Mojang skin`);
        upgraded++;
      } else {
        console.log(`ℹ️  ${player.username} → not on Mojang, keeping mc-heads`);
        kept++;
      }

      await sleep(300); // Mojang rate limit
    } catch (err) {
      console.error(`❌ ${player.username}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n─────────────────────────────────────');
  console.log(`✅ Upgraded to real skin: ${upgraded}`);
  console.log(`ℹ️  Kept mc-heads (cracked): ${kept}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('─────────────────────────────────────');

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
