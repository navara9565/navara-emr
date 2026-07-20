import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../state/AuthContext";
import { CAPABILITIES } from "../data/roles";

// Short summary of what a role's capabilities allow (for the dropdown/list).
function capSummary(caps) {
  if (caps.admin) return "ทุกสิทธิ์ + จัดการผู้ใช้/บทบาท";
  const parts = [];
  if (caps.general) parts.push("ข้อมูลทั่วไป/ยา/Nurse");
  if (caps.doctorNote) parts.push("Doctor Note");
  if (caps.ptNote) parts.push("PT/OT");
  if (caps.vitals) parts.push("Vital Signs");
  if (caps.assess) parts.push("ประเมิน ADL/Fall");
  return parts.length ? parts.join(" · ") : "ดูอย่างเดียว";
}

// Admin-managed roles: list built-in + custom, add/delete custom roles.
function RolesSection({ roles, reloadRoles }) {
  const [label, setLabel] = useState("");
  const [caps, setCaps] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (key) => setCaps((c) => ({ ...c, [key]: !c[key] }));

  const add = async () => {
    setError("");
    if (!label.trim()) return setError("กรุณาตั้งชื่อบทบาท");
    if (!Object.values(caps).some(Boolean)) return setError("เลือกสิทธิ์อย่างน้อย 1 อย่าง");
    setBusy(true);
    try {
      await api.createRole({ label: label.trim(), caps });
      setLabel("");
      setCaps({});
      await reloadRoles();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`ลบบทบาท "${r.label}"?`)) return;
    setError("");
    try {
      await api.deleteRole(r.slug);
      await reloadRoles();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="card">
      <div className="section-title">🧷 บทบาทและสิทธิ์การใช้งาน</div>
      <div className="stacked-list" style={{ marginBottom: 18 }}>
        {roles.map((r) => (
          <div key={r.slug} className="user-row">
            <div>
              <div style={{ fontWeight: 700 }}>
                {r.label}{" "}
                {r.builtin
                  ? <span className="pill-chip">มาตรฐาน</span>
                  : <span className="pill-chip" style={{ background: "var(--color-badge-amber-bg)", color: "var(--color-badge-amber-text)" }}>กำหนดเอง</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted-2)" }}>{capSummary(r.caps)}</div>
            </div>
            {!r.builtin && (
              <button className="btn-danger-sm" onClick={() => remove(r)}>ลบ</button>
            )}
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--color-border-row)", paddingTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>+ เพิ่มบทบาทใหม่</div>
        <div style={{ maxWidth: 360, marginBottom: 12 }}>
          <span className="field-label">ชื่อบทบาท</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="เช่น ผู้ช่วยพยาบาล, โภชนากร" />
        </div>
        <span className="field-label">สิทธิ์ที่ให้ (ติ๊กได้หลายข้อ)</span>
        <div className="assess-factor-grid" style={{ marginBottom: 12 }}>
          {CAPABILITIES.map((c) => (
            <label key={c.key} className={caps[c.key] ? "chk-chip active" : "chk-chip"}>
              <input type="checkbox" checked={!!caps[c.key]} onChange={() => toggle(c.key)} />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
        {error && <div className="admit-error" style={{ marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" onClick={add} disabled={busy}>{busy ? "กำลังบันทึก..." : "เพิ่มบทบาท"}</button>
      </div>
    </div>
  );
}

function BackupSection() {
  const [backups, setBackups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listBackups().then((d) => setBackups(d.backups)).catch(() => {});
  }, []);

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const { blob, filename } = await api.downloadBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || "ดาวน์โหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header-row">
        <div className="section-title" style={{ marginBottom: 0 }}>💾 สำรองข้อมูล</div>
        <button className="btn-primary" onClick={download} disabled={busy}>
          {busy ? "กำลังสร้างไฟล์..." : "⬇ ดาวน์โหลดข้อมูลสำรอง"}
        </button>
      </div>
      <p style={{ fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.7, margin: "12px 0 0" }}>
        ระบบสำรองข้อมูลอัตโนมัติทุกวัน (เก็บรายวัน 30 ชุด + รายเดือน 12 ชุด ในเครื่องเซิร์ฟเวอร์)
        — แนะนำกดดาวน์โหลดไฟล์นี้<b>สัปดาห์ละครั้ง</b>แล้วเก็บไว้นอกเครื่อง (USB / Google Drive)
        เผื่อกรณีเครื่องเซิร์ฟเวอร์เสียหาย
      </p>
      {error && <div className="admit-error" style={{ marginTop: 12 }}>{error}</div>}
      {backups.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--color-text-muted-2)" }}>
          สำรองอัตโนมัติล่าสุด: {backups.slice(0, 3).join(" · ")}{backups.length > 3 ? ` · (+${backups.length - 3})` : ""}
        </div>
      )}
    </div>
  );
}

const EMPTY = { username: "", password: "", name: "", role: "nurse" };

export default function UsersPage() {
  const { isAdmin, user: me } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reloadRoles = () => api.listRoles().then((d) => setRoles(d.roles)).catch((e) => setError(e.message));

  useEffect(() => {
    if (isAdmin) {
      api.listUsers().then((d) => setUsers(d.users)).catch((e) => setError(e.message));
      reloadRoles();
    }
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const roleLabel = (slug) => roles.find((r) => r.slug === slug)?.label || slug;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const addUser = async () => {
    setError("");
    setNotice("");
    try {
      const d = await api.createUser(form);
      setUsers((u) => [...u, d.user]);
      setForm(EMPTY);
      setNotice(`เพิ่มผู้ใช้ ${d.user.username} แล้ว`);
    } catch (e) {
      setError(e.message);
    }
  };

  const removeUser = async (u) => {
    if (!window.confirm(`ลบผู้ใช้ ${u.username} (${u.name})?`)) return;
    setError("");
    try {
      await api.deleteUser(u.id);
      setUsers((list) => list.filter((x) => x.id !== u.id));
    } catch (e) {
      setError(e.message);
    }
  };

  const resetPassword = async (u) => {
    const pw = window.prompt(`ตั้งรหัสผ่านใหม่ให้ ${u.username} (อย่างน้อย 8 ตัวอักษร):`);
    if (!pw) return;
    setError("");
    try {
      await api.resetPassword(u.id, pw);
      setNotice(`เปลี่ยนรหัสผ่านของ ${u.username} แล้ว`);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="patient-shell">
      <div className="patient-header">
        <button className="btn btn-outline" onClick={() => navigate("/")}>← กลับ</button>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="patient-header-name">⚙️ จัดการผู้ใช้งาน</div>
          <div className="patient-header-sub">เพิ่ม/ลบบัญชี และกำหนดบทบาทการเข้าถึงระบบ</div>
        </div>
      </div>

      <BackupSection />

      <RolesSection roles={roles} reloadRoles={reloadRoles} />

      <div className="card">
        <div className="section-title">เพิ่มผู้ใช้ใหม่</div>
        <div className="form-grid-2">
          <div>
            <span className="field-label">ชื่อผู้ใช้ (ภาษาอังกฤษ)</span>
            <input className="input" value={form.username} onChange={set("username")} placeholder="เช่น nurse2" />
          </div>
          <div>
            <span className="field-label">รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</span>
            <input className="input" type="password" value={form.password} onChange={set("password")} />
          </div>
          <div>
            <span className="field-label">ชื่อ-นามสกุลที่แสดง</span>
            <input className="input" value={form.name} onChange={set("name")} placeholder="เช่น พยาบาล สายใจ" />
          </div>
          <div>
            <span className="field-label">บทบาท</span>
            <select className="input" value={form.role} onChange={set("role")}>
              {roles.map((r) => (
                <option key={r.slug} value={r.slug}>{r.label} — {capSummary(r.caps)}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <div className="admit-error" style={{ marginTop: 14 }}>{error}</div>}
        {notice && <div className="users-notice">{notice}</div>}
        <div style={{ marginTop: 14 }}>
          <button className="btn-primary" onClick={addUser}>เพิ่มผู้ใช้</button>
        </div>
      </div>

      <div className="card">
        <div className="section-title">ผู้ใช้ทั้งหมด ({users.length})</div>
        <div className="stacked-list">
          {users.map((u) => (
            <div key={u.id} className="user-row">
              <div>
                <div style={{ fontWeight: 700 }}>{u.name} {me.id === u.id && <span className="pill-chip">คุณ</span>}</div>
                <div style={{ fontSize: 13.5, color: "var(--color-text-muted-2)" }}>
                  {u.username} · <span className="archive-badge" style={{ fontSize: 11.5 }}>{roleLabel(u.role)}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary-sm" onClick={() => resetPassword(u)}>เปลี่ยนรหัสผ่าน</button>
                {me.id !== u.id && (
                  <button className="btn-danger-sm" onClick={() => removeUser(u)}>ลบ</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
