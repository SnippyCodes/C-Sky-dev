require('dotenv').config();
const pool = require('../server/db/pool');

async function main() {
  const total = await pool.query('SELECT COUNT(*) FROM players');
  const withSkin = await pool.query("SELECT COUNT(*) FROM players WHERE skin_url IS NOT NULL AND skin_url != ''");
  const noSkin = await pool.query("SELECT COUNT(*) FROM players WHERE skin_url IS NULL OR skin_url = ''");
  
  console.log('Total players:', total.rows[0].count);
  console.log('With skin:', withSkin.rows[0].count);
  console.log('Without skin:', noSkin.rows[0].count);
  
  const recent = await pool.query("SELECT username, platform, skin_url FROM players WHERE skin_url IS NOT NULL AND skin_url != '' ORDER BY last_active DESC LIMIT 10");
  console.log('\nRecently updated:');
  recent.rows.forEach(p => console.log(p.username, '(' + p.platform + ') ->', (p.skin_url||'').slice(0,70)));
  
  await pool.end();
}
main();
