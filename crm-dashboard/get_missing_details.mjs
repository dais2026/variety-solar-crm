import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const refs = ['1072180', '1072064', '1073699', '1073006'];
  
  for (const ref of refs) {
    const [rows] = await conn.query(
      "SELECT leadRef, leadName, leadEmail, leadPhone, leadAddress, leadSource, notes, importedAt FROM solar_quotes_imports WHERE leadRef = ?",
      [ref]
    );
    if (rows.length > 0) {
      const r = rows[0];
      console.log(`\n=== Lead Ref: ${r.leadRef} ===`);
      console.log(`Name: ${r.leadName}`);
      console.log(`Email: ${r.leadEmail}`);
      console.log(`Phone: ${r.leadPhone}`);
      console.log(`Address: ${r.leadAddress}`);
      console.log(`Source: ${r.leadSource}`);
      console.log(`ImportedAt: ${r.importedAt} (${new Date(Number(r.importedAt)).toISOString()})`);
      console.log(`Notes: ${r.notes?.substring(0, 300)}`);
    } else {
      console.log(`\n=== Lead Ref: ${ref} === NOT FOUND`);
    }
  }
  
  await conn.end();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
