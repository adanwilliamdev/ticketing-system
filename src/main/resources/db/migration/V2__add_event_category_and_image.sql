-- Adiciona categoria e imagem de capa aos eventos.
-- A tabela se chama "events" (plural) — conforme V1__create_schema.sql.

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS category  VARCHAR(20) NOT NULL DEFAULT 'OUTROS',
    ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- ---------------------------------------------------------------------------
-- Backfill de categoria pelo nome (para instalações que já tinham eventos).
-- Em banco novo, esses UPDATEs afetam 0 linhas — o DataSeeder define direto.
-- ---------------------------------------------------------------------------
UPDATE events SET category = 'MUSICA'
 WHERE name ILIKE '%jazz%'
    OR name ILIKE '%rock%'
    OR name ILIKE '%concert%'
    OR name ILIKE '%show%'
    OR name ILIKE '%música%'
    OR name ILIKE '%musica%';

UPDATE events SET category = 'TECH'
 WHERE name ILIKE '%tech%'
    OR name ILIKE '%conference%'
    OR name ILIKE '%conferência%'
    OR name ILIKE '%conferencia%';

UPDATE events SET category = 'TEATRO'
 WHERE name ILIKE '%ópera%'
    OR name ILIKE '%opera%'
    OR name ILIKE '%teatro%'
    OR name ILIKE '%musical%';

-- ---------------------------------------------------------------------------
-- Backfill de imagens (Unsplash) para eventos conhecidos do seed demo.
-- ---------------------------------------------------------------------------
UPDATE events SET image_url = 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&q=80&w=800'
 WHERE image_url IS NULL AND name ILIKE '%jazz%';

UPDATE events SET image_url = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=800'
 WHERE image_url IS NULL AND name ILIKE '%rock%';

UPDATE events SET image_url = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800'
 WHERE image_url IS NULL AND (name ILIKE '%tech%' OR name ILIKE '%conference%');