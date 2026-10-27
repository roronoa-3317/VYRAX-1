"use strict";
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "data", "db.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA, "utf8"));
  } catch (_) {
    return { apps: {}, audit: [], seq: 0 };
  }
}

let db = load();

function persist() {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  const tmp = DATA + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DATA);
}

function nextId() {
  db.seq = (db.seq || 0) + 1;
  return "AP-" + String(db.seq).padStart(4, "0");
}

function audit(actor, action, id, detail) {
  db.audit.unshift({
    ts: new Date().toISOString(),
    actor,
    action,
    id: id || "",
    detail: detail || "",
  });
  db.audit = db.audit.slice(0, 500);
  persist();
}

function save() {
  persist();
}

module.exports = { db, nextId, audit, save };
