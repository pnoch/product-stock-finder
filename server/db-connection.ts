import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: ReturnType<typeof mysql.createPool> | null = null;
let creatingPool: Promise<ReturnType<typeof mysql.createPool>> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
// Drizzle's mysql2 driver resolves a delete to the raw mysql2 tuple
// `[ResultSetHeader, FieldPacket[]]`, so `.affectedRows` on the result itself is
// always undefined. Reading it directly made every batched purge stop after its
// first batch. Accept both shapes so a future driver change is still handled.
export function affectedRowsOf(result: unknown): number {
  if (Array.isArray(result)) {
    const header = result[0] as { affectedRows?: unknown } | undefined;
    const n = Number(header?.affectedRows);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number((result as { affectedRows?: unknown })?.affectedRows);
  return Number.isFinite(n) ? n : 0;
}

export async function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!_pool) {
    if (!creatingPool) {
      creatingPool = (async () => {
        // Explicit pool bounds. mysql2's defaults are connectionLimit 10 with
        // an UNBOUNDED wait queue (queueLimit 0), so a burst of slow queries
        // piles up in memory without limit. Cap the queue so excess requests
        // fail fast instead of exhausting the process, and recycle idle
        // connections so a long-lived server does not hold stale ones.
        const pool = mysql.createPool({
          uri: url,
          connectionLimit: Number(process.env.DB_POOL_LIMIT ?? 10),
          queueLimit: Number(process.env.DB_QUEUE_LIMIT ?? 200),
          waitForConnections: true,
          maxIdle: Number(process.env.DB_POOL_LIMIT ?? 10),
          idleTimeout: 60_000,
          enableKeepAlive: true,
        });
        _pool = pool;
        return pool;
      })().finally(() => {
        creatingPool = null;
      });
    }
    await creatingPool;
  }
  try {
    _db = drizzle(_pool as never);
  } catch (error) {
    console.error("[Database] Failed to connect:", error);
    throw error;
  }
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_pool) {
    const pool = _pool;
    _pool = null;
    _db = null;
    await pool.end();
  }
}
