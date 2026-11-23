const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const pk = () => ({ type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true });
const fk = () => ({ type: DataTypes.INTEGER, allowNull: false });

const PlayableCharacter = sequelize.define("playable_characters", {
  character_id: pk(),
  character_name: { type: DataTypes.STRING(60), allowNull: false, unique: "uq_character_name" },
  can_flip_dimensions: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

const CharacterAbility = sequelize.define("character_abilities", {
  ability_id: pk(),
  character_id: fk(),
  ability_name: { type: DataTypes.STRING(60), allowNull: false },
  description: { type: DataTypes.TEXT },
}, { indexes: [{ name: "ix_ability_name", fields: ["ability_name"] }] });

const LevelMilestone = sequelize.define("level_milestones", {
  level_number: { type: DataTypes.INTEGER, primaryKey: true },
  required_xp: { type: DataTypes.INTEGER, allowNull: false },
  stat_boost: { type: DataTypes.STRING(100) },
});

const CharacterProgression = sequelize.define("character_progression", {
  progression_id: pk(),
  character_id: fk(),
  level_number: fk(),
  current_xp: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

const Pixl = sequelize.define("pixls", {
  pixl_id: pk(),
  pixl_name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  is_starter: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

const PixlAbility = sequelize.define("pixl_abilities", {
  ability_id: pk(),
  pixl_id: fk(),
  description: { type: DataTypes.TEXT },
  target_type: { type: DataTypes.STRING(60) },
});

const GameWorld = sequelize.define("game_worlds", {
  world_id: pk(),
  world_name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  location: { type: DataTypes.STRING(150) },
  is_hub: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

const GameLevel = sequelize.define("game_levels", {
  game_level_id: pk(),
  world_id: fk(),
  level_code: { type: DataTypes.STRING(10), allowNull: false, unique: true },
  level_name: { type: DataTypes.STRING(80), allowNull: false },
});

const DimensionalDoor = sequelize.define("dimensional_doors", {
  door_id: pk(),
  source_world_id: fk(),
  target_world_id: fk(),
  lock_status: { type: DataTypes.STRING(150) },
});

const PureHeart = sequelize.define("pure_hearts", {
  heart_id: pk(),
  game_level_id: { type: DataTypes.INTEGER, allowNull: true },
  heart_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: "uq_heart_number",
    validate: { min: 1, max: 8 },
  },
  heart_color: { type: DataTypes.STRING(20) },
});

const Faction = sequelize.define("factions", {
  faction_id: pk(),
  faction_name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  motive: { type: DataTypes.TEXT },
});

const Antagonist = sequelize.define("antagonists", {
  antagonist_id: pk(),
  faction_id: fk(),
  character_name: { type: DataTypes.STRING(60), allowNull: false, unique: true },
  faction_role: { type: DataTypes.STRING(80) },
});

const Enemy = sequelize.define("enemies", {
  enemy_id: pk(),
  enemy_name: { type: DataTypes.STRING(60), allowNull: false, unique: true },
  hp: { type: DataTypes.INTEGER, allowNull: false },
  attack_power: { type: DataTypes.INTEGER, allowNull: false },
});

const LevelEnemy = sequelize.define("level_enemies", {
  level_enemy_id: pk(),
  game_level_id: fk(),
  enemy_id: fk(),
  spawn_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
});

const ItemType = sequelize.define("item_types", {
  item_type_id: pk(),
  type_name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
});

const Item = sequelize.define("items", {
  item_id: pk(),
  item_type_id: fk(),
  item_name: { type: DataTypes.STRING(60), allowNull: false },
  heal_amount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { indexes: [{ name: "ix_item_name", fields: ["item_name"] }] });

const CharacterInventory = sequelize.define("character_inventory", {
  inventory_id: pk(),
  character_id: fk(),
  item_id: fk(),
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
});

const link = (parent, child, key, opts = {}) => {
  parent.hasMany(child, { foreignKey: key, ...opts });
  child.belongsTo(parent, { foreignKey: key, ...opts });
};
link(PlayableCharacter, CharacterAbility, "character_id", { onDelete: "CASCADE" });
link(PlayableCharacter, CharacterProgression, "character_id", { onDelete: "CASCADE" });
link(PlayableCharacter, CharacterInventory, "character_id", { onDelete: "CASCADE" });
link(LevelMilestone, CharacterProgression, "level_number");
link(Pixl, PixlAbility, "pixl_id", { onDelete: "CASCADE" });
link(GameWorld, GameLevel, "world_id");
link(GameLevel, PureHeart, "game_level_id");
link(GameLevel, LevelEnemy, "game_level_id", { onDelete: "CASCADE" });
link(Enemy, LevelEnemy, "enemy_id");
link(Faction, Antagonist, "faction_id");
link(ItemType, Item, "item_type_id");
link(Item, CharacterInventory, "item_id");
GameWorld.hasMany(DimensionalDoor, { foreignKey: "source_world_id", as: "outgoingDoors" });
GameWorld.hasMany(DimensionalDoor, { foreignKey: "target_world_id", as: "incomingDoors" });
DimensionalDoor.belongsTo(GameWorld, { foreignKey: "source_world_id", as: "source" });
DimensionalDoor.belongsTo(GameWorld, { foreignKey: "target_world_id", as: "target" });

module.exports = {
  sequelize,
  PlayableCharacter,
  CharacterAbility,
  LevelMilestone,
  CharacterProgression,
  Pixl,
  PixlAbility,
  GameWorld,
  GameLevel,
  DimensionalDoor,
  PureHeart,
  Faction,
  Antagonist,
  Enemy,
  LevelEnemy,
  ItemType,
  Item,
  CharacterInventory,
};