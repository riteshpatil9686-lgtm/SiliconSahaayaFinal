const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '1234',
    port: 5432,
  });
  
  await client.connect();
  try {
    await client.query('DROP DATABASE IF EXISTS silicon_sahaaya');
    await client.query('CREATE DATABASE silicon_sahaaya');
    console.log('Database created');
  } catch(e) {
    console.log('DB create error:', e.message);
  }
  await client.end();
  
  const client2 = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'silicon_sahaaya',
    password: '1234',
    port: 5432,
  });
  await client2.connect();
  
  let sql = fs.readFileSync('seed.sql', 'utf8');
  // Remove psql commands and database creation
  sql = sql.replace(/\\c silicon_sahaaya;/g, '');
  sql = sql.replace(/DROP DATABASE IF EXISTS silicon_sahaaya;/g, '');
  sql = sql.replace(/CREATE DATABASE silicon_sahaaya;/g, '');
  sql = sql.replace(/'u0000000/g, "'00000000");
  // Remove the DO block that inserts complaints
  sql = sql.replace(/DO \$\$[\s\S]*?END \$\$;/g, '');
  // Remove Timeline entries inserts
  sql = sql.replace(/INSERT INTO complaint_timeline[\s\S]*?LIMIT \d+;/g, '');
  // Remove Resolutions for dummy complaints
  sql = sql.replace(/INSERT INTO resolutions \([\s\S]*?LIMIT 150;/g, '');
  
  try {
    await client2.query(sql);
    console.log('Seed executed successfully');
  } catch(e) {
    console.log('Seed execution error:', e.message);
  }
  await client2.end();
}
run();
