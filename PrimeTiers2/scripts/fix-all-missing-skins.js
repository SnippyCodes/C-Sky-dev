/**
 * fix-all-missing-skins.js
 * Finds ALL players in website DB with no skin_url
 * and sets skin based on platform:
 * - Java/Premium → Mojang UUID → visage.surgeplay.com bust
 * - Cracked → mc-heads.net avatar fallback
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
  // Get ALL players without skin
  const res = await pool.query(
    `SELECT id, username, platform, uuid FROM players WHERE skin_url IS NULL OR skin_url = '' ORDER BY username ASC`
  );

  const players = res.rows;
  console.log(`Found ${players.length} players without skin\n`);

  let updated = 0, failed = 0;

  for (const player of players) {
    try {
      let newSkinUrl = null;
      const isPremium = player.platform && player.platform.toLowerCase() !== 'cracked';

      if (isPremium) {
        // Try Mojang API first
        const uuid = await fetchMojangUUID(player.username);
        if (uuid) {
          newSkinUrl = `https://visage.surgeplay.com/bust/${uuid}?overlay`;
          console.log(`✅ ${player.username} (${player.platform}) → Mojang UUID skin`);
        } else {
          newSkinUrl = `https://mc-heads.net/avatar/${encodeURIComponent(player.username)}/64`;
          console.log(`⚠️  ${player.username} (${player.platform}) → mc-heads fallback`);
        }
        await sleep(300);
      } else {
        newSkinUrl = `https://mc-heads.net/avatar/${encodeURIComponent(player.username)}/64`;
        console.log(`ℹ️  ${player.username} (Cracked) → mc-heads`);
      }

      await pool.query(
        `UPDATE players SET skin_url = $1, last_active = NOW() WHERE id = $2`,
        [newSkinUrl, player.id]
      );
      updated++;

    } catch (err) {
      console.error(`❌ ${player.username}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n─────────────────────────────');
  console.log(`✅ Updated: ${updated}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log('─────────────────────────────');

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
