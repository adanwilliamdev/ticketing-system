// Contratos de acesso a dados. Ficam separados do driver `pg` para que repositórios e serviços
// possam ser testados com implementações em memória.

export interface QueryResultLike<R> {
  rows: R[];
  rowCount: number | null;
}

export interface Queryable {
  query<R = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<QueryResultLike<R>>;
}

export interface Database {
  /** Consultas fora de transação (usa o pool). */
  readonly pool: Queryable;
  /** Executa `fn` em uma transação: COMMIT se resolver, ROLLBACK se lançar. */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
