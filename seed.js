// Fills every table with real Super Paper Mario data (3+ rows each).
// Run: node seed.js   (safe to re-run: it rebuilds the tables first)
const m = require("./models");

(async () => {
  try {
    await m.sequelize.sync({ force: true });
    await m.sequelize.query(
      "ALTER TABLE pure_hearts ADD CONSTRAINT ck_heart_number_1_8 CHECK (heart_number BETWEEN 1 AND 8)"
    );

    await m.PlayableCharacter.bulkCreate([
      { character_id: 1, character_name: "Mario", can_flip_dimensions: true },
      { character_id: 2, character_name: "Princess Peach", can_flip_dimensions: false },
      { character_id: 3, character_name: "Bowser", can_flip_dimensions: false },
      { character_id: 4, character_name: "Luigi", can_flip_dimensions: false },
    ]);
    await m.CharacterAbility.bulkCreate([
      { character_id: 1, ability_name: "Dimension Flip", description: "Flip between 2D and 3D to reveal hidden paths and secrets" },
      { character_id: 2, ability_name: "Parasol Float", description: "Hover across wide gaps" },
      { character_id: 2, ability_name: "Parasol Guard", description: "Block enemy attacks with her parasol" },
      { character_id: 3, ability_name: "Fire Breath", description: "Breathe fire to defeat enemies" },
      { character_id: 4, ability_name: "Super Jump", description: "Jump the highest of any party member" },
    ]);
    await m.LevelMilestone.bulkCreate([
      { level_number: 1, required_xp: 0, stat_boost: "Starting stats" },
      { level_number: 2, required_xp: 10000, stat_boost: "Max HP +5" },
      { level_number: 3, required_xp: 30000, stat_boost: "Attack +1" },
      { level_number: 4, required_xp: 60000, stat_boost: "Max HP +5" },
    ]);
    await m.CharacterProgression.bulkCreate([
      { character_id: 1, level_number: 3, current_xp: 42000 },
      { character_id: 2, level_number: 2, current_xp: 15000 },
      { character_id: 3, level_number: 2, current_xp: 21000 },
      { character_id: 4, level_number: 1, current_xp: 6000 },
    ]);

    await m.Pixl.bulkCreate([
      { pixl_id: 1, pixl_name: "Tippi", is_starter: true },
      { pixl_id: 2, pixl_name: "Thoreau", is_starter: false },
      { pixl_id: 3, pixl_name: "Boomer", is_starter: false },
      { pixl_id: 4, pixl_name: "Slim", is_starter: false },
      { pixl_id: 5, pixl_name: "Thudley", is_starter: false },
    ]);
    await m.PixlAbility.bulkCreate([
      { pixl_id: 1, description: "Reveal enemy info and hidden secrets", target_type: "Enemies & Environment" },
      { pixl_id: 2, description: "Pick up and throw objects or enemies", target_type: "Objects & Enemies" },
      { pixl_id: 3, description: "Place a bomb that breaks walls and damages enemies", target_type: "Objects & Enemies" },
      { pixl_id: 4, description: "Turn paper-thin to slip through narrow gaps", target_type: "Environment" },
      { pixl_id: 5, description: "Ground pound to smash blocks and enemies", target_type: "Objects & Enemies" },
    ]);

    await m.GameWorld.bulkCreate([
      { world_id: 1, world_name: "Flipside", location: "Between dimensions", is_hub: true },
      { world_id: 2, world_name: "Flopside", location: "Mirrored counterpart of Flipside", is_hub: true },
      { world_id: 3, world_name: "Lineland", location: "Chapter 1", is_hub: false },
      { world_id: 4, world_name: "Gloam Valley", location: "Chapter 2", is_hub: false },
      { world_id: 5, world_name: "The Bitlands", location: "Chapter 3", is_hub: false },
      { world_id: 6, world_name: "Castle Bleck", location: "Chapter 8", is_hub: false },
    ]);
    await m.GameLevel.bulkCreate([
      { game_level_id: 1, world_id: 3, level_code: "1-1", level_name: "Lineland Road" },
      { game_level_id: 2, world_id: 3, level_code: "1-2", level_name: "Mount Lineland" },
      { game_level_id: 3, world_id: 3, level_code: "1-4", level_name: "Yold Desert" },
      { game_level_id: 4, world_id: 4, level_code: "2-1", level_name: "Gloam Valley" },
      { game_level_id: 5, world_id: 4, level_code: "2-4", level_name: "Merlee's Mansion" },
      { game_level_id: 6, world_id: 5, level_code: "3-4", level_name: "Fort Francis" },
      { game_level_id: 7, world_id: 6, level_code: "8-1", level_name: "Castle Bleck Entry" },
    ]);
    await m.DimensionalDoor.bulkCreate([
      { source_world_id: 1, target_world_id: 3, lock_status: "Locked until a Pure Heart is placed" },
      { source_world_id: 1, target_world_id: 4, lock_status: "Locked until a Pure Heart is placed" },
      { source_world_id: 1, target_world_id: 5, lock_status: "Locked until a Pure Heart is placed" },
      { source_world_id: 1, target_world_id: 2, lock_status: "Unlocked later in the game" },
    ]);
    await m.PureHeart.bulkCreate([
      { heart_number: 1, heart_color: "Red", game_level_id: null }, // given by Merlon in Flipside
      { heart_number: 2, heart_color: "Orange", game_level_id: 3 },
      { heart_number: 3, heart_color: "Yellow", game_level_id: 5 },
      { heart_number: 4, heart_color: "Green", game_level_id: 6 },
    ]);

    await m.Faction.bulkCreate([
      { faction_id: 1, faction_name: "Count Bleck's Minions", motive: "Use the Chaos Heart to erase the universe and create a perfect world" },
      { faction_id: 2, faction_name: "Dimentio's Betrayal", motive: "Seize the Chaos Heart with a brainwashed Luigi as its host" },
      { faction_id: 3, faction_name: "Chapter Guardians", motive: "Guard a Pure Heart or block the heroes' path" },
    ]);
    await m.Antagonist.bulkCreate([
      { faction_id: 1, character_name: "Count Bleck", faction_role: "Leader (true identity: Blumiere)" },
      { faction_id: 1, character_name: "Nastasia", faction_role: "Assistant" },
      { faction_id: 1, character_name: "O'Chunks", faction_role: "Minion" },
      { faction_id: 1, character_name: "Mimi", faction_role: "Minion (shapeshifter)" },
      { faction_id: 2, character_name: "Dimentio", faction_role: "Traitor" },
      { faction_id: 3, character_name: "Fracktail", faction_role: "Guardian of the Orange Pure Heart" },
      { faction_id: 3, character_name: "Francis", faction_role: "Lord of Fort Francis" },
    ]);

    await m.Enemy.bulkCreate([
      { enemy_id: 1, enemy_name: "Goomba", hp: 1, attack_power: 1 },
      { enemy_id: 2, enemy_name: "Koopa Troopa", hp: 1, attack_power: 1 },
      { enemy_id: 3, enemy_name: "Squiglet", hp: 1, attack_power: 1 },
      { enemy_id: 4, enemy_name: "Spiny", hp: 1, attack_power: 2 },
      { enemy_id: 5, enemy_name: "Boomboxer", hp: 6, attack_power: 1 },
    ]);
    await m.LevelEnemy.bulkCreate([
      { game_level_id: 1, enemy_id: 1, spawn_count: 6 },
      { game_level_id: 1, enemy_id: 2, spawn_count: 3 },
      { game_level_id: 1, enemy_id: 3, spawn_count: 4 },
      { game_level_id: 2, enemy_id: 4, spawn_count: 3 },
      { game_level_id: 4, enemy_id: 5, spawn_count: 2 },
    ]);

    await m.ItemType.bulkCreate([
      { item_type_id: 1, type_name: "Healing" },
      { item_type_id: 2, type_name: "Attack" },
      { item_type_id: 3, type_name: "Status" },
    ]);
    await m.Item.bulkCreate([
      { item_id: 1, item_type_id: 1, item_name: "Shroom Shake", heal_amount: 10 },
      { item_id: 2, item_type_id: 1, item_name: "Super Shroom Shake", heal_amount: 20 },
      { item_id: 3, item_type_id: 2, item_name: "Fire Burst", heal_amount: 0 },
      { item_id: 4, item_type_id: 2, item_name: "Thunder Rage", heal_amount: 0 },
      { item_id: 5, item_type_id: 3, item_name: "Sleepy Sheep", heal_amount: 0 },
    ]);
    await m.CharacterInventory.bulkCreate([
      { character_id: 1, item_id: 1, quantity: 3 },
      { character_id: 1, item_id: 3, quantity: 1 },
      { character_id: 2, item_id: 2, quantity: 2 },
      { character_id: 3, item_id: 4, quantity: 1 },
      { character_id: 4, item_id: 5, quantity: 2 },
    ]);

    console.log("Database populated! Every table has 3+ rows.");
  } catch (err) {
    console.error(err);
  } finally {
    await m.sequelize.close();
  }
})();