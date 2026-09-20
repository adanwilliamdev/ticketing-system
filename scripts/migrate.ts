// npm run migrate — aplica as migrações pendentes sem subir o servidor Next.
import { loadConfig } from '../src/lib/config';
import { runMigrations } from '../src/lib/migrate';

try {
  process.loadEnvFile('.env');
} catch {
  // .env é opcional: os padrões batem com o docker-compose
}

runMigrations(loadConfig().databaseUrl)
  .then((applied) => {
    console.log(applied.length > 0 ? `Migrações aplicadas: ${applied.join(', ')}` : 'Banco já está atualizado');
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
