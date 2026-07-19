// EMR server: REST API + realtime WebSocket + serves the built frontend.
//
// Run:   node server/index.js          (after `npm run build`)
// Port:  EMR_PORT env var, default 3000
//
// Trust model: this is an internal tool for a single facility on a private
// network. Clients send updated patient documents; the server enforces
// role-based permission per action type and persists + broadcasts them.

import express from "express";
import { createServer } from "node:http";
import { networkInterfaces, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, rmSync } from "node:fs";
import { WebSocketServer } from "ws";
import * as db from "./db.js";
import { fmtDate, isAbnormal } from "../src/utils/format.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// PORT: convention used by cloud hosts (Render/Railway/Fly); EMR_PORT for local override.
const PORT = parseInt(process.env.PORT || process.env.EMR_PORT || "3000", 10);
const DIST = join(__dirname, "..", "dist");

db.seedIfEmpty();

const app = express();
app.use(express.json({ limit: "2mb" }));

// ---------- auth ----------

function tokenFrom(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

function requireAuth(req, res, next) {
  const user = db.getSessionUser(tokenFrom(req));
  if (!user) return res.status(401).json({ error: "unauthorized" });
  req.user = user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "forbidden", need: roles });
    next();
  };
}

// Which roles may perform each patient-document action.
const WRITE_ROLES = ["nurse", "doctor", "admin"];
const ACTION_ROLES = {
  saveCover: WRITE_ROLES,
  saveHistory: WRITE_ROLES,
  addMedication: WRITE_ROLES,
  editMedication: WRITE_ROLES,
  removeMedication: WRITE_ROLES,
  moveBed: WRITE_ROLES,
  discharge: WRITE_ROLES,
  readmit: WRITE_ROLES,
  saveAppointments: WRITE_ROLES,
  adminEditLog: ["admin"], // แก้ไข/ลบประวัติการเปลี่ยนแปลงยาย้อนหลัง
};

// Roles allowed to add each kind of note (vitals use WRITE_ROLES).
const NOTE_ROLES = {
  doctor: ["doctor", "admin"],
  nurse: WRITE_ROLES,
  pt: WRITE_ROLES,
};

// Archived (discharged) records may only be modified by admin.
function guardArchived(patient, user, res) {
  if (patient.status === "discharged" && user.role !== "admin") {
    res.status(403).json({ error: "เวชระเบียนกลางแก้ไขได้เฉพาะผู้ดูแลระบบ" });
    return false;
  }
  return true;
}

// ---------- realtime ----------

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://x");
  const user = db.getSessionUser(url.searchParams.get("token"));
  if (!user) {
    ws.close(4401, "unauthorized");
    return;
  }
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}

// ---------- auth routes ----------

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = username ? db.findUserByUsername(String(username).trim()) : null;
  if (!user || !db.verifyPassword(user, String(password || ""))) {
    return res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
  }
  const token = db.createSession(user.id);
  res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

