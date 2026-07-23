// Demo-mode API: same interface as the real server client in api.js, but
// backed by localStorage. Used when built with VITE_DEMO=1 (e.g. the
// claude.ai artifact preview) where no backend is reachable.

import { generatePatients } from "./data/generatePatients";
import { INITIAL_BED_COUNTS } from "./data/beds";
import { splitLegacyDoc } from "./data/splitLegacy";
import { fmtDate, isAbnormal } from "./utils/format";
import { BUILTIN_ROLES, builtinRole, isBuiltinRole, resolveCaps } from "./data/roles";

const P_KEY = "demo-emr-patients-v6";
const V_KEY = "demo-emr-vitals-v3";
const N_KEY = "demo-emr-notes-v3";
const B_KEY = "demo-emr-bedcounts-v3";
const U_KEY = "demo-emr-users-v2";
const S_KEY = "demo-emr-session-v3";
const R_KEY = "demo-emr-roles-v1";

const DEFAULT_USERS = [
  { id: 1, username: "admin", password: "admin1234", name: "ผู้ดูแลระบบ", role: "admin" },
  { id: 2, username: "doctor1", password: "doctor1234", name: "นพ. กิตติ เจริญ", role: "doctor" },
  { id: 3, username: "nurse1", password: "nurse1234", name: "พยาบาล วรรณี", role: "nurse" },
];

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupt entry — fall through
  }
  return fallback;
}

// Optional integer: blank → null (not recorded).
function demoInt(v) {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — demo keeps working in-memory per page
  }
}

// Same-tab realtime: storage events only fire in OTHER tabs, so demo
// mutations also dispatch a local event that demoConnectWS listens to.
function notify() {
  window.dispatchEvent(new CustomEvent("demo-emr-refresh"));
}

function seedIfNeeded() {
  if (load(P_KEY, null)) return;
  const docs = [];
  const vitals = [];
  const notes = [];
  for (const p of generatePatients()) {
    const split = splitLegacyDoc(p);
    docs.push(split.doc);
    vitals.push(...split.vitals);
    notes.push(...split.notes);
  }
  save(P_KEY, docs);
  save(V_KEY, vitals);
  save(N_KEY, notes);
}

function loadPatients() {
  seedIfNeeded();
  return load(P_KEY, []);
}

function loadUsers() {
  const existing = load(U_KEY, null);
  if (existing && Array.isArray(existing) && existing.length) return existing;
  save(U_KEY, DEFAULT_USERS);
  return DEFAULT_USERS;
}

// ----- roles / capabilities (mirror of server) -----
function loadCustomRoles() {
  return load(R_KEY, []);
}
function allRoles() {
  return [...BUILTIN_ROLES, ...loadCustomRoles()];
}
function roleCaps(slug) {
  const b = builtinRole(slug);
  if (b) return resolveCaps(b.caps);
  const c = loadCustomRoles().find((r) => r.slug === slug);
  return resolveCaps(c ? c.caps : {});
}
function roleLabelOf(slug) {
  return allRoles().find((r) => r.slug === slug)?.label || slug;
}

const publicUser = (u) => ({
  id: u.id, username: u.username, name: u.name, role: u.role,
  caps: roleCaps(u.role), roleLabel: roleLabelOf(u.role),
});
const me = () => load(S_KEY, null);

function guardArchivedDemo(patient) {
  if (patient?.status === "discharged" && !me()?.caps?.admin) {
    throw new Error("เวชระเบียนกลางแก้ไขได้เฉพาะผู้ดูแลระบบ");
  }
}

// Saved notes: admin edits any kind; nurse notes also editable with general cap.
function mayEditNoteDemo(kind) {
  const caps = me()?.caps || {};
  if (caps.admin) return true;
  if (kind === "nurse" && caps.general) return true;
  return false;
}

