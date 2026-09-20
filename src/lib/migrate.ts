// Runner de migrações no estilo Flyway: arquivos V<versão>__<descrição>.sql em ordem numérica,
// cada um aplicado uma única vez em transação, com checksum e lock consultivo entre instâncias.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { log } from './logger';
import { checksum, listMigrations } from './migration-files';

const ADVISORY_LOCK_ID = 727_001; // arbitrário, só precisa ser estável

export async function runMigrations(databaseUrl: string, dir = path.join(process.cwd(), 'migrations')): Promise<string[]> {
  const files = await listMigrations(dir);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const appliedNow: string[] = [];

  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);

    const res = await client.query<{ version: number; checksum: string }>('SELECT version, checksum FROM schema_migrations');
    const applied = new Map<number, string>(res.rows.map((row) => [Number(row.version), row.checksum]));

    for (const file of files) {
      const sql = await readFile(path.join(dir, file.filename), 'utf8');
      const sum = checksum(sql);
      const previous = applied.get(file.version);

      if (previous !== undefined) {
        if (previous !== sum) throw new Error(`A migração ${file.filename} foi alterada depois de aplicada. Crie uma nova versão em vez de editá-la.`);
        continue;
      }

      log.info(`Aplicando migração ${file.filename}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version, description, checksum) VALUES ($1, $2, $3)', [file.version, file.description, sum]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Falha ao aplicar ${file.filename}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
      appliedNow.push(file.filename);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]).catch(() => undefined);
    await client.end();
  }
  return appliedNow;
}
