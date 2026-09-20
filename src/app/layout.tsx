import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Ingressos', template: '%s · Ingressos' },
  description: 'Escolha seu assento e garanta o ingresso antes que o prazo da reserva acabe.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            Ingressos
          </Link>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
