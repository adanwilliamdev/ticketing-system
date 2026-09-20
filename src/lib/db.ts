import { Pool, types } from 'pg';
import type { Database, Queryable, QueryResultLike } from './db-types';
import { log } from './logger';

// BIGSERIAL/BIGINT/COUNT chegam como string por padrão; os ids deste sistema cabem em number.
types.setTypeParser(20, (value: string) => Number.parseInt(value, 10));
// TIMESTAMP (sem fuso) é sempre gravado em UTC por este sistema → interpretar como UTC.
types.setTypeParser(1114, (value: string) => new Date(`${value.replace(' ', 'T')}Z`));

interface RawQuerier {
  query(text: string, values?: readonly unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
}

function toQueryable(raw: RawQuerier): Queryable {
  return {
    async query<R>(text: string, values?: readonly unknown[]): Promise<QueryResultLike<R>> {
      const result = await raw.query(text, values);
      return { rows: result.rows as R[], rowCount: result.rowCount };
    },
  };
}

export interface DatabaseOptions {
  connectionString: string;
  maxConnections: number;
}

export function createDatabase(options: DatabaseOptions): Database {
  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.maxConnections, // hikari.maximum-pool-size: 20
    idleTimeoutMillis: 600_000, // hikari.idle-timeout
    connectionTimeoutMillis: 30_000, // hikari.connection-timeout
  });

  pool.on('error', (error: Error) => log.error('Erro inesperado no pool do PostgreSQL', error));
  // Os timestamps do banco são "sem fuso"; fixar UTC na sessão mantém CURRENT_TIMESTAMP e os
  // triggers de updated_at coerentes com as datas que a aplicação grava.
  pool.on('connect', (client) => {
    client.query("SET TIME ZONE 'UTC'").catch((error: Error) => log.error('Falha ao fixar timezone da sessão', error));
  });

  return {
    pool: toQueryable(pool as unknown as RawQuerier),

    async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      let broken = false;
      try {
        await client.query('BEGIN');
        const result = await fn(toQueryable(client as unknown as RawQuerier));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          broken = true; // conexão em estado desconhecido: descartar em vez de devolver ao pool
          log.error('Falha no ROLLBACK', rollbackError);
        }
        throw error;
      } finally {
        client.release(broken);
      }
    },

    async close(): Promise<void> {
      await pool.end();
    },
  };
}
