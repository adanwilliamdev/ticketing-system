'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCountdown } from '@/lib/client/format';

interface CountdownProps {
  /** Instante (ms desde epoch, relógio do navegador) em que a reserva vence. */
  deadline: number;
  onExpire?: () => void;
}

export function Countdown({ deadline, onExpire }: CountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));

  useEffect(() => {
    if (remaining === 0 && !fired.current) {
      fired.current = true;
      onExpire?.();
    }
  }, [remaining, onExpire]);

  const urgent = remaining > 0 && remaining <= 60;
  return (
    <div className={urgent ? 'countdown countdown--urgent' : 'countdown'}>
      <span className="countdown__value" role="timer" aria-live="off">
        {formatCountdown(remaining)}
      </span>
      <span className="countdown__caption">para concluir o pagamento</span>
    </div>
  );
}
