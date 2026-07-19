import { useState } from "react";
import { usePatients } from "../state/PatientsContext";
import { HOSPITALS, DEPARTMENTS } from "../data/constants";
import { thaiDate, todayISO } from "../utils/format";

const EMPTY = {
  date: "", time: "09:00",
  hospital: HOSPITALS[0], hospitalOther: "",
  department: DEPARTMENTS[0], departmentOther: "",
  lab: false, xray: false,
  note: "",
};

// Normalize a form draft into a stored appointment.
function toAppointment(draft, id) {
  return {
    id: id || "a" + Date.now(),
    date: draft.date,
    time: draft.time || "-",
    hospital: draft.hospital === "อื่นๆ" ? (draft.hospitalOther.trim() || "อื่นๆ") : draft.hospital,
    department: draft.department === "อื่นๆ" ? (draft.departmentOther.trim() || "อื่นๆ") : draft.department,
    lab: Boolean(draft.lab),
    xray: Boolean(draft.xray),
    note: draft.note.trim(),
  };
}

function toDraft(a) {
  const knownHospital = HOSPITALS.includes(a.hospital);
  const knownDept = DEPARTMENTS.includes(a.department);
  return {
    date: a.date,
    time: a.time,
    hospital: knownHospital ? a.hospital : "อื่นๆ",
    hospitalOther: knownHospital ? "" : a.hospital,
    department: knownDept ? a.department : "อื่นๆ",
    departmentOther: knownDept ? "" : a.department === "-" ? "" : a.department,
    lab: a.lab,
    xray: a.xray,
    note: a.note || "",
  };
}

function AppointmentForm({ draft, setDraft, onSave, onCancel, saveLabel }) {
  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));
  const setCheck = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.checked }));
  return (
    <div className="appt-form">
      <div className="form-grid-2">
        <div>
          <span className="field-label">วันที่นัด *</span>
          <input className="input" type="date" value={draft.date} onChange={set("date")} />
        </div>
        <div>
          <span className="field-label">เวลา</span>
          <input className="input" type="time" value={draft.time} onChange={set("time")} />
        </div>
        <div>
          <span className="field-label">โรงพยาบาล</span>
          <select className="input" value={draft.hospital} onChange={set("hospital")}>
            {HOSPITALS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <span className="field-label">แผนก</span>
          <select className="input" value={draft.department} onChange={set("department")}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      {draft.hospital === "อื่นๆ" && (
        <div>
          <span className="field-label">ระบุชื่อโรงพยาบาล</span>
          <input className="input" value={draft.hospitalOther} onChange={set("hospitalOther")} placeholder="ชื่อโรงพยาบาล" />
        </div>
      )}
      {draft.department === "อื่นๆ" && (
        <div>
          <span className="field-label">ระบุชื่อแผนก</span>
          <input className="input" value={draft.departmentOther} onChange={set("departmentOther")} placeholder="ชื่อแผนก" />
        </div>
      )}
      <div className="appt-checks">
        <label className="appt-check"><input type="checkbox" checked={draft.lab} onChange={setCheck("lab")} /> 🧪 เจาะ Lab</label>
        <label className="appt-check"><input type="checkbox" checked={draft.xray} onChange={setCheck("xray")} /> 🩻 X-ray</label>
      </div>
      <div>
        <span className="field-label">หมายเหตุ</span>
        <textarea
          className="textarea"
          style={{ minHeight: 50 }}
          value={draft.note}
          onChange={set("note")}
          placeholder="เช่น งดน้ำงดอาหารหลังเที่ยงคืน, เตรียมผลเลือดไปด้วย"
        />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn-secondary" onClick={onCancel}>ยกเลิก</button>
        <button className="btn-primary" onClick={onSave} disabled={!draft.date} style={!draft.date ? { opacity: 0.5 } : undefined}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

export default function AppointmentsModal({ patient, canWrite, onClose }) {
  const { saveAppointments } = usePatients();
  const appointments = [...(patient.appointments || [])].sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(EMPTY);

  const addAppt = () => {
    saveAppointments(patient.id, [...(patient.appointments || []), toAppointment(draft)]);
    setAdding(false);
    setDraft(EMPTY);
  };
  const saveEdit = () => {
    saveAppointments(patient.id, (patient.appointments || []).map((a) => (a.id === editingId ? toAppointment(editDraft, a.id) : a)));
    setEditingId(null);
  };
  const remove = (a) => {
    if (!window.confirm(`ลบนัด ${a.hospital} วันที่ ${thaiDate(a.date)}?`)) return;
    saveAppointments(patient.id, (patient.appointments || []).filter((x) => x.id !== a.id));
  };

  const today = todayISO();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="card-title">🏥 นัดโรงพยาบาล</div>
            <div className="modal-sub">{patient.name}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">✕</button>
        </div>

        {canWrite && !adding && (
          <button className="btn-primary" style={{ alignSelf: "flex-start", marginBottom: 14 }} onClick={() => { setAdding(true); setEditingId(null); }}>
            + เพิ่มนัดใหม่
          </button>
        )}
        {canWrite && adding && (
          <AppointmentForm draft={draft} setDraft={setDraft} onSave={addAppt} onCancel={() => setAdding(false)} saveLabel="บันทึกนัด" />
        )}

        <div className="stacked-list" style={{ marginTop: 14 }}>
          {appointments.length === 0 && <div className="archive-empty" style={{ padding: 24 }}>ยังไม่มีนัดหมาย</div>}
          {appointments.map((a) => (
            <div key={a.id} className={a.date < today ? "appt-item past" : "appt-item"}>
              <div className="appt-item-head">
                <div className="appt-item-when">
                  📅 {thaiDate(a.date)} · {a.time} น.
                  {a.date < today && <span className="appt-past-badge">ผ่านแล้ว</span>}
                </div>
                {canWrite && (
                  <span className="note-admin-actions">
                    <button className="btn-link btn-link-primary" onClick={() => { setEditingId(a.id); setEditDraft(toDraft(a)); setAdding(false); }}>แก้ไข</button>
                    <button className="btn-link btn-link-danger" onClick={() => remove(a)}>ลบ</button>
                  </span>
                )}
              </div>
              {editingId === a.id ? (
                <AppointmentForm draft={editDraft} setDraft={setEditDraft} onSave={saveEdit} onCancel={() => setEditingId(null)} saveLabel="บันทึกแก้ไข" />
              ) : (
                <>
                  <div className="appt-item-detail">
                    🏥 {a.hospital} · แผนก{a.department}
                    {a.lab && <span className="pill-chip">🧪 Lab</span>}
                    {a.xray && <span className="pill-chip">🩻 X-ray</span>}
                  </div>
                  {a.note && <div className="appt-item-note">📝 {a.note}</div>}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
