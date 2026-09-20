# Ticketing System — Frontend (Next.js 16)

Conversão do front-end original para **Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui e
TanStack Query**, consumindo o backend FastAPI via `NEXT_PUBLIC_API_URL`.

## Como executar

```bash
npm install
cp .env.example .env.local   # aponte para o backend (padrão: http://localhost:8000)
npm run dev
```

Abra `http://localhost:3000`.

### Verificado neste ambiente
`npm install`, `npx tsc --noEmit` e `npx next build` rodaram sem erros; as três páginas
(`/`, `/events/[id]`, `/reservations/[token]`) foram exercitadas de ponta a ponta contra o
backend real (Postgres + Redis) durante o desenvolvimento.

## Estrutura

```
app/
  layout.tsx                  # layout raiz + <Providers> (TanStack Query)
  page.tsx                     # lista de eventos
  events/[id]/page.tsx          # detalhe do evento (Server Component) + mapa de assentos
  reservations/[token]/page.tsx  # reserva: contagem regressiva + pagamento
components/
  ui/                            # primitivos shadcn/ui (button, card, badge, input, ...)
  event-list.tsx                  # grid de eventos (useQuery)
  seat-map.tsx                     # mapa de assentos + formulário de reserva (useQuery/useMutation)
  countdown.tsx                     # cronômetro local a partir de expiresAt
  payment-panel.tsx                  # formulário de pagamento (useMutation)
  state-message.tsx                   # estados de loading/erro compartilhados
lib/
  api.ts                                # cliente HTTP para o backend FastAPI
  types.ts                               # tipos espelhando app/schemas.py
  messages.ts                             # tradução das mensagens de erro da API
  format.ts, query-keys.ts, utils.ts
```

## Notas de conversão

* **TanStack Query** substitui o hook `useResource` do original: cache, `refetchInterval` para
  manter o mapa de assentos e a reserva atualizados, e invalidação de cache após reservar/pagar/cancelar.
* **shadcn/ui + Tailwind v4**: tema definido via CSS variables/`@theme` em `app/globals.css`
  (sem `tailwind.config.ts`, conforme o padrão do Tailwind v4).
* **Idempotência do pagamento**: a chave é gerada uma vez por sessão de pagamento
  (`useState(generateIdempotencyKey)`) — reenviar após uma falha usa a mesma chave.
* **Contagem regressiva**: calculada no cliente a partir de `expiresAt`, sem repetir chamadas à
  API a cada segundo.
