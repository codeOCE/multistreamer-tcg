-- ============================================
-- 013_fixed_card_stats.sql
-- Moves card stats (Attack, Defense, Mechanic) from 
-- random per-mint to fixed per-base-card.
-- ============================================

BEGIN;

-- 1. Add mechanic_id to base cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mechanic_id UUID REFERENCES mechanics(id);

-- 2. Generate stats for all base cards where attack is 0
-- Using the same rarity budget system as before
UPDATE cards c
SET
    attack  = split.atk,
    defense = split.def
FROM (
    WITH RarityBudgets AS (
        SELECT id, CASE rarity
            WHEN 'Legendary' THEN 15
            WHEN 'Epic'      THEN 11
            WHEN 'Rare'      THEN  9
            WHEN 'Uncommon'  THEN  7
            ELSE                   5   -- Common
        END AS budget
        FROM cards
        WHERE attack = 0 OR defense = 0
    ),
    Rolls AS (
        SELECT 
            id, 
            budget,
            GREATEST(1, floor(random() * (budget - 1) + 1)::int) AS atk
        FROM RarityBudgets
    )
    SELECT 
        id, 
        atk, 
        budget - atk AS def 
    FROM Rolls
) split
WHERE c.id = split.id;

-- 3. Assign random mechanics to base cards
-- Clear any previous assignments to be safe
UPDATE cards SET mechanic_id = NULL;

-- Materialise one random float per card to ensure postgres random() evaluates per row
CREATE TEMP TABLE _card_rolls ON COMMIT DROP AS
    SELECT id, random() AS roll FROM cards;

UPDATE cards c
SET mechanic_id = CASE
    WHEN cr.roll < 0.32 THEN (SELECT id FROM mechanics WHERE name = 'guard'     LIMIT 1)
    WHEN cr.roll < 0.64 THEN (SELECT id FROM mechanics WHERE name = 'vampire'   LIMIT 1)
    WHEN cr.roll < 0.97 THEN (SELECT id FROM mechanics WHERE name = 'reanimate' LIMIT 1)
    ELSE                     (SELECT id FROM mechanics WHERE name = 'mimic'      LIMIT 1)
END
FROM _card_rolls cr
WHERE cr.id = c.id;

DROP TABLE IF EXISTS _card_rolls;

-- 4. Sync all user_cards to match their parent base cards
UPDATE user_cards uc
SET 
    attack = c.attack,
    defense = c.defense,
    max_hp = c.defense,
    mechanic_id = c.mechanic_id
FROM cards c
WHERE uc.card_id = c.id;

-- 5. Validation Check
SELECT 
    COUNT(*) as total_cards,
    COUNT(*) FILTER(WHERE attack > 0) as valid_attack,
    COUNT(*) FILTER(WHERE mechanic_id IS NOT NULL) as valid_mechanics,
    COUNT(*) FILTER(WHERE attack = 0) as missing_attack,
    COUNT(*) FILTER(WHERE mechanic_id IS NULL) as missing_mechanic
FROM cards;

COMMIT;
