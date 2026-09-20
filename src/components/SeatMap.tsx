'use client';

import { useMemo } from 'react';
import { rowLabel, seatShortLabel } from '@/lib/client/format';
import type { SeatResponse } from '@/lib/dto';

interface SeatMapProps {
  seats: SeatResponse[];
  selected: string | null;
  onSelect: (seatNumber: string) => void;
}

interface Section {
  name: string;
  rows: Array<{ name: string | null; seats: SeatResponse[] }>;
  available: number;
}

function group(seats: SeatResponse[]): Section[] {
  const sections = new Map<string, Section>();
  for (const seat of seats) {
    const sectionName = seat.section ?? 'Geral';
    let section = sections.get(sectionName);
    if (!section) {
      section = { name: sectionName, rows: [], available: 0 };
      sections.set(sectionName, section);
    }
    let row = section.rows.find((r) => r.name === seat.rowNumber);
    if (!row) {
      row = { name: seat.rowNumber, seats: [] };
      section.rows.push(row);
    }
    row.seats.push(seat);
    if (seat.status === 'AVAILABLE') section.available++;
  }
  return [...sections.values()];
}

const STATUS_TEXT: Record<SeatResponse['status'], string> = {
  AVAILABLE: 'disponível',
  RESERVED: 'reservado por outra pessoa',
  SOLD: 'vendido',
  CANCELLED: 'indisponível',
};

export function SeatMap({ seats, selected, onSelect }: SeatMapProps) {
  const sections = useMemo(() => group(seats), [seats]);

  return (
    <div className="seatmap">
      <div className="stage" aria-hidden="true">
        Palco
      </div>

      <ul className="legend" aria-label="Legenda">
        <li><span className="seat seat--available" aria-hidden="true" /> Disponível</li>
        <li><span className="seat seat--selected" aria-hidden="true" /> Sua escolha</li>
        <li><span className="seat seat--reserved" aria-hidden="true" /> Reservado</li>
        <li><span className="seat seat--sold" aria-hidden="true" /> Vendido</li>
      </ul>

      {sections.map((section) => (
        <section key={section.name} className="seatmap__section" aria-label={`Setor ${section.name}`}>
          <h3>
            {section.name} <small>{section.available} livres</small>
          </h3>
          <div className="rows">
            {section.rows.map((row) => (
              <div key={row.name ?? 'sem-fila'} className="row">
                <span className="row__label">{rowLabel(row.name)}</span>
                <div className="row__seats">
                  {row.seats.map((seat) => {
                    const isSelected = seat.seatNumber === selected;
                    const available = seat.status === 'AVAILABLE';
                    const cls = isSelected ? 'seat seat--selected' : `seat seat--${seat.status.toLowerCase()}`;
                    return (
                      <button
                        key={seat.id}
                        type="button"
                        className={cls}
                        disabled={!available && !isSelected}
                        aria-pressed={isSelected}
                        aria-label={`Assento ${seat.seatNumber}, ${section.name}, ${rowLabel(seat.rowNumber)}, ${isSelected ? 'selecionado' : STATUS_TEXT[seat.status]}`}
                        onClick={() => onSelect(seat.seatNumber)}
                      >
                        {seatShortLabel(seat.seatNumber)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
