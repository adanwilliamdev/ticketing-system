"""Popula dados de exemplo — equivalente a migrations/V2__insert_sample_data.sql do projeto
original. Rode manualmente após as migrações: `python seed.py`.
"""
import asyncio
import sys

if sys.platform == "win32":
    # Evita ConnectionDoesNotExistError do asyncpg no Windows: o ProactorEventLoop (padrão do
    # asyncio no Windows) tem um bug conhecido na negociação inicial de conexões TCP com
    # PostgreSQL via Docker Desktop. Precisa ser definido antes de qualquer coisa que crie um
    # event loop.
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from datetime import datetime

from app.database import get_session_factory
from app.models import Event, Ticket

EVENTS = [
    dict(
        name="Rock Concert 2024",
        description="Amazing rock concert with multiple bands",
        start_date_time=datetime.fromisoformat("2024-12-15T20:00:00"),
        end_date_time=datetime.fromisoformat("2024-12-15T23:00:00"),
        location="Stadium Arena",
        total_capacity=1000,
        available_tickets=1000,
        price="150.00",
        status="PUBLISHED",
    ),
    dict(
        name="Tech Conference 2024",
        description="Annual technology conference",
        start_date_time=datetime.fromisoformat("2024-11-20T09:00:00"),
        end_date_time=datetime.fromisoformat("2024-11-22T18:00:00"),
        location="Convention Center",
        total_capacity=500,
        available_tickets=500,
        price="299.00",
        status="PUBLISHED",
    ),
    dict(
        name="Jazz Night",
        description="Classic jazz performance",
        start_date_time=datetime.fromisoformat("2024-10-25T19:30:00"),
        end_date_time=datetime.fromisoformat("2024-10-25T22:00:00"),
        location="Jazz Club",
        total_capacity=200,
        available_tickets=200,
        price="75.00",
        status="PUBLISHED",
    ),
]


def _section_for(i: int, thresholds: list[tuple[int, str]]) -> str:
    for limit, name in thresholds:
        if i <= limit:
            return name
    return thresholds[-1][1]


async def seed() -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        async with session.begin():
            events_by_name: dict[str, Event] = {}
            for data in EVENTS:
                event = Event(**data)
                session.add(event)
                events_by_name[data["name"]] = event
            await session.flush()

            rock = events_by_name["Rock Concert 2024"]
            for i in range(1, 1001):
                session.add(
                    Ticket(
                        event_id=rock.id,
                        seat_number=f"A{i:03d}",
                        section=_section_for(i, [(100, "VIP"), (300, "Premium"), (1000, "Regular")]),
                        row_number=f"Row {-(-i // 20)}",
                        status="AVAILABLE",
                    )
                )

            tech = events_by_name["Tech Conference 2024"]
            for i in range(1, 501):
                session.add(
                    Ticket(
                        event_id=tech.id,
                        seat_number=f"B{i:03d}",
                        section=_section_for(i, [(50, "VIP"), (150, "Premium"), (500, "Regular")]),
                        row_number=f"Row {-(-i // 25)}",
                        status="AVAILABLE",
                    )
                )

            jazz = events_by_name["Jazz Night"]
            for i in range(1, 201):
                session.add(
                    Ticket(
                        event_id=jazz.id,
                        seat_number=f"C{i:03d}",
                        section=_section_for(i, [(30, "VIP"), (100, "Premium"), (200, "Regular")]),
                        row_number=f"Row {-(-i // 10)}",
                        status="AVAILABLE",
                    )
                )

    print("Dados de exemplo inseridos com sucesso.")


if __name__ == "__main__":
    asyncio.run(seed())
