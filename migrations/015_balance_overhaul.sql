-- Phase 19: Game Balance Overhaul
-- Narrowing the power gap between rarities and enforcing health minimums.

-- 1. Update the base 'cards' table
UPDATE cards
SET 
    -- Ensure every unit has at least 1 HP to survive entry
    defense = GREATEST(1, defense),
    
    -- Recalculate Attack if the card exceeds the new rarity budgets
    attack = GREATEST(0, 
        CASE 
            WHEN (attack + GREATEST(1, defense)) > (
                CASE LOWER(rarity)
                    WHEN 'legendary' THEN 14
                    WHEN 'epic' THEN 12
                    WHEN 'rare' THEN 10
                    WHEN 'uncommon' THEN 8
                    ELSE 6
                END
            ) THEN (
                CASE LOWER(rarity)
                    WHEN 'legendary' THEN 14
                    WHEN 'epic' THEN 12
                    WHEN 'rare' THEN 10
                    WHEN 'uncommon' THEN 8
                    ELSE 6
                END
            ) - GREATEST(1, defense)
            ELSE attack
        END
    );

-- 2. Synchronize these changes to the 'user_cards' collection
-- This ensures existing player cards are immediately balanced.
UPDATE user_cards uc
SET 
    attack = c.attack,
    defense = c.defense,
    max_hp = c.defense
FROM cards c
WHERE uc.card_id = c.id;
