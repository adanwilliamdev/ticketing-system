export async function register(): Promise<void> {
  // Só no runtime Node (o Edge não tem pg/ioredis). Import dinâmico mantém esses módulos fora do bundle Edge.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundTasks } = await import('./lib/startup');
    await startBackgroundTasks();
  }
}
