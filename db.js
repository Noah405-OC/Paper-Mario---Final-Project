require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { Sequelize, QueryTypes } = require("sequelize");

function cleanParam(val) {
  if (val === undefined) return null;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (val instanceof Date) return val.toISOString();
  return val;
}

function runStmt(stmt, method, params) {
  if (!params) return stmt[method]();
  if (Array.isArray(params)) return stmt[method](...params.map(cleanParam));
  if (typeof params === "object") {
    const entries = Object.entries(params);
    if (entries.length === 0) return stmt[method]();
    if (typeof stmt.setAllowUnknownNamedParameters === "function") {
      stmt.setAllowUnknownNamedParameters(true);
    }
    const mapped = {};
    for (const [k, v] of entries) {
      mapped[k] = cleanParam(v);
    }
    return stmt[method](mapped);
  }
  return stmt[method](cleanParam(params));
}

class SqliteDriver {
  constructor(filename, mode, cb) {
    try {
      this.db = new DatabaseSync(filename, { readOnly: mode === 1 });
      if (cb) queueMicrotask(() => cb(null));
    } catch (err) {
      if (cb) queueMicrotask(() => cb(err));
    }
  }

  configure() {}

  serialize(fn) {
    if (fn) fn();
  }

  exec(sql, cb) {
    try {
      this.db.exec(sql);
      if (cb) cb.call({ lastID: 0, changes: 0 }, null);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  run(sql, params, cb) {
    if (typeof params === "function") {
      cb = params;
      params = null;
    }
    try {
      const stmt = this.db.prepare(sql);
      const info = runStmt(stmt, "run", params);
      const ctx = {
        lastID: Number(info.lastInsertRowid || 0),
        changes: Number(info.changes || 0),
      };
      if (cb) cb.call(ctx, null);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  all(sql, params, cb) {
    if (typeof params === "function") {
      cb = params;
      params = null;
    }
    try {
      const stmt = this.db.prepare(sql);
      const rows = runStmt(stmt, "all", params);
      if (cb) cb(null, rows);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  get(sql, params, cb) {
    if (typeof params === "function") {
      cb = params;
      params = null;
    }
    try {
      const stmt = this.db.prepare(sql);
      const row = runStmt(stmt, "get", params);
      if (cb) cb(null, row);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  close(cb) {
    try {
      if (this.db.isOpen) this.db.close();
      if (cb) cb(null);
    } catch (err) {
      if (cb) cb(err);
    }
  }
}

const sqliteModule = {
  OPEN_READONLY: 1,
  OPEN_READWRITE: 2,
  OPEN_CREATE: 4,
  OPEN_FULLMUTEX: 65536,
  Database: SqliteDriver,
};

const isCloud = Boolean(process.env.K_SERVICE || process.env.FUNCTION_TARGET);
const localDbFile = path.resolve("./data/paper_mario.sqlite");
const dbFile = isCloud ? "/tmp/paper_mario.sqlite" : localDbFile;
const useMysql = Boolean(process.env.DB_HOST && process.env.DB_NAME);

if (!useMysql) {
  if (isCloud) {
    if (!fs.existsSync(dbFile) && fs.existsSync(localDbFile)) {
      fs.copyFileSync(localDbFile, dbFile);
    }
  } else {
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  }
}

const sequelize = useMysql
  ? new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
      host: process.env.DB_HOST,
      dialect: "mysql",
      logging: false,
      define: { timestamps: false, freezeTableName: true },
    })
  : new Sequelize({
      dialect: "sqlite",
      dialectModule: sqliteModule,
      storage: dbFile,
      logging: false,
      define: { timestamps: false, freezeTableName: true },
    });

async function getDatabaseSchema() {
  const qi = sequelize.getQueryInterface();
  const tables = (await qi.showAllTables()).filter(
    (t) => t !== "sqlite_sequence" && !t.startsWith("v_")
  );
  const schema = {};
  for (const t of tables) {
    schema[t] = await qi.describeTable(t);
  }
  return schema;
}

async function executeReadOnlySql(rawSql) {
  const cleaned = rawSql.trim().replace(/;+$/, "");
  const upper = cleaned.toUpperCase();
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    throw new Error("Only SELECT queries are allowed.");
  }
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|PRAGMA)\b/.test(upper)) {
    throw new Error("Write or admin SQL keywords are blocked.");
  }
  const tx = await sequelize.transaction();
  try {
    const rows = await sequelize.query(cleaned, {
      type: QueryTypes.SELECT,
      transaction: tx,
    });
    await tx.rollback();
    return rows;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

sequelize.getDatabaseSchema = getDatabaseSchema;
sequelize.executeReadOnlySql = executeReadOnlySql;

module.exports = sequelize;