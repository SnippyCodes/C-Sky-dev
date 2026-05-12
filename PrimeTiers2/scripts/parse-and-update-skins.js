/**
 * parse-and-update-skins.js
 * Reads skin.yml, parses IGN + skin_url, updates website DB.
 * Skips players who already have a skin. Skips invalid/junk skin URLs.
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('../server/db/pool');

// ─── VALID SKIN URL CHECK ─────────────────────────────────────────────────────
function isValidSkinUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  if (u === '' || u === "''" || u === '""') return false;

  // Must start with http/https
  if (!u.startsWith('http://') && !u.startsWith('https://')) return false;

  // Known junk patterns to skip
  const junk = [
    'google.com/search', 'discord.com/channels', 'share.google',
    'minecraft.wiki', 'gamepedia', 'planetminecraft.com/skin/',
    'data:image', 'blob:', 'content://', 'tlauncher.org/catalog/skins/13',
    'kommodo.ai', 'ibb.co', 'imgur.com/DA0', 'i.imgur.com/Xh6',
    'tse2.mm.bing', 'encrypted-tbn0', 'images-ext-1.discordapp',
    'xyrios.com', 'skinmc.net/profile/ItzRealMe',
    'minecraft.novaskin.me/post/1002883041', // broken novaskin
    'minotar.net/skin/Dream', // generic
    'minotar.net/skin/Dreamupdate', // broken
    'novask.in/t/skeppy', // generic
    'minecraft.novaskin.me/player/', // profile page not skin
    'minecraft.novaskin.me/post/hnH9jwX9mqq1AuhebPU4/flamefrags', // generic
    'skins4minecraft.com/alex', // generic
    'static.planetminecraft.com/files/resource_media/skin/steve',
    'minecraft.wiki/images/thumb/Alex',
    'www.minecraftskins.net/static/preview/elderlysteve',
    'gamepedia.cursecdn.com/minecraft_gamepedia/d/d7/Steve',
  ];

  for (const j of junk) {
    if (u.includes(j)) return false;
  }

  return true;
}

// ─── PARSE REGISTRATIONS YML ─────────────────────────────────────────────────
function parseRegistrationsYml(content) {
  const players = [];
  const lines = content.replace(/\r/g, '').split('\n');

  let currentIgn    = null;
  let currentSkin   = null;
  let inProfiles    = false;
  let inEntry       = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === 'profiles:') {
      inProfiles = true;
      continue;
    }
    if (!inProfiles) continue;

    // New profile entry — 2 spaces + quoted/unquoted ID
    if (/^  ['"]?\d{15,20}['"]?:/.test(line)) {
      // Save previous
      if (currentIgn) {
        players.push({ ign: currentIgn, skinUrl: currentSkin || '' });
      }
      currentIgn  = null;
      currentSkin = null;
      inEntry     = true;
      continue;
    }

    if (!inEntry) continue;

    // 4-space indented fields
    const ignMatch  = line.match(/^    ign:\s*(.+)$/);
    const skinMatch = line.match(/^    skin-url:\s*(.*)$/);

    if (ignMatch) {
      currentIgn = ignMatch[1].trim().replace(/^['"]|['"]$/g, '');
    }
    if (skinMatch) {
      currentSkin = skinMatch[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }

  // Save last entry
  if (currentIgn) {
    players.push({ ign: currentIgn, skinUrl: currentSkin || '' });
  }

  return players;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const ymlPath = path.join(__dirname, 'skin.yml');
  
  if (!fs.existsSync(ymlPath)) {
    console.error('❌ skin.yml not found!');
    process.exit(1);
  }

  const content = fs.readFileSync(ymlPath, 'utf8');
  const players = parseRegistrationsYml(content);
  
  console.log(`📋 Parsed ${players.length} players from skin.yml`);
  
  const withSkin    = players.filter(p => isValidSkinUrl(p.skinUrl));
  const withoutSkin = players.filter(p => !isValidSkinUrl(p.skinUrl));
  
  console.log(`✅ Valid skin URLs: ${withSkin.length}`);
  console.log(`⏭️  Invalid/missing skin URLs: ${withoutSkin.length}`);
  console.log('');

  let updated   = 0;
  let skipped   = 0;
  let notFound  = 0;

  for (const player of withSkin) {
    try {
      const res = await pool.query(
        `SELECT id, username, skin_url FROM players WHERE username ILIKE $1 LIMIT 1`,
        [player.ign]
      );

      if (res.rows.length === 0) {
        notFound++;
        continue;
      }

      const dbPlayer = res.rows[0];

      // Skip if already has a skin
      if (dbPlayer.skin_url && dbPlayer.skin_url.trim() !== '') {
        skipped++;
        continue;
      }

      // Update skin
      await pool.query(
        `UPDATE players SET skin_url = $1, last_active = NOW() WHERE id = $2`,
        [player.skinUrl, dbPlayer.id]
      );

      console.log(`✅ ${player.ign} → skin updated`);
      updated++;

    } catch (err) {
      console.error(`❌ Error for ${player.ign}: ${err.message}`);
    }
  }

  console.log('');
  console.log('─────────────────────────────────────');
  console.log(`✅ Updated:    ${updated}`);
  console.log(`⏭️  Skipped:    ${skipped} (already had skin)`);
  console.log(`⚠️  Not found:  ${notFound} (not in website DB)`);
  console.log('─────────────────────────────────────');

  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
