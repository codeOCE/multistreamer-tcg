-- ============================================
-- 014_patch_stats_math.sql
-- Fixes the attack + defense budget math 
-- ============================================

BEGIN;

-- 1. Identify cards where the attack + defense does not match the rarity budget
--    and re-roll them correctly using a single random() call.
WITH RarityBudgets AS (
    SELECT id, attack, defense, CASE rarity
        WHEN 'Legendary' THEN 15
        WHEN 'Epic'      THEN 11
        WHEN 'Rare'      THEN  9
        WHEN 'Uncommon'  THEN  7
        ELSE                   5   -- Common
    END AS budget
    FROM cards
),
MessedUp AS (
    SELECT id, budget
    FROM RarityBudgets
    WHERE (attack + defense) != budget
),
Rolls AS (
    SELECT 
        id, 
        budget,
        GREATEST(1, floor(random() * (budget - 1) + 1)::int) AS atk
    FROM MessedUp
)
UPDATE cards c
SET
    attack  = r.atk,
    defense = r.budget - r.atk
FROM Rolls r
WHERE c.id = r.id;

-- 2. Sync any user_cards that had the bad math back to the corrected base cards
UPDATE user_cards uc
SET 
    attack = c.attack,
    defense = c.defense,
    max_hp = c.defense
FROM cards c
WHERE uc.card_id = c.id
  AND (uc.attack != c.attack OR uc.defense != c.defense);

-- 3. Validation Check
SELECT 
    COUNT(*) as total_cards,
    COUNT(*) FILTER(WHERE attack + defense = 15 AND rarity = 'Legendary') as valid_leg,
    COUNT(*) FILTER(WHERE attack + defense = 11 AND rarity = 'Epic') as valid_epic,
    COUNT(*) FILTER(WHERE attack + defense = 9 AND rarity = 'Rare') as valid_rare,
    COUNT(*) FILTER(WHERE attack + defense = 7 AND rarity = 'Uncommon') as valid_unc,
    COUNT(*) FILTER(WHERE attack + defense = 5 AND rarity = 'Common') as valid_com,
    COUNT(*) FILTER(WHERE
        (rarity = 'Legendary' AND attack + defense != 15) OR
        (rarity = 'Epic' AND attack + defense != 11) OR
        (rarity = 'Rare' AND attack + defense != 9) OR
        (rarity = 'Uncommon' AND attack + defense != 7) OR
        (rarity = 'Common' AND attack + defense != 5)
    ) as broken_math
FROM cards;

COMMIT;
