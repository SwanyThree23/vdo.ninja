const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres', // Connect to default database first
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Setting up SwanyBot database...\n');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'swanybot';
    
    try {
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Created database: ${dbName}`);
    } catch (error) {
      if (error.code === '42P04') {
        console.log(`ℹ️ Database ${dbName} already exists`);
      } else {
        throw error;
      }
    }

    // Disconnect and reconnect to new database
    await client.release();
    await pool.end();

    // Connect to the new database
    const appPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: dbName,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    const appClient = await appPool.connect();

    // Run schema
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await appClient.query(schema);
    console.log('✅ Schema created successfully');

    // Create a test user
    const bcrypt = require('bcryptjs');
    const testPassword = await bcrypt.hash('password123', 10);
    
    try {
      await appClient.query(
        `INSERT INTO users (email, password_hash, username, full_name, credits)
         VALUES ($1, $2, $3, $4, $5)`,
        ['test@swanybot.com', testPassword, 'testuser', 'Test User', 500]
      );
      console.log('✅ Test user created');
      console.log('   Email: test@swanybot.com');
      console.log('   Password: password123');
    } catch (error) {
      if (error.code === '23505') {
        console.log('ℹ️ Test user already exists');
      } else {
        throw error;
      }
    }

    await appClient.release();
    await appPool.end();

    console.log('\n✅ Database setup complete!\n');
  } catch (error) {
    console.error('❌ Setup error:', error.message);
    process.exit(1);
  }
}

setupDatabase();