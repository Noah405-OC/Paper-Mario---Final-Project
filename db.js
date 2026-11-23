require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { Sequelize, QueryTypes } = require("sequelize");

function sanitizeValue(v) {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  return v;
}

function executePrepared(stmt, method, params) {
  if (!params) {
    return stmt[method]();
  }
  if (Array.isArray(params)) {
    return stmt[method](...params.map(sanitizeValue));
  }
  if (typeof params === "object") {
    const entries = Object.entries(params);
    if (entries.length === 0) {
      return stmt[method]();
    }
    if (typeof stmt.setAllowUnknownNamedParameters === "function") {
      stmt.setAllowUnknownNamedParameters(true);
    }
    const clean = {};
    for (const [k, v] of entries) {
      clean[k] = sanitizeValue(v);
    }
    return stmt[method](clean);
  }
  return stmt[method](sanitizeValue(params));
}

class NodeSqliteDatabase {
  constructor(filename, mode, callback) {
    try {
      const readOnly = mode === 1;
      this.db = new DatabaseSync(filename, { readOnly });
      if (callback) queueMicrotask(() => callback(null));
    } catch (err) {
      if (callback) queueMicrotask(() => callback(err));
    }
  }

  configure() {}

  serialize(fn) {
    if (fn) fn();
  }

  exec(sql, callback) {
    try {
      this.db.exec(sql);
      if (callback) callback.call({ lastID: 0, changes: 0 }, null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  run(sql, params, callback) {
    if (typeof params === "function") {
      callback = params;
      params = null;
    }
    try {
      const stmt = this.db.prepare(sql);
      const res = executePrepared(stmt, "run", params);
      const ctx = {
        lastID: Number(res.lastInsertRowid || 0),
        changes: Number(res.changes || 0),
      };
      if (callback) callback.call(ctx, null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  all(sql, params, callback) {
    if (typeof params === "function") {
      callback = params;
      params = null;
    }
    try {
      const stmt = this.db.prepare(sql);
      const rows = executePrepared(stmt, "all", params);
      if (callback) callback(null, rows);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  get(sql, params, callback) {
    if (typeof params === "function") {
      callback = params;
      params = null;
    }
    try {
      const stmt = this.db.prepare(sql);
      const row = executePrepared(stmt, "get", params);
      if (callback) callback(null, row);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  close(callback) {
    try {
      if (this.db.isOpen) this.db.close();
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }
}

const nodeSqliteDialectModule = {
  OPEN_READONLY: 1,
  OPEN_READWRITE: 2,
  OPEN_CREATE: 4,
  OPEN_FULLMUTEX: 65536,
  Database: NodeSqliteDatabase,
};

const isCloud = Boolean(process.env.K_SERVICE || process.env.FUNCTION_TARGET);
const bundledDbPath = path.resolve("./data/paper_mario.sqlite");
const storagePath = isCloud ? "/tmp/paper_mario.sqlite" : bundledDbPath;

const useMysql = Boolean(process.env.DB_HOST && process.env.DB_NAME);

if (!useMysql) {
  if (isCloud) {
    if (!fs.existsSync(storagePath) && fs.existsSync(bundledDbPath)) {
      fs.copyFileSync(bundledDbPath, storagePath);
    }
  } else {
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });
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
      dialectModule: nodeSqliteDialectModule,
      storage: storagePath,
      logging: false,
      define: { timestamps: false, freezeTableName: true },
    });

async function getDatabaseSchema() {
  const qi = sequelize.getQueryInterface();
  const tables = (await qi.showAllTables()).filter(
    (t) => t !== "sqlite_sequence" && !t.startsWith("v_")
  );
  const schema = {};
  for (const table of tables) {
    schema[table] = await qi.describeTable(table);
  }
  return schema;
}

async function executeReadOnlySql(rawSql) {
  const cleaned = rawSql.trim().replace(/;+$/, "");
  const upper = cleaned.toUpperCase();

  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    throw new Error("Blocked: Only SELECT queries are permitted in Q&A mode.");
  }
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|PRAGMA)\b/.test(upper)) {
    throw new Error("Blocked: Mutating or administrative keywords are not allowed.");
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