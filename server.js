const express = require("express");
const { QueryTypes } = require("sequelize");
const { GoogleGenAI, Type } = require("@google/genai");
const { onRequest } = require("firebase-functions/https");
const m = require("./models");
const { seedDatabase } = require("./seed");

const app = express();
app.use(express.json());
app.use(express.static("public"));

let readyPromise = null;
function ensureDbReady() {
  if (!readyPromise) {
    readyPromise = seedDatabase(false);
  }
  return readyPromise;
}

app.use(async (_req, _res, next) => {
  try {
    await ensureDbReady();
    next();
  } catch (err) {
    next(err);
  }
});

function getPkCol(tableSchema) {
  const entry = Object.entries(tableSchema).find(([, meta]) => meta.primaryKey);
  return entry ? entry[0] : "id";
}

function coerceVal(val, colMeta) {
  if (val === "" || val === undefined || val === null) return null;
  const t = String(colMeta?.type || "").toUpperCase();
  if (t.includes("BOOL") || t.includes("TINYINT(1)")) {
    if (val === true || val === "true" || val === "1" || val === 1) return true;
    if (val === false || val === "false" || val === "0" || val === 0) return false;
  }
  return val;
}

async function checkTableAndCols(table, keys = []) {
  const schema = await m.sequelize.getDatabaseSchema();
  if (!schema[table]) throw new Error(`Unknown table: ${table}`);
  const cols = Object.keys(schema[table]);
  for (const k of keys) {
    if (!cols.includes(k)) throw new Error(`Invalid column: ${k}`);
  }
  return schema[table];
}