// Recompute lastVital/isAlert on the doc from the newest remaining row.
function refreshLastVitalDemo(patientId) {
  const rows = load(V_KEY, []).filter((v) => v.patientId === patientId).sort((a, b) => (a.ts < b.ts ? -1 : 1));
  const latest = rows[rows.length - 1];
  save(P_KEY, loadPatients().map((p) =>
    p.id === patientId
      ? latest
        ? { ...p, lastVital: { temp: latest.temp, bp: latest.sys + "/" + latest.dia, hr: latest.hr, spo2: latest.spo2 }, isAlert: isAbnormal(latest.temp, latest.sys, latest.hr, latest.spo2) }
        : { ...p, lastVital: { temp: "-", bp: "-", hr: "-", spo2: "-" }, isAlert: false }
      : p
  ));
}

export const demoApi = {
  async login(username, password) {
    const u = loadUsers().find((x) => x.username === String(username).trim());
    if (!u || u.password !== String(password)) {
      throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (โหมดทดลอง)");
    }
    save(S_KEY, publicUser(u));
    return { token: "demo-" + u.username, user: publicUser(u) };
  },

  async logout() {
    localStorage.removeItem(S_KEY);
    return { ok: true };
  },

  async me() {
    const u = me();
    if (!u) throw new Error("unauthorized");
    return { user: u };
  },

  async fetchAll() {
    return { patients: loadPatients(), bedCounts: load(B_KEY, { ...INITIAL_BED_COUNTS }) };
  },

  async admit(patient) {
    const list = loadPatients();
    if (list.some((p) => p.id === patient.id)) throw new Error("duplicate id");
    const split = splitLegacyDoc(patient);
    save(P_KEY, [...list, split.doc]);
    save(V_KEY, [...load(V_KEY, []), ...split.vitals]);
    save(N_KEY, [...load(N_KEY, []), ...split.notes]);
    notify();
    return { ok: true, id: patient.id };
  },

  async applyAction(id, _action, patient) {
    const list = loadPatients();
    const existing = list.find((p) => p.id === id);
    guardArchivedDemo(existing);
    if (existing && patient.name !== existing.name && !me()?.caps?.editName) {
      throw new Error("แก้ไขชื่อผู้ป่วยได้เฉพาะผู้จัดการหรือผู้ดูแลระบบ");
    }
    save(P_KEY, list.map((p) => (p.id === id ? patient : p)));
    notify();
    return { ok: true };
  },

  async saveBedCounts(bedCounts) {
    save(B_KEY, bedCounts);
    notify();
    return { ok: true };
  },

  // ----- vitals -----

  async listVitals(id, days) {
    seedIfNeeded();
    let rows = load(V_KEY, []).filter((v) => v.patientId === id);
    if (days > 0) {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      rows = rows.filter((v) => v.ts >= since);
    }
    rows.sort((a, b) => (a.ts < b.ts ? -1 : 1));
    return { vitals: rows };
  },

  async vitalsSummary(id) {
    seedIfNeeded();
    const rows = load(V_KEY, []).filter((v) => v.patientId === id);
    const byMonth = {};
    for (const v of rows) {
      const m = v.ts.slice(0, 7);
      (byMonth[m] ||= []).push(v);
    }
    const months = Object.entries(byMonth).map(([month, list]) => {
      const nums = (f) => list.map((v) => Number(v[f]));
      const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      const temps = nums("temp");
      return {
        month,
        count: list.length,
        alerts: list.filter((v) => isAbnormal(v.temp, v.sys, v.hr, v.spo2)).length,
        temp_avg: Number(avg(temps).toFixed(1)), temp_min: Math.min(...temps), temp_max: Math.max(...temps),
        sys_avg: Math.round(avg(nums("sys"))), sys_min: Math.min(...nums("sys")), sys_max: Math.max(...nums("sys")),
        dia_avg: Math.round(avg(nums("dia"))),
        hr_avg: Math.round(avg(nums("hr"))), hr_min: Math.min(...nums("hr")), hr_max: Math.max(...nums("hr")),
        spo2_avg: Math.round(avg(nums("spo2"))), spo2_min: Math.min(...nums("spo2")), spo2_max: Math.max(...nums("spo2")),
      };
    });
    months.sort((a, b) => (a.month > b.month ? -1 : 1));
    return { months };
  },

  async addVital(id, f) {
    const list = loadPatients();
    const patient = list.find((p) => p.id === id);
    if (!patient) throw new Error("not found");
    guardArchivedDemo(patient);
    const now = new Date();
    const temp = parseFloat(f.temp) || 36.5;
    const sys = parseInt(f.sys, 10) || 120;
    const dia = parseInt(f.dia, 10) || 75;
    const hr = parseInt(f.hr, 10) || 75;
    const rr = parseInt(f.rr, 10) || 18;
    const spo2 = parseInt(f.spo2, 10) || 98;
    const vital = {
      id: "v" + now.getTime(),
      patientId: id,
      ts: now.toISOString(),
      date: fmtDate(now),
      time: f.time || now.toTimeString().slice(0, 5),
      temp: temp.toFixed(1),
      sys, dia, hr, rr, spo2,
      recordedBy: f.recordedBy || me()?.name || "พยาบาล",
      intake: demoInt(f.intake), urine: demoInt(f.urine), stool: demoInt(f.stool),
    };
    save(V_KEY, [...load(V_KEY, []), vital]);
    save(P_KEY, list.map((p) =>
      p.id === id
        ? { ...p, lastVital: { temp: temp.toFixed(1), bp: sys + "/" + dia, hr, spo2 }, isAlert: isAbnormal(temp, sys, hr, spo2) }
        : p
    ));
    notify();
    return { ok: true, vital };
  },

  async updateVital(id, vid, f) {
    if (!me()?.caps?.general) throw new Error("ไม่มีสิทธิ์แก้ไขสัญญาณชีพ");
    let updated = null;
    const rows = load(V_KEY, []).map((v) => {
      if (v.id !== vid) return v;
      updated = {
        ...v,
        time: f.time || v.time,
        temp: (parseFloat(f.temp) || parseFloat(v.temp)).toFixed(1),
        sys: parseInt(f.sys, 10) || v.sys,
        dia: parseInt(f.dia, 10) || v.dia,
        hr: parseInt(f.hr, 10) || v.hr,
        rr: parseInt(f.rr, 10) || v.rr,
        spo2: parseInt(f.spo2, 10) || v.spo2,
        intake: f.intake !== undefined ? demoInt(f.intake) : v.intake ?? null,
        urine: f.urine !== undefined ? demoInt(f.urine) : v.urine ?? null,
        stool: f.stool !== undefined ? demoInt(f.stool) : v.stool ?? null,
      };
      return updated;
    });
    save(V_KEY, rows);
    refreshLastVitalDemo(id);
    notify();
    return { ok: true, vital: updated };
  },

  async deleteVital(id, vid) {
    if (!me()?.caps?.general) throw new Error("ไม่มีสิทธิ์ลบสัญญาณชีพ");
    save(V_KEY, load(V_KEY, []).filter((v) => v.id !== vid));
    refreshLastVitalDemo(id);
    notify();
    return { ok: true };
  },

  // ----- notes -----

  async listNotes(id, kind, limit, offset) {
    seedIfNeeded();
    const all = load(N_KEY, []).filter((n) => n.patientId === id && n.kind === kind);
    all.sort((a, b) => (a.ts > b.ts ? -1 : 1));
    const page = all.slice(offset, offset + limit).map(({ payload, ...meta }) => ({ ...meta, ...payload }));
    return { notes: page, total: all.length };
  },

  async addNote(id, kind, author, payload) {
    const patient = loadPatients().find((p) => p.id === id);
    if (!patient) throw new Error("not found");
    guardArchivedDemo(patient);
    const now = new Date();
    const stored = {
      id: "n" + now.getTime(),
      patientId: id,
      kind,
      ts: now.toISOString(),
      date: fmtDate(now),
      author: author || me()?.name || "-",
      payload,
    };
    save(N_KEY, [...load(N_KEY, []), stored]);
    notify();
    const { payload: pl, ...meta } = stored;
    return { ok: true, note: { ...meta, ...pl } };
  },

  async updateNote(id, nid, author, payload) {
    const existing = load(N_KEY, []).find((n) => n.id === nid);
    if (!mayEditNoteDemo(existing?.kind)) throw new Error("ไม่มีสิทธิ์แก้ไขบันทึกนี้");
    let updated = null;
    const rows = load(N_KEY, []).map((n) => {
      if (n.id !== nid) return n;
      updated = { ...n, author: author || n.author, payload };
      return updated;
    });
    save(N_KEY, rows);
    notify();
    if (!updated) throw new Error("not found");
    const { payload: pl, ...meta } = updated;
    return { ok: true, note: { ...meta, ...pl } };
  },

  async deleteNote(id, nid) {
    const existing = load(N_KEY, []).find((n) => n.id === nid);
    if (!mayEditNoteDemo(existing?.kind)) throw new Error("ไม่มีสิทธิ์ลบบันทึกนี้");
    save(N_KEY, load(N_KEY, []).filter((n) => n.id !== nid));
    notify();
    return { ok: true };
  },

  // ----- users -----

  async listUsers() {
    return { users: loadUsers().map(publicUser) };
  },

  async createUser({ username, password, name, role }) {
    const users = loadUsers();
    if (users.some((u) => u.username === username)) throw new Error("ชื่อผู้ใช้นี้มีอยู่แล้ว");
    if (!password || password.length < 8) throw new Error("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
    const user = { id: Date.now(), username, password, name, role };
    save(U_KEY, [...users, user]);
    return { user: publicUser(user) };
  },

  async deleteUser(id) {
    save(U_KEY, loadUsers().filter((u) => u.id !== Number(id)));
    return { ok: true };
  },

  async resetPassword(id, password) {
    if (!password || password.length < 8) throw new Error("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
    save(U_KEY, loadUsers().map((u) => (u.id === Number(id) ? { ...u, password } : u)));
    return { ok: true };
  },

  // ----- roles -----

  async listRoles() {
    return { roles: allRoles() };
  },

  async createRole({ label, caps }) {
    if (!label || !label.trim()) throw new Error("กรุณาตั้งชื่อบทบาท");
    const slug = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const role = { slug, label: label.trim(), builtin: false, caps: resolveCaps(caps) };
    save(R_KEY, [...loadCustomRoles(), role]);
    return { role };
  },

  async deleteRole(slug) {
    if (isBuiltinRole(slug)) throw new Error("ลบบทบาทมาตรฐานไม่ได้");
    const inUse = loadUsers().filter((u) => u.role === slug).length;
    if (inUse > 0) throw new Error(`ยังมีผู้ใช้ ${inUse} คนใช้บทบาทนี้`);
    save(R_KEY, loadCustomRoles().filter((r) => r.slug !== slug));
    return { ok: true };
  },

  // ----- backup (demo: JSON export of everything) -----

  async listBackups() {
    return { backups: [] };
  },

  async downloadBackup() {
    const data = {
      exportedAt: new Date().toISOString(),
      patients: loadPatients(),
      vitals: load(V_KEY, []),
      notes: load(N_KEY, []),
      bedCounts: load(B_KEY, { ...INITIAL_BED_COUNTS }),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    return { blob, filename: `emr-demo-export-${new Date().toISOString().slice(0, 10)}.json` };
  },
};

// Cross-tab (storage events) + same-tab (custom event) refresh signal.
export function demoConnectWS(onMessage, onStatus) {
  onStatus?.("online");
  const emitRefresh = () => onMessage({ type: "refresh" });
  const onStorage = (e) => {
    if ([P_KEY, V_KEY, N_KEY, B_KEY].includes(e.key)) emitRefresh();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("demo-emr-refresh", emitRefresh);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("demo-emr-refresh", emitRefresh);
  };
}
