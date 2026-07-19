import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePatients } from "../state/PatientsContext";
import { buildOccupancy, bedLabel } from "../data/beds";
import BedPicker from "../components/BedPicker";
import { fmtDate, TODAY } from "../utils/format";

export default function AdmitPage() {
  const { patients, bedCounts, admitPatient } = usePatients();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const occupancy = useMemo(() => buildOccupancy(patients), [patients]);
  const presetBed = params.get("bed");
  const presetFree = presetBed && !occupancy[presetBed] ? presetBed : "";

  const [form, setForm] = useState({
    name: "",
    gender: "ชาย",
    age: "",
    idNumber: "",
    diagnosis: "",
    admitDate: fmtDate(TODAY),
    address: "",
    presentIllness: "",
    drugAllergy: "",
    foodAllergy: "",
    contact1Name: "",
    contact1Relation: "",
    contact1Phone: "",
    bed: presetFree,
    temp: "",
    sys: "",
    dia: "",
    hr: "",
    rr: "",
    spo2: "",
  });
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const selectBed = (bedId) => setForm((f) => ({ ...f, bed: bedId }));

  const submit = async () => {
    if (!form.name.trim()) return setError("กรุณากรอกชื่อ-นามสกุลผู้ป่วย");
    if (!form.bed) return setError("กรุณาเลือกเตียงสำหรับผู้ป่วย");
    if (occupancy[form.bed]) return setError("เตียงนี้มีผู้ป่วยอยู่แล้ว กรุณาเลือกเตียงอื่น");
    try {
      const id = await admitPatient(form);
      navigate(`/patient/${id}/cover`);
    } catch (e) {
      setError(e.message || "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="patient-shell">
      <div className="patient-header">
        <button className="btn btn-outline" onClick={() => navigate("/")}>← กลับ</button>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="patient-header-name">🛎️ รับผู้ป่วยใหม่</div>
          <div className="patient-header-sub">ลงทะเบียนผู้ป่วยเข้ารับการดูแล พร้อมเลือกเตียง</div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">ข้อมูลผู้ป่วย</div>
        <div className="form-stack-12">
          <div className="form-grid-2">
            <div>
              <span className="field-label">ชื่อ-นามสกุล *</span>
              <input className="input" value={form.name} onChange={set("name")} placeholder="เช่น นางสมศรี ใจดี" />
            </div>
            <div className="form-grid-2">
              <div>
                <span className="field-label">เพศ</span>
                <select className="input" value={form.gender} onChange={set("gender")}>
                  <option value="ชาย">ชาย</option>
                  <option value="หญิง">หญิง</option>
                </select>
              </div>
              <div>
                <span className="field-label">อายุ (ปี)</span>
                <input className="input" inputMode="numeric" value={form.age} onChange={set("age")} placeholder="78" />
              </div>
            </div>
          </div>
          <div className="form-grid-2">
            <div>
              <span className="field-label">เลขบัตรประชาชน</span>
              <input className="input" value={form.idNumber} onChange={set("idNumber")} />
            </div>
            <div>
              <span className="field-label">วันที่รับเข้า</span>
              <input className="input" value={form.admitDate} onChange={set("admitDate")} />
            </div>
          </div>
          <div>
            <span className="field-label">การวินิจฉัยหลัก</span>
            <input className="input" value={form.diagnosis} onChange={set("diagnosis")} placeholder="เช่น ความดันโลหิตสูง, เบาหวาน" />
          </div>
          <div>
            <span className="field-label">ที่อยู่</span>
            <input className="input" value={form.address} onChange={set("address")} />
          </div>
          <div>
            <span className="field-label">Present illness (อาการปัจจุบัน)</span>
            <textarea className="textarea" style={{ minHeight: 60 }} value={form.presentIllness} onChange={set("presentIllness")} />
          </div>
          <div className="form-grid-2">
            <div>
              <span className="field-label">Drug allergy</span>
              <input className="input" value={form.drugAllergy} onChange={set("drugAllergy")} placeholder="ไม่มีประวัติแพ้ยา" />
            </div>
            <div>
              <span className="field-label">Food allergy</span>
              <input className="input" value={form.foodAllergy} onChange={set("foodAllergy")} placeholder="ไม่มี" />
            </div>
          </div>
          <div>
            <span className="field-label">ผู้ติดต่อกรณีฉุกเฉิน</span>
            <div className="form-grid-3">
              <input className="input" value={form.contact1Name} onChange={set("contact1Name")} placeholder="ชื่อ" />
              <input className="input" value={form.contact1Relation} onChange={set("contact1Relation")} placeholder="เกี่ยวข้องเป็น" />
              <input className="input" inputMode="tel" value={form.contact1Phone} onChange={set("contact1Phone")} placeholder="โทรศัพท์" />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">สัญญาณชีพแรกรับ (ไม่บังคับ)</div>
        <div className="form-grid-3">
          <div><span className="field-label">Temp. (°C)</span><input className="input" inputMode="decimal" value={form.temp} onChange={set("temp")} placeholder="36.5" /></div>
          <div><span className="field-label">BP บน</span><input className="input" inputMode="numeric" value={form.sys} onChange={set("sys")} placeholder="120" /></div>
          <div><span className="field-label">BP ล่าง</span><input className="input" inputMode="numeric" value={form.dia} onChange={set("dia")} placeholder="80" /></div>
          <div><span className="field-label">HR (/min)</span><input className="input" inputMode="numeric" value={form.hr} onChange={set("hr")} placeholder="76" /></div>
          <div><span className="field-label">RR (/min)</span><input className="input" inputMode="numeric" value={form.rr} onChange={set("rr")} placeholder="18" /></div>
          <div><span className="field-label">SpO2 (%)</span><input className="input" inputMode="numeric" value={form.spo2} onChange={set("spo2")} placeholder="98" /></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header-row" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>เลือกเตียง *</div>
          {form.bed && <span className="archive-badge">เลือกแล้ว · {bedLabel(form.bed)}</span>}
        </div>
        <BedPicker bedCounts={bedCounts} occupancy={occupancy} value={form.bed} onChange={selectBed} />
      </div>

      {error && <div className="admit-error">{error}</div>}

      <div className="modal-actions" style={{ marginTop: 4 }}>
        <button className="btn btn-secondary" onClick={() => navigate("/")}>ยกเลิก</button>
        <button className="btn-primary" onClick={submit}>รับผู้ป่วยเข้าดูแล</button>
      </div>
    </div>
  );
}
