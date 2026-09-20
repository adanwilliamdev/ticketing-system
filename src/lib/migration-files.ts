// Parte pura do runner de migrações (sem driver de banco): descoberta de arquivos e checksum.
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';

const FILE_PATTERN = /^V(\d+)__(.+)\.sql$/;

export interface MigrationFile {
  version: number;
  description: string;
  filename: string;
}

export async function listMigrations(dir: string): Promise<MigrationFile[]> {
  const names = await readdir(dir);
  const files: MigrationFile[] = [];
  for (const filename of names) {
    const match = FILE_PATTERN.exec(filename);
    if (match) files.push({ version: Number(match[1]), description: (match[2] ?? '').replaceAll('_', ' '), filename });
  }
  return files.sort((a, b) => a.version - b.version);
}

/** Normaliza quebras de linha para que o checksum não mude entre Windows (CRLF) e Linux (LF). */
export function checksum(sql: string): string {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}
