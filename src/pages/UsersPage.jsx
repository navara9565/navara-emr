import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth, ROLE_LABELS } from "../state/AuthContext";

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
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (isAdmin) {
      api.listUsers().then((d) => setUsers(d.users)).catch((e) => setError(e.message));
    }
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

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
              <option value="nurse">พยาบาล — บันทึกข้อมูลทั่วไปได้</option>
              <option value="doctor">แพทย์ — เพิ่ม Doctor Note ได้</option>
              <option value="pt">นักกายภาพบำบัด — บันทึกได้เฉพาะ PT/OT Note และ Vital Signs</option>
              <option value="ot">นักกิจกรรมบำบัด — บันทึกได้เฉพาะ PT/OT Note และ Vital Signs</option>
              <option value="caregiver">ผู้ดูแลผู้ป่วย — บันทึกได้เฉพาะ Vital Signs (รวมสแกน QR)</option>
              <option value="viewer">อื่นๆ — ดูข้อมูลได้อย่างเดียว</option>
              <option value="admin">ผู้ดูแลระบบ — ทุกสิทธิ์ + แก้ไขเวชระเบียนกลาง + จัดการผู้ใช้</option>
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
                  {u.username} · <span className="archive-badge" style={{ fontSize: 11.5 }}>{ROLE_LABELS[u.role] || u.role}</span>
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
