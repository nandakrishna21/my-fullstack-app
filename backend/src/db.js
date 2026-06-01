import pkg from 'pg';
import 'dotenv/config';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Users table initialized');

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(50) NOT NULL,
        content TEXT,
        file_url VARCHAR(500),
        file_name VARCHAR(255),
        file_type VARCHAR(100),
        file_size INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Messages table initialized');
  } catch (err) {
    console.error('Failed to create messages table:', err.message);
  }
}

export default pool;