app.post("/api/logout", requireAuth, (req, res) => {
  db.deleteSession(tokenFrom(req));
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---------- patient routes ----------

app.get("/api/patients", requireAuth, (req, res) => {
  res.json({ patients: db.listPatients(), bedCounts: db.getBedCounts() });
});

// Admit a new patient (client builds the full record; embedded vitals/notes
// from the admission form are split into their own tables).
app.post("/api/patients", requireAuth, requireRole(...WRITE_ROLES), (req, res) => {
  const p = req.body?.patient;
  if (!p || !p.id || !p.name) return res.status(400).json({ error: "invalid patient" });
  if (db.getPatient(p.id)) return res.status(409).json({ error: "duplicate id" });
  const doc = db.insertPatientSplit(p);
  broadcast({ type: "patient", patient: doc, by: req.user.username });
  res.json({ ok: true, id: doc.id });
});

// Apply an action: client sends the updated full document + action name.
app.put("/api/patients/:id", requireAuth, (req, res) => {
  const { action, patient } = req.body || {};
  const allowed = ACTION_ROLES[action];
  if (!allowed) return res.status(400).json({ error: "unknown action" });
  if (!allowed.includes(req.user.role)) return res.status(403).json({ error: "forbidden" });
  if (!patient || patient.id !== req.params.id) return res.status(400).json({ error: "invalid patient doc" });
  const existing = db.getPatient(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  if (!guardArchived(existing, req.user, res)) return;
  db.upsertPatient(patient);
  broadcast({ type: "patient", patient, by: req.user.username });
  res.json({ ok: true });
});

// ---------- vitals (dedicated table, windowed) ----------

app.get("/api/patients/:id/vitals", requireAuth, (req, res) => {
  const days = Math.max(0, parseInt(req.query.days || "0", 10) || 0);
  res.json({ vitals: db.listVitals(req.params.id, days) });
});

app.get("/api/patients/:id/vitals/summary", requireAuth, (req, res) => {
  res.json({ months: db.vitalsSummary(req.params.id) });
});

app.post("/api/patients/:id/vitals", requireAuth, requireRole(...WRITE_ROLES), (req, res) => {
  const patient = db.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ error: "not found" });
  if (!guardArchived(patient, req.user, res)) return;

  const f = req.body || {};
  if (!f.temp && !f.sys) return res.status(400).json({ error: "ต้องกรอกอย่างน้อย Temp หรือ BP" });
  const now = new Date();
  const temp = parseFloat(f.temp) || 36.5;
  const sys = parseInt(f.sys, 10) || 120;
  const dia = parseInt(f.dia, 10) || 75;
  const hr = parseInt(f.hr, 10) || 75;
  const rr = parseInt(f.rr, 10) || 18;
  const spo2 = parseInt(f.spo2, 10) || 98;

  const vital = db.addVitalRow({
    id: "v" + now.getTime() + Math.random().toString(36).slice(2, 6),
    patientId: patient.id,
    ts: now.toISOString(),
    date: fmtDate(now),
    time: f.time || now.toTimeString().slice(0, 5),
    temp: temp.toFixed(1),
    sys, dia, hr, rr, spo2,
    recordedBy: f.recordedBy || req.user.name,
  });

  const updated = {
    ...patient,
    lastVital: { temp: temp.toFixed(1), bp: sys + "/" + dia, hr, spo2 },
    isAlert: isAbnormal(temp, sys, hr, spo2),
  };
  db.upsertPatient(updated);

  broadcast({ type: "vital", patientId: patient.id, vital, by: req.user.username });
  broadcast({ type: "patient", patient: updated, by: req.user.username });
  res.json({ ok: true, vital });
});

// Recompute the denormalized lastVital/isAlert on the doc from the newest row.
function refreshLastVital(patient, actor) {
  const latest = db.latestVital(patient.id);
  const updated = latest
    ? {
        ...patient,
        lastVital: { temp: latest.temp, bp: latest.sys + "/" + latest.dia, hr: latest.hr, spo2: latest.spo2 },
        isAlert: isAbnormal(latest.temp, latest.sys, latest.hr, latest.spo2),
      }
    : { ...patient, lastVital: { temp: "-", bp: "-", hr: "-", spo2: "-" }, isAlert: false };
  db.upsertPatient(updated);
  broadcast({ type: "patient", patient: updated, by: actor });
}

// Admin-only: correct or remove a saved vital entry.
app.put("/api/patients/:id/vitals/:vid", requireAuth, requireRole("admin"), (req, res) => {
  const patient = db.getPatient(req.params.id);
  const existing = db.getVital(req.params.vid);
  if (!patient || !existing || existing.patientId !== patient.id) return res.status(404).json({ error: "not found" });
  const f = req.body || {};
  const vital = db.updateVitalRow(existing.id, {
    time: f.time || existing.time,
    temp: (parseFloat(f.temp) || parseFloat(existing.temp)).toFixed(1),
    sys: parseInt(f.sys, 10) || existing.sys,
    dia: parseInt(f.dia, 10) || existing.dia,
    hr: parseInt(f.hr, 10) || existing.hr,
    rr: parseInt(f.rr, 10) || existing.rr,
    spo2: parseInt(f.spo2, 10) || existing.spo2,
  });
  refreshLastVital(patient, req.user.username);
  broadcast({ type: "vital-updated", patientId: patient.id, vital, by: req.user.username });
  res.json({ ok: true, vital });
});

app.delete("/api/patients/:id/vitals/:vid", requireAuth, requireRole("admin"), (req, res) => {
  const patient = db.getPatient(req.params.id);
  const existing = db.getVital(req.params.vid);
  if (!patient || !existing || existing.patientId !== patient.id) return res.status(404).json({ error: "not found" });
  db.deleteVitalRow(existing.id);
  refreshLastVital(patient, req.user.username);
  broadcast({ type: "vital-deleted", patientId: patient.id, vitalId: existing.id, by: req.user.username });
  res.json({ ok: true });
});

// ---------- notes (dedicated table, paginated) ----------

app.get("/api/patients/:id/notes", requireAuth, (req, res) => {
  const kind = String(req.query.kind || "");
  if (!NOTE_ROLES[kind]) return res.status(400).json({ error: "invalid kind" });
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10) || 20));
  const offset = Math.max(0, parseInt(req.query.offset || "0", 10) || 0);
  res.json(db.listNotes(req.params.id, kind, limit, offset));
});

app.post("/api/patients/:id/notes", requireAuth, (req, res) => {
  const { kind, author, payload } = req.body || {};
  const allowed = NOTE_ROLES[kind];
  if (!allowed) return res.status(400).json({ error: "invalid kind" });
  if (!allowed.includes(req.user.role)) return res.status(403).json({ error: "forbidden" });
  if (!payload || typeof payload !== "object") return res.status(400).json({ error: "invalid payload" });
  const patient = db.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ error: "not found" });
  if (!guardArchived(patient, req.user, res)) return;

  const now = new Date();
  const note = db.addNoteRow({
    id: "n" + now.getTime() + Math.random().toString(36).slice(2, 6),
    patientId: patient.id,
    kind,
    ts: now.toISOString(),
    date: fmtDate(now),
    author: author || req.user.name,
    payload,
  });
  broadcast({ type: "note", patientId: patient.id, kind, note, by: req.user.username });
  res.json({ ok: true, note });
});

