import { useState } from "react";
import { usePatients } from "../../state/PatientsContext";
import { useAuth } from "../../state/AuthContext";
import SignerSelect from "../SignerSelect";
import { MED_ROUTES, ORAL_TIMINGS, ORAL_MEALS, DOSE_UNITS, MED_FORMS, INHALE_SCHEDULES } from "../../data/constants";

const EMPTY_MED = {
  name: "", dose: "",
  strength: "", strengthUnit: "mg", strengthUnitOther: "", form: "เม็ด",
  route: "รับประทาน",
  timing: "หลังอาหาร", meals: [], mealsOther: "",
  prn: false, prnHours: "",
  perDay: "2", sides: [],
  puff: "", inhaleSchedule: "เช้า",
  reason: "", signer: "",
};

// "เมื่อมีอาการ ทุก X ชม." (PRN)
function prnText(d) {
  return "เมื่อมีอาการ" + (String(d.prnHours).trim() ? ` ทุก ${String(d.prnHours).trim()} ชม.` : "");
}

// "500 mg · เม็ด" — the strength + form line shown on each medication.
function strengthText(m) {
  const s = m.strength ? `${m.strength} ${m.strengthUnit || "mg"}` : "";
  return [s, m.form].filter(Boolean).join(" · ");
}

// Compose the stored freq string from the structured inputs.
function composeFreq(d) {
  if (d.route === "รับประทาน") {
    const meals = [...ORAL_MEALS.filter((m) => d.meals.includes(m)), d.mealsOther.trim()].filter(Boolean);
    const base = [d.timing, ...meals].filter(Boolean).join(" ");
    return [base, d.prn ? prnText(d) : ""].filter(Boolean).join(" · ");
  }
  if (d.route === "ยาพ่น") {
    const puff = String(d.puff).trim() ? `${String(d.puff).trim()} puff` : "";
    const sched = d.inhaleSchedule === "เมื่อมีอาการ" ? prnText(d) : d.inhaleSchedule;
    return [puff, sched].filter(Boolean).join(" · ");
  }
  const sides = d.sides.length ? " · ข้าง" + d.sides.join("-") : "";
  return `${d.perDay} ครั้ง/วัน${sides}`;
}
const EMPTY_EDIT = { dose: "", route: "", freq: "", reason: "", signer: "" };
const EMPTY_REMOVE = { reason: "", signer: "" };

const BADGE_CLASS = {
  "เพิ่มยาใหม่": "badge-green",
  "ปรับยา": "badge-amber",
  "หยุด/ลดยา": "badge-red",
  "เริ่มยาแรกรับ": "badge-blue",
};

