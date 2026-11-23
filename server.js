// REST API for the Super Paper Mario database.
// Run: node server.js   then open http://localhost:3000
const express = require("express");
const m = require("./models");
 
const app = express();
app.use(express.json());
 
// ---------- CRUD for every table: /api/<table_name> ----------
const tables = {
  playable_characters: m.PlayableCharacter, character_abilities: m.CharacterAbility,
  level_milestones: m.LevelMilestone, character_progression: m.CharacterProgression,
  pixls: m.Pixl, pixl_abilities: m.PixlAbility, game_worlds: m.GameWorld,
  game_levels: m.GameLevel, dimensional_doors: m.DimensionalDoor, pure_hearts: m.PureHeart,
  factions: m.Faction, antagonists: m.Antagonist, enemies: m.Enemy,
  level_enemies: m.LevelEnemy, item_types: m.ItemType, items: m.Item,
  character_inventory: m.CharacterInventory,
};
 
for (const [name, Model] of Object.entries(tables)) {
  // READ all
  app.get(`/api/${name}`, async (req, res) => res.json(await Model.findAll()));
  // READ one
  app.get(`/api/${name}/:id`, async (req, res) => {
    const row = await Model.findByPk(req.params.id);
    row ? res.json(row) : res.status(404).json({ error: "Not found" });
  });
  // CREATE
  app.post(`/api/${name}`, async (req, res) => {
    try { res.status(201).json(await Model.create(req.body)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  // UPDATE
  app.put(`/api/${name}/:id`, async (req, res) => {
    try {
      const row = await Model.findByPk(req.params.id);
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(await row.update(req.body));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  // DELETE
  app.delete(`/api/${name}/:id`, async (req, res) => {
    const count = await Model.destroy({ where: { [Model.primaryKeyAttribute]: req.params.id } });
    count ? res.json({ deleted: true }) : res.status(404).json({ error: "Not found" });
  });
}
 
// ---------- Query with multiple joins (5 tables) ----------
// Every character with their abilities, level and items
app.get("/api/reports/characters", async (req, res) => {
  res.json(await m.PlayableCharacter.findAll({
    include: [
      { model: m.CharacterAbility },
      { model: m.CharacterProgression, include: [m.LevelMilestone] },
      { model: m.CharacterInventory, include: [m.Item] },
    ],
  }));
});
 
// ---------- Access to a VIEW ----------
app.get("/api/views/character-inventory", async (req, res) => {
  const [rows] = await m.sequelize.query("SELECT * FROM v_character_inventory");
  res.json(rows);
});
 
// ---------- Access to a STORED PROCEDURE ----------
// Example: /api/procedures/progression/Mario
app.get("/api/procedures/progression/:name", async (req, res) => {
  const rows = await m.sequelize.query("CALL sp_character_progression(:name)", {
    replacements: { name: req.params.name },
  });
  res.json(rows);
});
 
app.get("/", (req, res) => res.send("Super Paper Mario API is running. Try /api/playable_characters"));
 
app.listen(3000, () => console.log("API running at http://localhost:3000"));