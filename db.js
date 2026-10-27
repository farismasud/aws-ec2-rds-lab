const mysql = require('mysql2/promise');
const { Pool } = require('pg');

const dialect = (process.env.DB_DIALECT || 'mysql').toLowerCase();
const host = process.env.DB_HOST || '';
const port = parseInt(process.env.DB_PORT || (dialect === 'postgres' || dialect === 'pg' ? '5432' : '3306'), 10);
const user = process.env.DB_USER || '';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || '';

let mysqlPool = null;
let pgPool = null;

function isConfigured() {
  return Boolean(host && user && database);
}

function getPool() {
  if (!isConfigured()) return null;

  if (dialect === 'postgres' || dialect === 'pg') {
    if (!pgPool) {
      pgPool = new Pool({
        host,
        port,
        user,
        password,
        database,
        connectionTimeoutMillis: 5000,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
      });
    }
    return { type: 'postgres', pool: pgPool };
  }

  if (!mysqlPool) {
    mysqlPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 5000,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });
  }
  return { type: 'mysql', pool: mysqlPool };
}

async function testConnection() {
  if (!isConfigured()) {
    return {
      connected: false,
      message: 'Database belum dikonfigurasi di file .env (DB_HOST, DB_USER, DB_NAME kosong)',
      dialect,
      host: host || 'none'
    };
  }

  const startTime = Date.now();
  try {
    const db = getPool();
    if (db.type === 'postgres') {
      const client = await db.pool.connect();
      try {
        const res = await client.query('SELECT NOW() as now, version() as version');
        const latency = Date.now() - startTime;
        return {
          connected: true,
          dialect: 'PostgreSQL',
          host,
          port,
          database,
          latencyMs: latency,
          serverTime: res.rows[0].now,
          version: res.rows[0].version
        };
      } finally {
        client.release();
      }
    } else {
      const [rows] = await db.pool.query('SELECT NOW() as now, VERSION() as version');
      const latency = Date.now() - startTime;
      return {
        connected: true,
        dialect: 'MySQL',
        host,
        port,
        database,
        latencyMs: latency,
        serverTime: rows[0].now,
        version: rows[0].version
      };
    }
  } catch (err) {
    return {
      connected: false,
      dialect,
      host,
      port,
      database,
      error: err.message,
      code: err.code || 'CONNECTION_ERROR'
    };
  }
}

async function initTable() {
  if (!isConfigured()) return false;
  const db = getPool();
  try {
    if (db.type === 'postgres') {
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS notes (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          content TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS notes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          content TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }
    return true;
  } catch (err) {
    console.error('Failed to init table:', err.message);
    return false;
  }
}

async function getNotes() {
  if (!isConfigured()) return [];
  const db = getPool();
  if (db.type === 'postgres') {
    const res = await db.pool.query('SELECT id, title, content, created_at FROM notes ORDER BY id DESC LIMIT 50');
    return res.rows;
  } else {
    const [rows] = await db.pool.query('SELECT id, title, content, created_at FROM notes ORDER BY id DESC LIMIT 50');
    return rows;
  }
}

async function createNote(title, content) {
  if (!isConfigured()) throw new Error('Database belum terhubung');
  const db = getPool();
  if (db.type === 'postgres') {
    const res = await db.pool.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING id, title, content, created_at',
      [title, content]
    );
    return res.rows[0];
  } else {
    const [result] = await db.pool.query(
      'INSERT INTO notes (title, content) VALUES (?, ?)',
      [title, content]
    );
    return { id: result.insertId, title, content, created_at: new Date() };
  }
}

async function deleteNote(id) {
  if (!isConfigured()) throw new Error('Database belum terhubung');
  const db = getPool();
  if (db.type === 'postgres') {
    await db.pool.query('DELETE FROM notes WHERE id = $1', [id]);
  } else {
    await db.pool.query('DELETE FROM notes WHERE id = ?', [id]);
  }
  return true;
}

module.exports = {
  isConfigured,
  testConnection,
  initTable,
  getNotes,
  createNote,
  deleteNote
};
