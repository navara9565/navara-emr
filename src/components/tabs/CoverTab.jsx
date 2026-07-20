import { useState } from "react";
import { usePatients } from "../../state/PatientsContext";
import { bedLabel } from "../../data/beds";

function draftFrom(p) {
  return {
    age: p.age,
    gender: p.gender,
    idNumber: p.idNumber,
    address: p.address,
    diagnosis: p.diagnosis,
    contact1Name: p.contact1Name,
    contact1Relation: p.contact1Relation,
    contact1Phone: p.contact1Phone,
    contact2Name: p.contact2Name,
    contact2Relation: p.contact2Relation,
    contact2Phone: p.contact2Phone,
  };
}

export default function CoverTab({ patient, readOnly }) {
  const { saveCover } = usePatients();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftFrom(patient));

  const startEdit = () => {
    setDraft(draftFrom(patient));
    setEditing(true);
  };
  const cancel = () => setEditing(false);
  const save = () => {
    saveCover(patient.id, draft);
    setEditing(false);
  };
  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  return (
    <div className="card">
      <div className="card-header-row">
        <div className="card-title">ข้อมูลทั่วไปของผู้ป่วย</div>
        {readOnly ? null : !editing ? (
          <button className="btn btn-outline print-hide" onClick={startEdit}>
            ✎ แก้ไขข้อมูล
          </button>
        ) : (
          <div className="print-hide" style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={cancel}>ยกเลิก</button>
            <button className="btn-primary" onClick={save}>บันทึก</button>
          </div>
        )}
      </div>

      <div className="form-grid-2" style={{ marginTop: 14 }}>
        <div>
          <span className="field-label">ชื่อ-นามสกุล</span>
          <div style={{ fontSize: 17 }}>{patient.name}</div>
        </div>
        <div>
          <span className="field-label">ห้อง/เตียง · อายุ · เพศ</span>
          {!editing ? (
            <div style={{ fontSize: 17 }}>{bedLabel(patient.bed)} · {patient.age} ปี · {patient.gender}</div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, color: "var(--color-text-muted-2)" }}>{bedLabel(patient.bed)} ·</span>
              <input className="input" style={{ width: 90 }} inputMode="numeric" value={draft.age} onChange={set("age")} placeholder="อายุ" />
              <span style={{ fontSize: 15, color: "var(--color-text-muted-2)" }}>ปี</span>
              <select className="input" style={{ width: 110 }} value={draft.gender} onChange={set("gender")}>
                <option value="ชาย">ชาย</option>
                <option value="หญิง">หญิง</option>
              </select>
            </div>
          )}
        </div>
        <div>
          <span className="field-label">เลขบัตรประชาชน</span>
          {!editing ? (
            <div style={{ fontSize: 17 }}>{patient.idNumber}</div>
          ) : (
            <input className="input" value={draft.idNumber} onChange={set("idNumber")} />
          )}
        </div>
        <div>
          <span className="field-label">วันที่รับเข้า</span>
          <div style={{ fontSize: 17 }}>{patient.admitDate}</div>
        </div>
        <div className="span-2">
          <span className="field-label">ที่อยู่</span>
          {!editing ? (
            <div style={{ fontSize: 17 }}>{patient.address}</div>
          ) : (
            <input className="input" value={draft.address} onChange={set("address")} />
          )}
        </div>
        <div>
          <span className="field-label">การวินิจฉัยหลัก</span>
          {!editing ? (
            <div style={{ fontSize: 17 }}>{patient.diagnosis}</div>
          ) : (
            <input className="input" value={draft.diagnosis} onChange={set("diagnosis")} />
          )}
        </div>
      </div>

      <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--color-border-row)" }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 14, color: "var(--color-text-body)" }}>
          บุคคลที่ติดต่อกรณีฉุกเฉิน
        </div>
        <div className="form-grid-2">
          <div>
            <span className="field-label">คนที่ 1</span>
            {!editing ? (
              <div style={{ fontSize: 16 }}>
                {patient.contact1Name} ({patient.contact1Relation}) · {patient.contact1Phone}
              </div>
            ) : (
              <div className="form-stack-sm">
                <input className="input" placeholder="ชื่อ" value={draft.contact1Name} onChange={set("contact1Name")} />
                <input className="input" placeholder="เกี่ยวข้องเป็น" value={draft.contact1Relation} onChange={set("contact1Relation")} />
                <input className="input" inputMode="tel" placeholder="โทรศัพท์" value={draft.contact1Phone} onChange={set("contact1Phone")} />
              </div>
            )}
          </div>
          <div>
            <span className="field-label">คนที่ 2</span>
            {!editing ? (
              <div style={{ fontSize: 16 }}>
                {patient.contact2Name} ({patient.contact2Relation}) · {patient.contact2Phone}
              </div>
            ) : (
              <div className="form-stack-sm">
                <input className="input" placeholder="ชื่อ" value={draft.contact2Name} onChange={set("contact2Name")} />
                <input className="input" placeholder="เกี่ยวข้องเป็น" value={draft.contact2Relation} onChange={set("contact2Relation")} />
                <input className="input" inputMode="tel" placeholder="โทรศัพท์" value={draft.contact2Phone} onChange={set("contact2Phone")} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
