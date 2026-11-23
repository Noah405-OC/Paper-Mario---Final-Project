USE super_paper_mario;

-- VIEW: what each character is carrying
DROP VIEW IF EXISTS v_character_inventory;
CREATE VIEW v_character_inventory AS
SELECT pc.character_name, i.item_name, it.type_name, ci.quantity, i.heal_amount
FROM playable_characters pc
JOIN character_inventory ci ON ci.character_id = pc.character_id
JOIN items i               ON i.item_id       = ci.item_id
JOIN item_types it         ON it.item_type_id = i.item_type_id;

-- STORED PROCEDURE: a character's level, XP and XP still needed
DROP PROCEDURE IF EXISTS sp_character_progression;
DELIMITER $$
CREATE PROCEDURE sp_character_progression(IN p_name VARCHAR(60))
BEGIN
  SELECT pc.character_name, cp.level_number, cp.current_xp, lm.stat_boost,
         GREATEST(nxt.required_xp - cp.current_xp, 0) AS xp_to_next_level
  FROM playable_characters pc
  JOIN character_progression cp ON cp.character_id = pc.character_id
  JOIN level_milestones lm      ON lm.level_number = cp.level_number
  LEFT JOIN level_milestones nxt ON nxt.level_number = cp.level_number + 1
  WHERE pc.character_name = p_name;
END $$
DELIMITER ;
