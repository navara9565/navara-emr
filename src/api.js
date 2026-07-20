// HTTP + WebSocket client for the EMR server. Same-origin in production
// (the server serves the built frontend); the Vite dev proxy handles dev.
//
// Built with VITE_DEMO=1 the whole client is swapped for a localStorage
// mock (src/demoApi.js) so the app runs with no backend at all.

import { demoApi, demoConnectWS } from "./demoApi";

const DEMO = import.meta.env.VITE_DEMO === "1";
const TOKEN_KEY = "emr-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: "Bearer " + getToken() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

const realApi = {
  login: (username, password) => request("POST", "/api/login", { username, password }),
  logout: () => request("POST", "/api/logout"),
  me: () => request("GET", "/api/me"),
  fetchAll: () => request("GET", "/api/patients"),
  admit: (patient) => request("POST", "/api/patients", { patient }),
  applyAction: (id, action, patient) => request("PUT", "/api/patients/" + id, { action, patient }),
  saveBedCounts: (bedCounts) => request("PUT", "/api/bedcounts", { bedCounts }),
  listUsers: () => request("GET", "/api/users"),
  createUser: (u) => request("POST", "/api/users", u),
  deleteUser: (id) => request("DELETE", "/api/users/" + id),
  resetPassword: (id, password) => request("POST", `/api/users/${id}/password`, { password }),
  listRoles: () => request("GET", "/api/roles"),
  createRole: (role) => request("POST", "/api/roles", role),
  deleteRole: (slug) => request("DELETE", "/api/roles/" + slug),

  listVitals: (id, days) => request("GET", `/api/patients/${id}/vitals?days=${days}`),
  vitalsSummary: (id) => request("GET", `/api/patients/${id}/vitals/summary`),
  addVital: (id, payload) => request("POST", `/api/patients/${id}/vitals`, payload),
  updateVital: (id, vid, payload) => request("PUT", `/api/patients/${id}/vitals/${vid}`, payload),
  deleteVital: (id, vid) => request("DELETE", `/api/patients/${id}/vitals/${vid}`),
  listNotes: (id, kind, limit, offset) => request("GET", `/api/patients/${id}/notes?kind=${kind}&limit=${limit}&offset=${offset}`),
  addNote: (id, kind, author, payload) => request("POST", `/api/patients/${id}/notes`, { kind, author, payload }),
  updateNote: (id, nid, author, payload) => request("PUT", `/api/patients/${id}/notes/${nid}`, { author, payload }),
  deleteNote: (id, nid) => request("DELETE", `/api/patients/${id}/notes/${nid}`),
  listBackups: () => request("GET", "/api/backups"),

  downloadBackup: async () => {
    const res = await fetch("/api/backup", { headers: { Authorization: "Bearer " + getToken() } });
    if (!res.ok) throw new Error("ดาวน์โหลดไม่สำเร็จ");
    const blob = await res.blob();
    return { blob, filename: `emr-backup-${new Date().toISOString().slice(0, 10)}.db` };
  },
};

// Realtime connection; auto-reconnects. onMessage receives parsed messages.
function realConnectWS(onMessage, onStatus) {
  let ws = null;
  let closed = false;
  let retry = 0;

  const open = () => {
    if (closed) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${window.location.host}/ws?token=${getToken()}`);
    ws.onopen = () => {
      retry = 0;
      onStatus?.("online");
    };
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {
        // ignore malformed frame
      }
    };
    ws.onclose = () => {
      onStatus?.("offline");
      if (!closed) setTimeout(open, Math.min(1000 * 2 ** retry++, 15000));
    };
    ws.onerror = () => ws.close();
  };

  open();
  return () => {
    closed = true;
    ws?.close();
  };
}

export const api = DEMO ? demoApi : realApi;
export const connectWS = DEMO ? demoConnectWS : realConnectWS;
