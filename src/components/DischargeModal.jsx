import { useState } from "react";
import { usePatients } from "../state/PatientsContext";
import { DISCHARGE_TYPES } from "../data/constants";
import { bedLabel } from "../data/beds";
import { fmtDate, TODAY } from "../utils/format";

export default function DischargeModal({ patient, onClose }) {
  const { dischargePatient } = usePatients();
  const [form, setForm] = useState({
    date: fmtDate(TODAY),
    type: DISCHARGE_TYPES[0],
    summary: "",
    plan: "",
    signer: "",
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    if (!form.type) return;
    dischargePatient(patient.id, form);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="card-title">จำหน่ายผู้ป่วย</div>
            <div className="modal-sub">{patient.name} · {bedLabel(patient.bed)}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">✕</button>
        </div>

        <div className="modal-note">
          เมื่อจำหน่ายแล้ว เวชระเบียนของผู้ป่วยจะถูกส่งไปเก็บใน <b>เวชระเบียนกลาง</b> (ดูย้อนหลังได้ แต่แก้ไขไม่ได้)
        </div>

        <div className="form-stack-12" style={{ marginTop: 4 }}>
          <div className="form-grid-2">
            <div>
              <span className="field-label">วันที่จำหน่าย</span>
              <input className="input" value={form.date} onChange={set("date")} />
            </div>
            <div>
              <span className="field-label">ประเภทการจำหน่าย</span>
              <select className="input" value={form.type} onChange={set("type")}>
                {DISCHARGE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <span className="field-label">สรุปการรักษา / อาการเมื่อจำหน่าย</span>
            <textarea className="textarea" style={{ minHeight: 70 }} value={form.summary} onChange={set("summary")} placeholder="เช่น อาการคงที่ ช่วยเหลือตัวเองได้ดีขึ้น" />
          </div>
          <div>
            <span className="field-label">คำแนะนำ / แผนการดูแลต่อเนื่อง</span>
            <textarea className="textarea" style={{ minHeight: 60 }} value={form.plan} onChange={set("plan")} placeholder="เช่น รับประทานยาต่อเนื่อง นัดติดตามอาการที่โรงพยาบาล" />
          </div>
          <div>
            <span className="field-label">ผู้จำหน่าย / ลงชื่อ</span>
            <input className="input" value={form.signer} onChange={set("signer")} placeholder="ผู้บันทึก" />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
          <button className="btn-danger" onClick={submit}>ยืนยันจำหน่ายผู้ป่วย</button>
        </div>
      </div>
    </div>
  );
}