export default function MedicationsTab({ patient, readOnly }) {
  const { addMedication, editMedication, removeMedication, adminEditLog } = usePatients();
  const { canWrite } = useAuth();
  // ยาปัจจุบันและประวัติการเปลี่ยนแปลงยา: พยาบาล/แพทย์/แอดมิน จัดการได้
  // (แต่บนเวชระเบียนกลางที่จำหน่ายแล้ว readOnly จะปิดให้เฉพาะแอดมิน)
  const canEditLog = !readOnly && canWrite;

  const [showForm, setShowForm] = useState(false);
  const [medDraft, setMedDraft] = useState(EMPTY_MED);
  const [editingLogIdx, setEditingLogIdx] = useState(null);
  const [logDraft, setLogDraft] = useState(null);

  const startLogEdit = (idx, c) => {
    setEditingLogIdx(idx);
    setLogDraft({ drugName: c.drugName, usage: c.usage, reason: c.reason, signer: c.signer });
  };
  const setL = (key) => (e) => setLogDraft((d) => ({ ...d, [key]: e.target.value }));
  const saveLogEdit = () => {
    const newLog = patient.medChangeLog.map((c, i) => (i === editingLogIdx ? { ...c, ...logDraft } : c));
    adminEditLog(patient.id, newLog);
    setEditingLogIdx(null);
  };
  const removeLogEntry = (idx, c) => {
    if (!window.confirm(`ลบประวัติ "${c.changeType} ${c.drugName}" วันที่ ${c.date}?`)) return;
    adminEditLog(patient.id, patient.medChangeLog.filter((_, i) => i !== idx));
    setEditingLogIdx(null);
  };

  const [editingMedId, setEditingMedId] = useState(null);
  const [editDraft, setEditDraft] = useState(EMPTY_EDIT);

  const [removingMedId, setRemovingMedId] = useState(null);
  const [removeDraft, setRemoveDraft] = useState(EMPTY_REMOVE);

  const toggleForm = () => {
    setShowForm((v) => !v);
    setMedDraft(EMPTY_MED);
  };
  const setMed = (key) => (e) => setMedDraft((d) => ({ ...d, [key]: e.target.value }));
  const toggleInList = (key, item) => () =>
    setMedDraft((d) => ({ ...d, [key]: d[key].includes(item) ? d[key].filter((x) => x !== item) : [...d[key], item] }));
  const submitAdd = () => {
    if (!medDraft.name) return;
    // "อื่นๆ" → ใช้หน่วยที่พิมพ์เอง
    const unit = medDraft.strengthUnit === "อื่นๆ" ? (medDraft.strengthUnitOther.trim() || "unit") : medDraft.strengthUnit;
    addMedication(patient.id, {
      name: medDraft.name,
      strength: medDraft.strength,
      strengthUnit: unit,
      form: medDraft.form,
      dose: medDraft.dose,
      route: medDraft.route,
      freq: composeFreq(medDraft),
      reason: medDraft.reason,
      signer: medDraft.signer,
    });
    setShowForm(false);
    setMedDraft(EMPTY_MED);
  };

  const startEdit = (m) => {
    setEditingMedId(m.id);
    setRemovingMedId(null);
    setEditDraft({ dose: m.dose, route: m.route, freq: m.freq, reason: "", signer: "" });
  };
  const setEdit = (key) => (e) => setEditDraft((d) => ({ ...d, [key]: e.target.value }));
  const saveEdit = () => {
    editMedication(patient.id, editingMedId, editDraft);
    setEditingMedId(null);
  };

  const startRemove = (medId) => {
    setRemovingMedId(medId);
    setEditingMedId(null);
    setRemoveDraft(EMPTY_REMOVE);
  };
  const setRemove = (key) => (e) => setRemoveDraft((d) => ({ ...d, [key]: e.target.value }));
  const confirmRemove = (medId) => {
    removeMedication(patient.id, medId, removeDraft);
    setRemovingMedId(null);
  };

  return (
    <>
      <div className="card">
        <div className="card-header-row">
          <div className="card-title">ยาปัจจุบัน</div>
          {!readOnly && (
            <button className="btn-primary print-hide" onClick={toggleForm}>
              {showForm ? "ปิดฟอร์ม" : "+ เพิ่มยา"}
            </button>
          )}
        </div>

        {!readOnly && showForm && (
          <div className="print-hide med-add-form">
            <div className="form-grid-2" style={{ marginTop: 18 }}>
              <div>
                <span className="field-label">ชื่อยา</span>
                <input className="input" placeholder="เช่น Lasix, Paracetamol" value={medDraft.name} onChange={setMed("name")} />
              </div>
              <div>
                <span className="field-label">ขนาดยา</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="input" style={{ flex: 1 }} inputMode="decimal" placeholder="เช่น 500" value={medDraft.strength} onChange={setMed("strength")} />
                  <select className="input" style={{ width: 100 }} value={medDraft.strengthUnit} onChange={setMed("strengthUnit")}>
                    {DOSE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                {medDraft.strengthUnit === "อื่นๆ" && (
                  <input className="input" style={{ marginTop: 8 }} placeholder="ระบุหน่วย เช่น mcg, IU, ml, %" value={medDraft.strengthUnitOther} onChange={setMed("strengthUnitOther")} />
                )}
              </div>
              <div>
                <span className="field-label">ชนิดยา</span>
                <select className="input" value={medDraft.form} onChange={setMed("form")}>
                  {MED_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <span className="field-label">ปริมาณต่อครั้ง</span>
                <input className="input" placeholder="เช่น 1x1, 1 เม็ด, 2 หยด" value={medDraft.dose} onChange={setMed("dose")} />
              </div>
            </div>

            <div>
              <span className="field-label">วิธีใช้ยา</span>
              <div className="choice-chips">
                {MED_ROUTES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={medDraft.route === r ? "choice-chip active" : "choice-chip"}
                    onClick={() => setMedDraft((d) => ({ ...d, route: r }))}
                  >
                    {r === "รับประทาน" ? "💊" : r === "ยาทา" ? "🧴" : r === "ยาหยอดตา" ? "💧" : "💨"} {r}
                  </button>
                ))}
              </div>
            </div>

            {medDraft.route === "รับประทาน" ? (
              <>
                <div>
                  <span className="field-label">เวลารับประทาน</span>
                  <div className="choice-chips">
                    {ORAL_TIMINGS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={medDraft.timing === t ? "choice-chip active" : "choice-chip"}
                        onClick={() => setMedDraft((d) => ({ ...d, timing: t }))}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="field-label">มื้อ (เลือกได้หลายมื้อ)</span>
                  <div className="choice-chips">
                    {ORAL_MEALS.map((m) => (
                      <label key={m} className={medDraft.meals.includes(m) ? "check-chip active" : "check-chip"}>
                        <input type="checkbox" checked={medDraft.meals.includes(m)} onChange={toggleInList("meals", m)} />
                        {m}
                      </label>
                    ))}
                    <input
                      className="input-sm"
                      style={{ width: 160 }}
                      placeholder="อื่นๆ เช่น ทุก 8 ชม."
                      value={medDraft.mealsOther}
                      onChange={setMed("mealsOther")}
                    />
                  </div>
                </div>
                <div>
                  <div className="choice-chips" style={{ alignItems: "center" }}>
                    <label className={medDraft.prn ? "check-chip active" : "check-chip"}>
                      <input type="checkbox" checked={medDraft.prn} onChange={() => setMedDraft((d) => ({ ...d, prn: !d.prn }))} />
                      เมื่อมีอาการ (PRN)
                    </label>
                    {medDraft.prn && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        ทุก
                        <input className="input-sm" style={{ width: 70 }} inputMode="numeric" placeholder="6" value={medDraft.prnHours} onChange={setMed("prnHours")} />
                        ชม.
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : medDraft.route === "ยาพ่น" ? (
              <>
                <div className="form-grid-2">
                  <div>
                    <span className="field-label">จำนวน puff</span>
                    <input className="input" inputMode="numeric" placeholder="เช่น 2" value={medDraft.puff} onChange={setMed("puff")} />
                  </div>
                  <div>
                    <span className="field-label">เวลาที่พ่น</span>
                    <div className="choice-chips" style={{ marginTop: 4 }}>
                      {INHALE_SCHEDULES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={medDraft.inhaleSchedule === s ? "choice-chip active" : "choice-chip"}
                          onClick={() => setMedDraft((d) => ({ ...d, inhaleSchedule: s }))}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {medDraft.inhaleSchedule === "เมื่อมีอาการ" && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span className="field-label" style={{ margin: 0 }}>ทุก</span>
                    <input className="input-sm" style={{ width: 70 }} inputMode="numeric" placeholder="6" value={medDraft.prnHours} onChange={setMed("prnHours")} />
                    <span className="field-label" style={{ margin: 0 }}>ชม.</span>
                  </div>
                )}
              </>
            ) : (
              <div className="form-grid-2">
                <div>
                  <span className="field-label">ความถี่ต่อวัน</span>
                  <select className="input" value={medDraft.perDay} onChange={setMed("perDay")}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ครั้ง/วัน</option>)}
                  </select>
                </div>
                <div>
                  <span className="field-label">ข้าง (ถ้ามี)</span>
                  <div className="choice-chips" style={{ marginTop: 4 }}>
                    {["ซ้าย", "ขวา"].map((s) => (
                      <label key={s} className={medDraft.sides.includes(s) ? "check-chip active" : "check-chip"}>
                        <input type="checkbox" checked={medDraft.sides.includes(s)} onChange={toggleInList("sides", s)} />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="med-form-preview">สรุป: <b>{medDraft.route} · {composeFreq(medDraft) || "-"}</b></div>

            <div className="form-grid-med-actions">
              <div>
                <span className="field-label">สาเหตุที่เพิ่มยา</span>
                <input className="input" placeholder="เช่น เริ่มยาใหม่ตามแพทย์สั่ง" value={medDraft.reason} onChange={setMed("reason")} />
              </div>
              <div>
                <span className="field-label">ลงชื่อ</span>
                <SignerSelect value={medDraft.signer} onChange={(v) => setMedDraft((d) => ({ ...d, signer: v }))} />
              </div>
              <button className="btn-primary" onClick={submitAdd}>บันทึก</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {patient.medications.map((m) => (
            <div key={m.id} className="med-item">
              <div className="med-item-row">
                <div className="med-item-line">
                  <span className="med-item-name">{m.name}</span>
                  <span className="med-item-detail">
                    {[strengthText(m), m.route, m.dose, m.freq].filter(Boolean).join(" · ")}
                  </span>
                </div>
                {!readOnly && (
                  <div className="med-item-actions print-hide">
                    <button className="btn-link btn-link-primary" onClick={() => startEdit(m)}>แก้ไข</button>
                    <button className="btn-link btn-link-danger" onClick={() => startRemove(m.id)}>ลบ</button>
                  </div>
                )}
              </div>

              {!readOnly && editingMedId === m.id && (
                <div className="med-edit-panel print-hide">
                  <div>
                    <span className="field-label-sm">ขนาดรับประทานใหม่</span>
                    <input className="input-sm" value={editDraft.dose} onChange={setEdit("dose")} />
                  </div>
                  <div>
                    <span className="field-label-sm">วิธีให้</span>
                    <input className="input-sm" value={editDraft.route} onChange={setEdit("route")} />
                  </div>
                  <div>
                    <span className="field-label-sm">ความถี่</span>
                    <input className="input-sm" value={editDraft.freq} onChange={setEdit("freq")} />
                  </div>
                  <div>
                    <span className="field-label-sm">สาเหตุที่ปรับยา</span>
                    <input className="input-sm" placeholder="เช่น BP สูงขึ้น" value={editDraft.reason} onChange={setEdit("reason")} />
                  </div>
                  <div>
                    <span className="field-label-sm">ลงชื่อ</span>
                    <SignerSelect small value={editDraft.signer} onChange={(v) => setEditDraft((d) => ({ ...d, signer: v }))} />
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
                    <button className="btn-secondary-sm" onClick={() => setEditingMedId(null)}>ยกเลิก</button>
                    <button className="btn-primary-sm" onClick={saveEdit}>บันทึก</button>
                  </div>
                </div>
              )}

              {!readOnly && removingMedId === m.id && (
                <div className="med-remove-panel print-hide">
                  <div>
                    <span className="field-label-sm" style={{ color: "var(--color-alert-text-strong)" }}>สาเหตุที่หยุด/ลดยา</span>
                    <input
                      className="input-sm"
                      style={{ borderColor: "var(--color-alert-border)" }}
                      placeholder="เช่น แพทย์สั่งหยุดยา"
                      value={removeDraft.reason}
                      onChange={setRemove("reason")}
                    />
                  </div>
                  <div>
                    <span className="field-label-sm" style={{ color: "var(--color-alert-text-strong)" }}>ลงชื่อ</span>
                    <SignerSelect small value={removeDraft.signer} onChange={(v) => setRemoveDraft((d) => ({ ...d, signer: v }))} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-secondary-sm" onClick={() => setRemovingMedId(null)}>ยกเลิก</button>
                    <button className="btn-danger-sm" onClick={() => confirmRemove(m.id)}>ยืนยันลบยา</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="section-title">ประวัติการเปลี่ยนแปลงยา</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {patient.medChangeLog.map((c, i) => (
            <div key={i} className="change-log-item">
              <div className="change-log-head">
                <div className="change-log-head-left">
                  <span className={`badge-sm ${BADGE_CLASS[c.changeType] || "badge-amber"}`}>{c.changeType}</span>
                  <span className="change-log-drug">{c.drugName}</span>
                </div>
                <span className="change-log-date" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {c.date}
                  {canEditLog && (
                    <span className="note-admin-actions print-hide">
                      <button className="btn-link btn-link-primary" onClick={() => startLogEdit(i, c)}>แก้ไข</button>
                      <button className="btn-link btn-link-danger" onClick={() => removeLogEntry(i, c)}>ลบ</button>
                    </span>
                  )}
                </span>
              </div>
              {editingLogIdx === i ? (
                <div className="form-stack-sm print-hide" style={{ marginTop: 10 }}>
                  <div><span className="field-label-sm">ชื่อยา</span><input className="input-sm" value={logDraft.drugName} onChange={setL("drugName")} /></div>
                  <div><span className="field-label-sm">วิธีใช้</span><input className="input-sm" value={logDraft.usage} onChange={setL("usage")} /></div>
                  <div><span className="field-label-sm">สาเหตุ</span><input className="input-sm" value={logDraft.reason} onChange={setL("reason")} /></div>
                  <div><span className="field-label-sm">ลงชื่อ</span><SignerSelect small value={logDraft.signer} onChange={(v) => setLogDraft((d) => ({ ...d, signer: v }))} /></div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-secondary-sm" onClick={() => setEditingLogIdx(null)}>ยกเลิก</button>
                    <button className="btn-primary-sm" onClick={saveLogEdit}>บันทึกแก้ไข</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="change-log-detail">วิธีใช้: {c.usage}</div>
                  <div className="change-log-detail" style={{ marginTop: 2 }}>สาเหตุ: {c.reason}</div>
                  <div className="change-log-signer">ลงชื่อ: {c.signer}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
