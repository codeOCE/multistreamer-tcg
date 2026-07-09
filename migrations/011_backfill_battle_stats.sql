-- ============================================
-- 011_backfill_battle_stats.sql
-- Backfills attack, defense, max_hp, and mechanic_id
-- for all existing user_cards that predate the battle system.
--
-- Logic:
--   • ATK / DEF: pulled from the parent cards table if available.
--     Falls back to rarity-based defaults if the cards table has 0s.
--   • max_hp: set equal to defense (snapshot at grant time).
--   • mechanic_id: randomly assigned using the same weighted distribution
--     as the live assignMechanic() function (reservoir sampling via
--     -log(random()) / rarity_weight).
-- ============================================

BEGIN;

-- ── Step 1: Backfill ATK / DEF using rarity budget split ────────────────────
-- Budget = total points ATK + DEF must add up to (per rarity).
-- ATK = random split between 1 and (budget - 1), DEF = remainder.
-- Only touches rows where both attack AND defense are still 0 (unset).
UPDATE user_cards uc
SET
    attack  = split.atk,
    defense = split.def
FROM (
    SELECT
        uc2.id,
        -- Random split: atk = 1 to (budget-1), def = budget - atk
        GREATEST(1, floor(random() * (budget - 1) + 1)::int)              AS atk,
        budget - GREATEST(1, floor(random() * (budget - 1) + 1)::int)     AS def
    FROM user_cards uc2
    JOIN cards c ON uc2.card_id = c.id
    CROSS JOIN LATERAL (
        SELECT CASE c.rarity
            WHEN 'Legendary' THEN 15
            WHEN 'Epic'      THEN 11
            WHEN 'Rare'      THEN  9
            WHEN 'Uncommon'  THEN  7
            ELSE                   5   -- Common
        END AS budget
    ) b
    WHERE uc2.attack = 0 AND uc2.defense = 0
) split
WHERE uc.id = split.id;


-- ── Step 2: Set max_hp = defense (for Vampire heal calc) ────────────────────
UPDATE user_cards
SET max_hp = defense
WHERE max_hp IS NULL OR max_hp = 0;

-- ── Step 3: Assign one random mechanic per card ───────────────────────────────
-- PostgreSQL caches random() in UPDATE subqueries/LATERAL — the only reliable
-- fix is to materialise one roll per card into a temp table via SELECT,
-- which provably calls random() once per row.
--
-- Cumulative weight thresholds (out of 100):
--   Guard     0–31  (32%)
--   Vampire  32–63  (32%)
--   Reanimate 64–96 (33%)
--   Mimic    97–99  ( 3%)

-- Clear any previous (bad) assignments
UPDATE user_cards SET mechanic_id = NULL;

-- Materialise one random float per card
CREATE TEMP TABLE _card_rolls ON COMMIT DROP AS
    SELECT id, random() AS roll FROM user_cards;

-- Assign mechanic from the pre-rolled value
UPDATE user_cards uc
SET mechanic_id = CASE
    WHEN cr.roll < 0.32 THEN (SELECT id FROM mechanics WHERE name = 'guard'     LIMIT 1)
    WHEN cr.roll < 0.64 THEN (SELECT id FROM mechanics WHERE name = 'vampire'   LIMIT 1)
    WHEN cr.roll < 0.97 THEN (SELECT id FROM mechanics WHERE name = 'reanimate' LIMIT 1)
    ELSE                     (SELECT id FROM mechanics WHERE name = 'mimic'      LIMIT 1)
END
FROM _card_rolls cr
WHERE cr.id = uc.id;

DROP TABLE IF EXISTS _card_rolls;





-- ── Step 4: Verify counts ────────────────────────────────────────────────────
SELECT
    COUNT(*)                                               AS total_cards,
    COUNT(*) FILTER (WHERE attack  > 0)                    AS has_attack,
    COUNT(*) FILTER (WHERE defense > 0)                    AS has_defense,
    COUNT(*) FILTER (WHERE max_hp  > 0)                    AS has_max_hp,
    COUNT(*) FILTER (WHERE mechanic_id IS NOT NULL)        AS has_mechanic,
    COUNT(*) FILTER (WHERE attack = 0 OR defense = 0)      AS still_missing_stats,
    COUNT(*) FILTER (WHERE mechanic_id IS NULL)            AS still_missing_mechanic
FROM user_cards;

-- ── Step 5: Mechanic distribution check ─────────────────────────────────────
SELECT m.display_name, m.icon, COUNT(uc.id) AS assigned_count
FROM mechanics m
LEFT JOIN user_cards uc ON uc.mechanic_id = m.id
GROUP BY m.id, m.display_name, m.icon, m.rarity_weight
ORDER BY m.rarity_weight DESC;

COMMIT;
