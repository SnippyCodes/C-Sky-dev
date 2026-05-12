/**
 * sync-skins.js
 * 
 * Usage:
 *   1. Copy registrations.yml content into skin.yml (same folder as this script)
 *   2. Run: node scripts/sync-skins.js
 * 
 * What it does:
 *   - Reads skin.yml (registrations.yml format)
 *   - For each player with a skin_url, finds them in website DB by IGN
 *   - Updates skin_url ONLY if they don't already have one (skips existing)
 *   - Logs results
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../server/db/pool');

// ─── YAML PARSER (simple, no deps needed) ────────────────────────────────────
function parseRegistrationsYml(content) {
  const players = [];
  const lines = content.split('\n');
  
  let currentUserId = null;
  let currentData = {};
  let inProfiles = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === 'profiles:') {
      inProfiles = true;
      continue;
    }

    if (!inProfiles) continue;

    // Top-level user ID under profiles (2 spaces indent)
    const userIdMatch = line.match(/^  (\d+):$/);
    if (userIdMatch) {
      // Save previous player
      if (currentUserId && currentData.ign) {
        players.push({ userId: currentUserId, ...currentData });
      }
      currentUserId = userIdMatch[1];
      currentData = {};
      continue;
    }

    // Fields under user (4 spaces indent)
    if (currentUserId) {
      const fieldMatch = line.match(/^    ([a-z-]+):\s*"?([^"]*)"?\s*$/);
      if (fieldMatch) {
        const key = fieldMatch[1];
        const value = fieldMatch[2].trim();
        if (key === 'ign') currentData.ign = value;
        if (key === 'skin-url') currentData.skinUrl = value;
        if (key === 'account-type') currentData.accountType = value;
      }
    }
  }

  // Save last player
  if (currentUserId && currentData.ign) {
    players.push({ userId: currentUserId, ...currentData });
  }

  return players;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const ymlPath = path.join(__dirname, 'skin.yml');
  
  if (!fs.existsSync(ymlPath)) {
    console.error('❌ skin.yml not found! Create scripts/skin.yml and paste registrations.yml content into it.');
    process.exit(1);
  }

  const content = fs.readFileSync(ymlPath, 'utf8');
  const players = parseRegistrationsYml(content);
  
  console.log(`📋 Found ${players.length} players in skin.yml`);
  
  const withSkin = players.filter(p => p.skinUrl && p.skinUrl.trim() !== '');
  const withoutSkin = players.filter(p => !p.skinUrl || p.skinUrl.trim() === '');
  
  console.log(`🎨 Players with skin URL: ${withSkin.length}`);
  console.log(`❓ Players without skin URL: ${withoutSkin.length}`);
  console.log('');

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const player of withSkin) {
    try {
      // Find player in DB by IGN
      const res = await pool.query(
        `SELECT id, username, skin_url FROM players WHERE username ILIKE $1 LIMIT 1`,
        [player.ign]
      );

      if (res.rows.length === 0) {
        console.log(`⚠️  Not found in DB: ${player.ign}`);
        notFound++;
        continue;
      }

      const dbPlayer = res.rows[0];

      // Skip if already has skin
      if (dbPlayer.skin_url && dbPlayer.skin_url.trim() !== '') {
        console.log(`⏭️  Skip (already has skin): ${player.ign}`);
        skipped++;
        continue;
      }

      // Update skin
      await pool.query(
        `UPDATE players SET skin_url = $1, last_active = NOW() WHERE id = $2`,
        [player.skinUrl.trim(), dbPlayer.id]
      );

      console.log(`✅ Updated skin for: ${player.ign}`);
      updated++;

    } catch (err) {
      console.error(`❌ Error for ${player.ign}: ${err.message}`);
    }
  }

  console.log('');
  console.log('─────────────────────────────');
  console.log(`✅ Updated:   ${updated}`);
  console.log(`⏭️  Skipped:   ${skipped} (already had skin)`);
  console.log(`⚠️  Not found: ${notFound} (not in website DB)`);
  console.log('─────────────────────────────');

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
