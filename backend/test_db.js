const { Client } = require('pg');

async function testPassword(password) {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: password,
    port: 5432,
  });
  
  try {
    await client.connect();
    console.log(`Success with password: "${password}"`);
    await client.end();
    return true;
  } catch (err) {
    // console.error(`Failed for "${password}": ${err.message}`);
    return false;
  }
}

async function run() {
  const passwords = ['postgres', 'root', 'admin', 'password', '123456', '', '1234'];
  for (let p of passwords) {
    const success = await testPassword(p);
    if (success) return;
  }
  console.log('No common passwords worked.');
}

run();
