import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePatient, usePatients } from "../state/PatientsContext";
import { useAuth } from "../state/AuthContext";
import { bedLabel } from "../data/beds";
import { isAbnormal } from "../utils/format";
import { VITAL_ROUNDS, suggestRound } from "../utils/qr";
import SignerSelect from "../components/SignerSelect";

const EMPTY = { temp: "", sys: "", dia: "", hr: "", rr: "", spo2: "" };

export default function ScanVitalsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const patient = usePatient(id);
  const { addVital, loading } = usePatients();
  const { user, canWrite } = useAuth();

  const [time, setTime] = useState(suggestRound());
  const [nurse, setNurse] = useState(user?.name || "");
  const [form, setForm] = useState(EMPTY);
  const [saved, setSaved] = useState(null);

  if (loading) return <div className="app-loading">กำลังโหลดข้อมูล...</div>;

  if (!canWrite) {
    return (
      <div className="scan-page">
        <div className="scan-card">
          <div className="scan-title">ไม่มีสิทธิ์บันทึกข้อมูล</div>
          <p className="scan-muted">บัญชีของคุณเป็นแบบดูอย่างเดียว — การบันทึกสัญญาณชีพทำได้เฉพาะเจ้าหน้าที่</p>
          <button className="btn-primary" onClick={() => navigate("/")}>กลับหน้าหลัก</button>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="scan-page">
        <div className="scan-card">
          <div className="scan-title">ไม่พบผู้ป่วย</div>
          <p className="scan-muted">QR นี้อาจหมดอายุหรือผู้ป่วยถูกจำหน่ายแล้ว</p>
          <button className="btn-primary" onClick={() => navigate("/")}>กลับหน้าหลัก</button>
        </div>
      </div>
    );
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    if (!form.temp && !form.sys && !form.hr && !form.spo2) return;
    await addVital(patient.id, { ...form, time, recordedBy: nurse.trim() || "พยาบาลปลายเตียง" });
    const abnormal = isAbnormal(
      parseFloat(form.temp) || 36.5,
      parseInt(form.sys, 10) || 120,
      parseInt(form.hr, 10) || 75,
      parseInt(form.spo2, 10) || 98
    );
    setSaved({ ...form, time, abnormal });
  };

  const again = () => {
    setForm(EMPTY);
    setSaved(null);
  };

  if (saved) {
    return (
      <div className="scan-page">
        <div className="scan-card scan-success">
          <div className="scan-check">✓</div>
          <div className="scan-title">บันทึกสำเร็จ</div>
          <div className="scan-muted">{patient.name} · {bedLabel(patient.bed)} · เวลา {saved.time} น.</div>

          <div className="scan-summary">
            <div><span>Temp</span><b>{saved.temp || "-"}°C</b></div>
            <div><span>BP</span><b>{saved.sys || "-"}/{saved.dia || "-"}</b></div>
            <div><span>HR</span><b>{saved.hr || "-"}</b></div>
            <div><span>RR</span><b>{saved.rr || "-"}</b></div>
            <div><span>SpO2</span><b>{saved.spo2 || "-"}%</b></div>
          </div>

          {saved.abnormal && (
            <div className="scan-alert">⚠ ค่าสัญญาณชีพผิดปกติ — ระบบได้แจ้งเตือนที่หน้ารายชื่อผู้ป่วยแล้ว</div>
          )}

          <div className="scan-note">ข้อมูลถูกอัปเดตเข้าระบบเวชระเบียนเรียบร้อยแล้ว</div>

          <div className="scan-actions">
            <button className="btn-primary" onClick={again}>+ บันทึกค่าถัดไป</button>
            <button className="btn btn-secondary" onClick={() => navigate(`/patient/${patient.id}/vitals`)}>เปิดดูในระบบ</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scan-page">
      <div className="scan-card">
        <div className="scan-badge">📷 บันทึกสัญญาณชีพปลายเตียง</div>
        <div className="scan-patient">
          <div className="scan-title">{patient.name}</div>
          <div className="scan-muted">{bedLabel(patient.bed)} · {patient.age} ปี · {patient.gender}</div>
        </div>

        <div className="scan-field">
          <span className="field-label">รอบเวลาที่วัด</span>
          <div className="round-chips">
            {VITAL_ROUNDS.map((r) => (
              <button
                key={r}
                type="button"
                className={time === r ? "round-chip active" : "round-chip"}
                onClick={() => setTime(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <input className="input" style={{ marginTop: 8 }} value={time} onChange={(e) => setTime(e.target.value)} placeholder="เช่น 10:00" />
        </div>

        <div className="scan-grid">
          <div><span className="field-label">Temp (°C)</span><input className="input scan-input" inputMode="decimal" value={form.temp} onChange={set("temp")} placeholder="36.5" /></div>
          <div><span className="field-label">SpO2 (%)</span><input className="input scan-input" inputMode="numeric" value={form.spo2} onChange={set("spo2")} placeholder="98" /></div>
          <div><span className="field-label">BP บน</span><input className="input scan-input" inputMode="numeric" value={form.sys} onChange={set("sys")} placeholder="120" /></div>
          <div><span className="field-label">BP ล่าง</span><input className="input scan-input" inputMode="numeric" value={form.dia} onChange={set("dia")} placeholder="80" /></div>
          <div><span className="field-label">HR (/min)</span><input className="input scan-input" inputMode="numeric" value={form.hr} onChange={set("hr")} placeholder="76" /></div>
          <div><span className="field-label">RR (/min)</span><input className="input scan-input" inputMode="numeric" value={form.rr} onChange={set("rr")} placeholder="18" /></div>
        </div>

        <div className="scan-field">
          <span className="field-label">ผู้บันทึก</span>
          <SignerSelect value={nurse} onChange={setNurse} />
        </div>

        <button className="btn-primary scan-submit" onClick={submit}>บันทึกเข้าระบบ</button>
        <button className="scan-back" onClick={() => navigate(`/patient/${patient.id}/vitals`)}>ยกเลิก / เปิดในระบบ</button>
      </div>
    </div>
  );
}
