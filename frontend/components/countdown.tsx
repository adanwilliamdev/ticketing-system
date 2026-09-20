'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

import { formatCountdown } from '@/lib/format';

/** Recalcula localmente a cada segundo a partir de `expiresAt`, sem repetir chamadas à API. */
export function Countdown({ expiresAt, onExpire }: { expiresAt: string; onExpire?: () => void }) {
  const [remaining, setRemaining] = useState(() => secondsUntil(expiresAt));

  useEffect(() => {
    setRemaining(secondsUntil(expiresAt));
    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = secondsUntil(expiresAt);
        if (next <= 0 && prev > 0) onExpire?.();
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const isUrgent = remaining <= 60;

  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${isUrgent ? 'text-destructive' : 'text-muted-foreground'}`}>
      <Clock className="h-4 w-4" />
      {remaining > 0 ? <span>Expira em {formatCountdown(remaining)}</span> : <span>Reserva expirada</span>}
    </div>
  );
}

function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}
