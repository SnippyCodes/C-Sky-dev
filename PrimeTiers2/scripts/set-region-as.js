/**
 * set-region-as.js
 * Sets region = 'AS' for ALL players in website DB that have region = 'NA' or NULL
 */

require('dotenv').config();
const pool = require('../server/db/pool');

async function main() {
  // Check current regions
  const before = await pool.query(
    `SELECT region, COUNT(*) as count FROM players GROUP BY region ORDER BY count DESC`
  );
  console.log('Current regions:');
  before.rows.forEach(r => console.log(`  ${r.region || 'NULL'}: ${r.count}`));

  // Update all players to AS
  const res = await pool.query(
    `UPDATE players SET region = 'AS' WHERE region IS NULL OR region = '' OR region = 'NA'`
  );

  console.log(`\n✅ Updated ${res.rowCount} players → region = 'AS'`);

  // Verify
  const after = await pool.query(
    `SELECT region, COUNT(*) as count FROM players GROUP BY region ORDER BY count DESC`
  );
  console.log('\nRegions after update:');
  after.rows.forEach(r => console.log(`  ${r.region || 'NULL'}: ${r.count}`));

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
