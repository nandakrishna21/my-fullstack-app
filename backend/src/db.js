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
      avatar_url VARCHAR(500),
      display_name VARCHAR(50),
      bio TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Users table initialized');

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(10) DEFAULT 'channel',
        participant_ids INTEGER[] DEFAULT '{}',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      INSERT INTO rooms (id, name, type) VALUES (1, 'General', 'channel') ON CONFLICT (id) DO NOTHING
    `);
    console.log('Rooms table initialized');
  } catch (err) {
    console.error('Failed to create rooms table:', err.message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        room_id INTEGER DEFAULT 1 REFERENCES rooms(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(50) NOT NULL,
        content TEXT,
        file_url VARCHAR(500),
        file_name VARCHAR(255),
        file_type VARCHAR(100),
        file_size INTEGER,
        reactions JSONB DEFAULT '{}',
        edited BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Messages table initialized');
  } catch (err) {
    console.error('Failed to create messages table:', err.message);
  }

  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(50)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`);
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'`);
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS room_id INTEGER DEFAULT 1`);
    await pool.query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS type VARCHAR(10) DEFAULT 'channel'`);
    await pool.query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS participant_ids INTEGER[] DEFAULT '{}'`);
    console.log('Schema migrations applied');
  } catch (err) {
    console.error('Schema migration error:', err.message);
  }
}

export default pool;