// Admin-only: correct or remove a saved note.
app.put("/api/patients/:id/notes/:nid", requireAuth, requireRole("admin"), (req, res) => {
  const patient = db.getPatient(req.params.id);
  const existing = db.getNote(req.params.nid);
  if (!patient || !existing || existing.patientId !== patient.id) return res.status(404).json({ error: "not found" });
  const { author, payload } = req.body || {};
  if (!payload || typeof payload !== "object") return res.status(400).json({ error: "invalid payload" });
  const note = db.updateNoteRow(existing.id, { author: author || existing.author, payload });
  broadcast({ type: "note-updated", patientId: patient.id, kind: existing.kind, note, by: req.user.username });
  res.json({ ok: true, note });
});

app.delete("/api/patients/:id/notes/:nid", requireAuth, requireRole("admin"), (req, res) => {
  const patient = db.getPatient(req.params.id);
  const existing = db.getNote(req.params.nid);
  if (!patient || !existing || existing.patientId !== patient.id) return res.status(404).json({ error: "not found" });
  db.deleteNoteRow(existing.id);
  broadcast({ type: "note-deleted", patientId: patient.id, kind: existing.kind, noteId: existing.id, by: req.user.username });
  res.json({ ok: true });
});

// ---------- backup ----------

app.get("/api/backups", requireAuth, requireRole("admin"), (req, res) => {
  res.json({ backups: db.listBackups() });
});

app.get("/api/backup", requireAuth, requireRole("admin"), (req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  const tmp = join(tmpdir(), `emr-backup-${day}-${Date.now()}.db`);
  db.backupTo(tmp);
  res.download(tmp, `emr-backup-${day}.db`, () => rmSync(tmp, { force: true }));
});

// ---------- bed counts ----------

app.put("/api/bedcounts", requireAuth, requireRole(...WRITE_ROLES), (req, res) => {
  const counts = req.body?.bedCounts;
  if (!counts || typeof counts !== "object") return res.status(400).json({ error: "invalid" });
  db.setBedCounts(counts);
  broadcast({ type: "bedcounts", bedCounts: counts, by: req.user.username });
  res.json({ ok: true });
});

// ---------- user management (admin) ----------

app.get("/api/users", requireAuth, requireRole("admin"), (req, res) => {
  res.json({ users: db.listUsers() });
});

app.post("/api/users", requireAuth, requireRole("admin"), (req, res) => {
  const { username, password, name, role } = req.body || {};
  if (!username || !password || !name || !["admin", "doctor", "nurse"].includes(role)) {
    return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });
  }
  if (String(password).length < 8) return res.status(400).json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" });
  if (db.findUserByUsername(username)) return res.status(409).json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" });
  res.json({ user: db.createUser({ username, password, name, role }) });
});

app.delete("/api/users/:id", requireAuth, requireRole("admin"), (req, res) => {
  const target = db.getUserById(Number(req.params.id));
  if (!target) return res.status(404).json({ error: "not found" });
  if (target.role === "admin" && db.countAdmins() <= 1) {
    return res.status(400).json({ error: "ต้องเหลือผู้ดูแลระบบอย่างน้อย 1 คน" });
  }
  db.deleteUser(target.id);
  res.json({ ok: true });
});

app.post("/api/users/:id/password", requireAuth, (req, res) => {
  const targetId = Number(req.params.id);
  const { password } = req.body || {};
  if (req.user.role !== "admin" && req.user.id !== targetId) return res.status(403).json({ error: "forbidden" });
  if (!password || String(password).length < 8) return res.status(400).json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" });
  if (!db.getUserById(targetId)) return res.status(404).json({ error: "not found" });
  db.resetPassword(targetId, String(password));
  res.json({ ok: true });
});

// ---------- static frontend ----------

if (existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(join(DIST, "index.html")));
}

// Automatic backups: on start + hourly check (creates one per day/month, prunes old).
try {
  db.runScheduledBackup();
} catch (e) {
  console.error("[backup] failed:", e.message);
}
setInterval(() => {
  try {
    db.runScheduledBackup();
  } catch (e) {
    console.error("[backup] failed:", e.message);
  }
}, 60 * 60 * 1000);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅ EMR server running`);
  console.log(`   Local:   http://localhost:${PORT}`);
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === "IPv4" && !a.internal) {
        console.log(`   Network: http://${a.address}:${PORT}   ← ใช้ URL นี้บนมือถือ (WiFi เดียวกัน)`);
      }
    }
  }
  console.log("");
});
