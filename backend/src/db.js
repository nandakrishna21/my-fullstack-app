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
    );

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
    );

    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      username VARCHAR(50) NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(100) NOT NULL,
      file_size INTEGER NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('Database tables initialized');
}

export default pool;
