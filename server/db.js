// Storage layer for the EMR server.
//
// This is the ONLY file that talks to the database. To migrate to another
// engine (Postgres, Supabase, ...) re-implement the exported functions here;
// nothing else in the server or frontend needs to change.
//
// Schema (SQLite):
//   users      — login accounts with role (admin/doctor/nurse/pt/ot/caregiver/viewer)
//   sessions   — bearer tokens
//   patients   — one row per patient, full record stored as JSON document
//   bedcounts  — number of beds per room (single JSON row)

import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { generatePatients } from "../src/data/generatePatients.js";
import { INITIAL_BED_COUNTS } from "../src/data/beds.js";
import { splitLegacyDoc, isLegacyDoc } from "../src/data/splitLegacy.js";
import { BUILTIN_ROLES, builtinRole, isBuiltinRole, resolveCaps } from "../src/data/roles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.EMR_DATA_DIR || join(__dirname, "data");
export const BACKUP_DIR = join(DATA_DIR, "backups");
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(BACKUP_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, "emr.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    doc TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS bedcounts (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    doc TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS vitals (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    ts TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    temp TEXT NOT NULL,
    sys INTEGER NOT NULL,
    dia INTEGER NOT NULL,
    hr INTEGER NOT NULL,
    rr INTEGER NOT NULL,
    spo2 INTEGER NOT NULL,
    recorded_by TEXT NOT NULL,
    intake INTEGER,
    urine INTEGER,
    stool INTEGER,
    other TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_vitals_patient_ts ON vitals(patient_id, ts);
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    ts TEXT NOT NULL,
    date TEXT NOT NULL,
    author TEXT NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notes_patient_kind_ts ON notes(patient_id, kind, ts);
  CREATE TABLE IF NOT EXISTS custom_roles (
    slug TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    caps TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migration: older databases had CHECK (role IN ('admin','doctor','nurse')) on
// the users table, which blocks the newer roles (pt/ot/caregiver/viewer).
// SQLite can't drop a CHECK, so rebuild the table once without it — the valid
// role list is enforced in the API layer instead.
{
  const usersSql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get()?.sql || "";
  if (usersSql.includes("CHECK")) {
    db.exec(`
      BEGIN;
      CREATE TABLE users_migrate (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO users_migrate (id, username, password_hash, name, role, created_at)
        SELECT id, username, password_hash, name, role, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_migrate RENAME TO users;
      COMMIT;
    `);
    console.log("[db] migrated users table: removed legacy role CHECK constraint");
  }
}

// Migration: older notes table restricted kind to doctor/nurse/pt, which blocks
// the new assessment kinds (adl/fall). Rebuild once without the CHECK.
{
  const notesSql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'notes'").get()?.sql || "";
  if (notesSql.includes("CHECK")) {
    db.exec(`
      BEGIN;
      CREATE TABLE notes_migrate (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        ts TEXT NOT NULL,
        date TEXT NOT NULL,
        author TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      INSERT INTO notes_migrate SELECT id, patient_id, kind, ts, date, author, payload FROM notes;
      DROP TABLE notes;
      ALTER TABLE notes_migrate RENAME TO notes;
      CREATE INDEX IF NOT EXISTS idx_notes_patient_kind_ts ON notes(patient_id, kind, ts);
      COMMIT;
    `);
    console.log("[db] migrated notes table: removed legacy kind CHECK constraint");
  }
}

// Migration: add intake/urine/stool (บันทึกน้ำเข้า-ออก) columns to older vitals tables.
{
  const cols = db.prepare("PRAGMA table_info(vitals)").all().map((c) => c.name);
  for (const col of ["intake", "urine", "stool"]) {
    if (!cols.includes(col)) {
      db.exec(`ALTER TABLE vitals ADD COLUMN ${col} INTEGER`);
      console.log(`[db] added vitals.${col} column`);
    }
  }
  if (!cols.includes("other")) {
    db.exec("ALTER TABLE vitals ADD COLUMN other TEXT");
    console.log("[db] added vitals.other column");
  }
}

const insertVitalStmt = () =>
  db.prepare("INSERT INTO vitals (id, patient_id, ts, date, time, temp, sys, dia, hr, rr, spo2, recorded_by, intake, urine, stool, other) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
const insertNoteStmt = () =>
  db.prepare("INSERT INTO notes (id, patient_id, kind, ts, date, author, payload) VALUES (?,?,?,?,?,?,?)");

function storeSplit(split) {
  const iv = insertVitalStmt();
  for (const v of split.vitals) iv.run(v.id, v.patientId, v.ts, v.date, v.time, v.temp, v.sys, v.dia, v.hr, v.rr, v.spo2, v.recordedBy, v.intake ?? null, v.urine ?? null, v.stool ?? null, v.other ?? null);
  const inote = insertNoteStmt();
  for (const n of split.notes) inote.run(n.id, n.patientId, n.kind, n.ts, n.date, n.author, JSON.stringify(n.payload));
}

// ---------- seeding ----------

const DEFAULT_USERS = [
  { username: "admin", password: "admin1234", name: "ผู้ดูแลระบบ", role: "admin" },
  { username: "doctor1", password: "doctor1234", name: "นพ. กิตติ เจริญ", role: "doctor" },
  { username: "nurse1", password: "nurse1234", name: "พยาบาล วรรณี", role: "nurse" },
];

export function seedIfEmpty() {
  // Migration: the family role was removed — clean it out of older databases.
  db.exec("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role = 'family')");
  db.exec("DELETE FROM users WHERE role = 'family'");

  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (userCount === 0) {
    const ins = db.prepare("INSERT INTO users (username, password_hash, name, role) VALUES (?,?,?,?)");
    for (const u of DEFAULT_USERS) {
      ins.run(u.username, bcrypt.hashSync(u.password, 10), u.name, u.role);
    }
    console.log("[db] seeded default users:", DEFAULT_USERS.map((u) => `${u.username}/${u.password}`).join(", "));
  }

  const patientCount = db.prepare("SELECT COUNT(*) AS c FROM patients").get().c;
  if (patientCount === 0) {
    const ins = db.prepare("INSERT INTO patients (id, doc) VALUES (?,?)");
    for (const p of generatePatients()) {
      const split = splitLegacyDoc(p);
      ins.run(split.doc.id, JSON.stringify(split.doc));
      storeSplit(split);
    }
    console.log("[db] patients table initialized (starts empty — admit real patients via the app)");
  } else {
    // Migration: move embedded vitals/notes arrays out of older patient docs.
    const legacy = db.prepare("SELECT id, doc FROM patients").all()
      .map((r) => JSON.parse(r.doc))
      .filter(isLegacyDoc);
    if (legacy.length > 0) {
      const upd = db.prepare("UPDATE patients SET doc = ?, updated_at = datetime('now') WHERE id = ?");
      for (const old of legacy) {
        const split = splitLegacyDoc(old);
        storeSplit(split);
        upd.run(JSON.stringify(split.doc), split.doc.id);
      }
      console.log(`[db] migrated ${legacy.length} legacy patient docs to split tables`);
    }
  }

  const bc = db.prepare("SELECT COUNT(*) AS c FROM bedcounts").get().c;
  if (bc === 0) {
    db.prepare("INSERT INTO bedcounts (id, doc) VALUES (1, ?)").run(JSON.stringify(INITIAL_BED_COUNTS));
  }
}

// ---------- users & sessions ----------

export function findUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

export function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

export function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?,?)").run(token, userId);
  return token;
}

export function getSessionUser(token) {
  if (!token) return null;
  const row = db
    .prepare(
      "SELECT u.id, u.username, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
    )
    .get(token);
  return row || null;
}

export function deleteSession(token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function listUsers() {
  return db.prepare("SELECT id, username, name, role, created_at FROM users ORDER BY id").all();
}

export function createUser({ username, password, name, role }) {
  const hash = bcrypt.hashSync(password, 10);
  const res = db.prepare("INSERT INTO users (username, password_hash, name, role) VALUES (?,?,?,?)").run(username, hash, name, role);
  return { id: Number(res.lastInsertRowid), username, name, role };
}

export function deleteUser(id) {
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function resetPassword(id, password) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
}

export function countAdmins() {
  return db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c;
}

export function getUserById(id) {
  return db.prepare("SELECT id, username, name, role FROM users WHERE id = ?").get(id);
}

// ---------- roles ----------

function customRoleRow(slug) {
  const r = db.prepare("SELECT slug, label, caps FROM custom_roles WHERE slug = ?").get(slug);
  return r ? { slug: r.slug, label: r.label, builtin: false, caps: JSON.parse(r.caps) } : null;
}

// All roles the facility can assign: built-in + admin-defined custom.
export function listRoles() {
  const custom = db.prepare("SELECT slug, label, caps FROM custom_roles ORDER BY created_at").all()
    .map((r) => ({ slug: r.slug, label: r.label, builtin: false, caps: JSON.parse(r.caps) }));
  return [...BUILTIN_ROLES, ...custom];
}

export function roleExists(slug) {
  return isBuiltinRole(slug) || Boolean(customRoleRow(slug));
}

export function isBuiltin(slug) {
  return isBuiltinRole(slug);
}

// Resolved capability object for a role slug (unknown role → no capabilities).
export function getRoleCaps(slug) {
  const b = builtinRole(slug);
  if (b) return resolveCaps(b.caps);
  const c = customRoleRow(slug);
  return resolveCaps(c ? c.caps : {});
}

export function getRoleLabel(slug) {
  const b = builtinRole(slug);
  if (b) return b.label;
  return customRoleRow(slug)?.label || slug;
}

export function createRole({ label, caps }) {
  const slug = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  db.prepare("INSERT INTO custom_roles (slug, label, caps) VALUES (?,?,?)").run(slug, label, JSON.stringify(resolveCaps(caps)));
  return { slug, label, builtin: false, caps: resolveCaps(caps) };
}

export function deleteRole(slug) {
  db.prepare("DELETE FROM custom_roles WHERE slug = ?").run(slug);
}

export function countUsersWithRole(slug) {
  return db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = ?").get(slug).c;
}

// ---------- patients ----------

export function listPatients() {
  return db.prepare("SELECT doc FROM patients").all().map((r) => JSON.parse(r.doc));
}

export function getPatient(id) {
  const row = db.prepare("SELECT doc FROM patients WHERE id = ?").get(id);
  return row ? JSON.parse(row.doc) : null;
}

export function upsertPatient(patient) {
  db.prepare(
    "INSERT INTO patients (id, doc, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc, updated_at = datetime('now')"
  ).run(patient.id, JSON.stringify(patient));
}

// New admission: strip embedded vitals/notes into their tables, store lean doc.
export function insertPatientSplit(patient) {
  const split = splitLegacyDoc(patient);
  db.prepare("INSERT INTO patients (id, doc) VALUES (?,?)").run(split.doc.id, JSON.stringify(split.doc));
  storeSplit(split);
  return split.doc;
}

// ---------- bed counts ----------

export function getBedCounts() {
  const row = db.prepare("SELECT doc FROM bedcounts WHERE id = 1").get();
  return row ? JSON.parse(row.doc) : { ...INITIAL_BED_COUNTS };
}

export function setBedCounts(counts) {
  db.prepare("INSERT INTO bedcounts (id, doc) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc").run(JSON.stringify(counts));
}

// ---------- vitals ----------

const rowToVital = (r) => ({
  id: r.id, patientId: r.patient_id, ts: r.ts, date: r.date, time: r.time,
  temp: r.temp, sys: r.sys, dia: r.dia, hr: r.hr, rr: r.rr, spo2: r.spo2,
  recordedBy: r.recorded_by,
  intake: r.intake, urine: r.urine, stool: r.stool, other: r.other,
});

// days = 0 → all history; otherwise a rolling window. Ascending by time.
export function listVitals(patientId, days) {
  if (days > 0) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    return db.prepare("SELECT * FROM vitals WHERE patient_id = ? AND ts >= ? ORDER BY ts").all(patientId, since).map(rowToVital);
  }
  return db.prepare("SELECT * FROM vitals WHERE patient_id = ? ORDER BY ts").all(patientId).map(rowToVital);
}

export function addVitalRow(v) {
  insertVitalStmt().run(v.id, v.patientId, v.ts, v.date, v.time, v.temp, v.sys, v.dia, v.hr, v.rr, v.spo2, v.recordedBy, v.intake ?? null, v.urine ?? null, v.stool ?? null, v.other ?? null);
  return v;
}

export function getVital(id) {
  const r = db.prepare("SELECT * FROM vitals WHERE id = ?").get(id);
  return r ? rowToVital(r) : null;
}

export function updateVitalRow(id, f) {
  db.prepare("UPDATE vitals SET time = ?, temp = ?, sys = ?, dia = ?, hr = ?, rr = ?, spo2 = ?, intake = ?, urine = ?, stool = ?, other = ? WHERE id = ?")
    .run(f.time, f.temp, f.sys, f.dia, f.hr, f.rr, f.spo2, f.intake ?? null, f.urine ?? null, f.stool ?? null, f.other ?? null, id);
  return getVital(id);
}

export function deleteVitalRow(id) {
  db.prepare("DELETE FROM vitals WHERE id = ?").run(id);
}

export function latestVital(patientId) {
  const r = db.prepare("SELECT * FROM vitals WHERE patient_id = ? ORDER BY ts DESC LIMIT 1").get(patientId);
  return r ? rowToVital(r) : null;
}

// Monthly aggregates for the long-stay summary view (newest month first).
export function vitalsSummary(patientId) {
  return db.prepare(`
    SELECT substr(ts, 1, 7) AS month,
           COUNT(*) AS count,
           SUM(CASE WHEN CAST(temp AS REAL) >= 37.6 OR sys >= 150 OR sys < 95 OR hr >= 105 OR hr < 55 OR spo2 < 94 THEN 1 ELSE 0 END) AS alerts,
           ROUND(AVG(CAST(temp AS REAL)), 1) AS temp_avg, MIN(CAST(temp AS REAL)) AS temp_min, MAX(CAST(temp AS REAL)) AS temp_max,
           ROUND(AVG(sys)) AS sys_avg, MIN(sys) AS sys_min, MAX(sys) AS sys_max,
           ROUND(AVG(dia)) AS dia_avg,
           ROUND(AVG(hr)) AS hr_avg, MIN(hr) AS hr_min, MAX(hr) AS hr_max,
           ROUND(AVG(spo2)) AS spo2_avg, MIN(spo2) AS spo2_min, MAX(spo2) AS spo2_max
    FROM vitals WHERE patient_id = ?
    GROUP BY substr(ts, 1, 7)
    ORDER BY month DESC
  `).all(patientId);
}

// ---------- notes ----------

const rowToNote = (r) => ({
  id: r.id, patientId: r.patient_id, kind: r.kind, ts: r.ts, date: r.date,
  author: r.author, ...JSON.parse(r.payload),
});

export function listNotes(patientId, kind, limit, offset) {
  const total = db.prepare("SELECT COUNT(*) AS c FROM notes WHERE patient_id = ? AND kind = ?").get(patientId, kind).c;
  const notes = db
    .prepare("SELECT * FROM notes WHERE patient_id = ? AND kind = ? ORDER BY ts DESC LIMIT ? OFFSET ?")
    .all(patientId, kind, limit, offset)
    .map(rowToNote);
  return { notes, total };
}

export function addNoteRow(n) {
  insertNoteStmt().run(n.id, n.patientId, n.kind, n.ts, n.date, n.author, JSON.stringify(n.payload));
  return rowToNote({ ...n, patient_id: n.patientId, payload: JSON.stringify(n.payload) });
}

export function getNote(id) {
  const r = db.prepare("SELECT * FROM notes WHERE id = ?").get(id);
  return r ? rowToNote(r) : null;
}

export function updateNoteRow(id, { author, payload }) {
  db.prepare("UPDATE notes SET author = ?, payload = ? WHERE id = ?").run(author, JSON.stringify(payload), id);
  return getNote(id);
}

export function deleteNoteRow(id) {
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
}

// ---------- backup ----------

// Consistent snapshot of the whole database into a single file.
export function backupTo(path) {
  rmSync(path, { force: true });
  db.exec(`VACUUM INTO '${path.replaceAll("'", "''")}'`);
  return path;
}

// Nightly rotation: keep 30 daily + 12 monthly snapshots, self-pruning.
export function runScheduledBackup() {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const files = readdirSync(BACKUP_DIR);

  if (!files.includes(`daily-${day}.db`)) {
    backupTo(join(BACKUP_DIR, `daily-${day}.db`));
    console.log(`[backup] daily-${day}.db created`);
  }
  if (!files.includes(`monthly-${month}.db`)) {
    backupTo(join(BACKUP_DIR, `monthly-${month}.db`));
    console.log(`[backup] monthly-${month}.db created`);
  }

  const fresh = readdirSync(BACKUP_DIR);
  const prune = (prefix, keep) => {
    fresh.filter((f) => f.startsWith(prefix)).sort().reverse().slice(keep)
      .forEach((f) => rmSync(join(BACKUP_DIR, f), { force: true }));
  };
  prune("daily-", 30);
  prune("monthly-", 12);
}

export function listBackups() {
  return readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".db")).sort().reverse();
}