app.get("/api/schema", async (_req, res) => {
  try {
    res.json(await m.sequelize.getDatabaseSchema());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tables/:table", async (req, res) => {
  try {
    const { table } = req.params;
    await checkTableAndCols(table);
    const rows = await m.sequelize.query(`SELECT * FROM "${table}"`, {
      type: QueryTypes.SELECT,
    });
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/tables/:table", async (req, res) => {
  try {
    const { table } = req.params;
    const rawEntries = Object.entries(req.body).filter(([, v]) => v !== "" && v !== undefined);
    if (rawEntries.length === 0) {
      return res.status(400).json({ error: "Please fill in at least one field." });
    }
    const tableSchema = await checkTableAndCols(table, rawEntries.map(([k]) => k));
    const entries = rawEntries.map(([k, v]) => [k, coerceVal(v, tableSchema[k])]);
    const cols = entries.map(([k]) => `"${k}"`).join(", ");
    const params = entries.map(([k]) => `:${k}`).join(", ");
    await m.sequelize.query(
      `INSERT INTO "${table}" (${cols}) VALUES (${params})`,
      { replacements: Object.fromEntries(entries), type: QueryTypes.INSERT }
    );
    res.status(201).json({ status: "created" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/tables/:table/:id", async (req, res) => {
  try {
    const { table, id } = req.params;
    const tableSchema = await checkTableAndCols(table);
    const pkCol = getPkCol(tableSchema);
    const rawEntries = Object.entries(req.body).filter(([k]) => k !== pkCol);
    if (rawEntries.length === 0) {
      return res.status(400).json({ error: "No fields provided to update." });
    }
    await checkTableAndCols(table, rawEntries.map(([k]) => k));
    const entries = rawEntries.map(([k, v]) => [k, coerceVal(v, tableSchema[k])]);
    const setSql = entries.map(([k]) => `"${k}" = :${k}`).join(", ");
    await m.sequelize.query(
      `UPDATE "${table}" SET ${setSql} WHERE "${pkCol}" = :_id`,
      { replacements: { ...Object.fromEntries(entries), _id: id }, type: QueryTypes.UPDATE }
    );
    res.json({ status: "updated" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/tables/:table/:id", async (req, res) => {
  try {
    const { table, id } = req.params;
    const tableSchema = await checkTableAndCols(table);
    const pkCol = getPkCol(tableSchema);
    await m.sequelize.query(`DELETE FROM "${table}" WHERE "${pkCol}" = :id`, {
      replacements: { id },
      type: QueryTypes.DELETE,
    });
    res.json({ status: "deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/reports/characters", async (_req, res) => {
  try {
    const rows = await m.PlayableCharacter.findAll({
      include: [
        { model: m.CharacterAbility },
        { model: m.CharacterProgression, include: [m.LevelMilestone] },
        { model: m.CharacterInventory, include: [m.Item] },
      ],
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/views/character-inventory", async (_req, res) => {
  try {
    const rows = await m.sequelize.query("SELECT * FROM v_character_inventory", {
      type: QueryTypes.SELECT,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/procedures/progression/:name", async (req, res) => {
  try {
    if (m.sequelize.getDialect() === "mysql") {
      const rows = await m.sequelize.query("CALL sp_character_progression(:name)", {
        replacements: { name: req.params.name },
      });
      return res.json(rows);
    }
    const rows = await m.sequelize.query(
      `SELECT pc.character_name, cp.level_number, cp.current_xp, lm.stat_boost,
              GREATEST(COALESCE(nxt.required_xp - cp.current_xp, 0), 0) AS xp_to_next_level
       FROM playable_characters pc
       JOIN character_progression cp ON cp.character_id = pc.character_id
       JOIN level_milestones lm      ON lm.level_number = cp.level_number
       LEFT JOIN level_milestones nxt ON nxt.level_number = cp.level_number + 1
       WHERE pc.character_name = :name`,
      { replacements: { name: req.params.name }, type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const modelMap = {
  playable_characters: m.PlayableCharacter,
  character_abilities: m.CharacterAbility,
  level_milestones: m.LevelMilestone,
  character_progression: m.CharacterProgression,
  pixls: m.Pixl,
  pixl_abilities: m.PixlAbility,
  game_worlds: m.GameWorld,
  game_levels: m.GameLevel,
  dimensional_doors: m.DimensionalDoor,
  pure_hearts: m.PureHeart,
  factions: m.Faction,
  antagonists: m.Antagonist,
  enemies: m.Enemy,
  level_enemies: m.LevelEnemy,
  item_types: m.ItemType,
  items: m.Item,
  character_inventory: m.CharacterInventory,
};

for (const [tableName, Model] of Object.entries(modelMap)) {
  app.get(`/api/${tableName}`, async (_req, res) => res.json(await Model.findAll()));
  app.get(`/api/${tableName}/:id`, async (req, res) => {
    const row = await Model.findByPk(req.params.id);
    row ? res.json(row) : res.status(404).json({ error: "Not found" });
  });
  app.post(`/api/${tableName}`, async (req, res) => {
    try {
      res.status(201).json(await Model.create(req.body));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.put(`/api/${tableName}/:id`, async (req, res) => {
    try {
      const row = await Model.findByPk(req.params.id);
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(await row.update(req.body));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.delete(`/api/${tableName}/:id`, async (req, res) => {
    const count = await Model.destroy({ where: { [Model.primaryKeyAttribute]: req.params.id } });
    count ? res.json({ deleted: true }) : res.status(404).json({ error: "Not found" });
  });
}

const geminiTools = [
  {
    functionDeclarations: [
      {
        name: "get_schema",
        description: "Inspect all table names, column names, primary keys, and types in the database.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "run_readonly_sql",
        description: "Execute a read-only SELECT query to answer a user question.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            sql: { type: Type.STRING, description: "A valid SQL SELECT query." },
          },
          required: ["sql"],
        },
      },
    ],
  },
];

const FALLBACK_MODELS = [
  "gemini-4-hydrogen",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];

function isRetryableError(err) {
  const msg = String(err?.message || "");
  return (
    err?.status === 503 ||
    err?.status === 429 ||
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand")
  );
}

async function callModelWithFallback(ai, preferredModel, contents, config) {
  const models = [
    preferredModel,
    ...FALLBACK_MODELS.filter((item) => item !== preferredModel),
  ];

  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({ model, contents, config });
        return { response, usedModel: model };
      } catch (err) {
        lastErr = err;
        if (!isRetryableError(err)) throw err;
        await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

app.post("/api/ask", async (req, res) => {
  const { question, model } = req.body;
  const apiKey = (req.header("x-gemini-api-key") || req.body?.apiKey || "").trim();

  if (!apiKey) return res.status(400).json({ error: "Gemini API key is required." });
  if (!question) return res.status(400).json({ error: "Question is required." });

  const preferredModel = FALLBACK_MODELS.includes(model) ? model : "gemini-4-hydrogen";
  const ai = new GoogleGenAI({ apiKey });
  const queriesRun = [];
  const contents = [{ role: "user", parts: [{ text: question }] }];
  let activeModel = preferredModel;

  const config = {
    systemInstruction:
      "You are a data analyst connected to a Super Paper Mario relational database via Sequelize. " +
      "Call get_schema first to inspect all 17 tables, primary keys, foreign keys, and columns, then run read-only " +
      "SELECT queries with run_readonly_sql to answer the user accurately. " +
      "You can also query v_character_inventory.",
    tools: geminiTools,
  };

  try {
    for (let step = 0; step < 6; step++) {
      const { response, usedModel } = await callModelWithFallback(ai, activeModel, contents, config);
      activeModel = usedModel;

      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const calls = parts.filter((p) => p.functionCall);

      if (calls.length === 0) {
        return res.json({ answer: response.text, queriesRun, usedModel });
      }

      contents.push(candidate.content);

      const toolResponses = [];
      for (const part of calls) {
        const { name, args } = part.functionCall;
        let output;
        try {
          if (name === "get_schema") {
            output = await m.sequelize.getDatabaseSchema();
          } else if (name === "run_readonly_sql") {
            queriesRun.push(args.sql);
            output = await m.sequelize.executeReadOnlySql(args.sql);
          }
        } catch (toolErr) {
          output = { error: toolErr.message };
        }

        toolResponses.push({
          functionResponse: { name, response: { result: output } },
        });
      }

      contents.push({ role: "user", parts: toolResponses });
    }

    res.status(500).json({ error: "Exceeded maximum tool-call steps." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

exports.api = onRequest(app);

if (!process.env.FUNCTION_TARGET && !process.env.K_SERVICE) {
  ensureDbReady().then(() => {
    app.listen(3000, () => console.log("Running on http://localhost:3000"));
  });
}