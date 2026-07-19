import { useState } from "react";
import { usePatients } from "../../state/PatientsContext";

function draftFrom(p) {
  return {
    presentIllness: p.presentIllness,
    pastIllness: p.pastIllness,
    drugAllergy: p.drugAllergy,
    foodAllergy: p.foodAllergy,
    carePlanGoal: p.carePlanGoal,
    codeStatus: p.codeStatus,
    physicalExam: p.physicalExam,
  };
}

export default function HistoryTab({ patient, readOnly }) {
  const { saveHistory } = usePatients();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftFrom(patient));

  const startEdit = () => {
    setDraft(draftFrom(patient));
    setEditing(true);
  };
  const cancel = () => setEditing(false);
  const save = () => {
    saveHistory(patient.id, draft);
    setEditing(false);
  };
  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  return (
    <div className="card">
      <div className="card-header-row">
        <div className="card-title">ประวัติและตรวจร่างกายแรกรับ</div>
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

      <div className="form-stack">
        <div>
          <span className="field-label">Present illness (อาการปัจจุบัน)</span>
          {!editing ? (
            <div style={{ fontSize: 16, lineHeight: 1.6 }}>{patient.presentIllness}</div>
          ) : (
            <textarea className="textarea" value={draft.presentIllness} onChange={set("presentIllness")} />
          )}
        </div>
        <div>
          <span className="field-label">Past illness (ประวัติเจ็บป่วยในอดีต)</span>
          {!editing ? (
            <div style={{ fontSize: 16, lineHeight: 1.6 }}>{patient.pastIllness}</div>
          ) : (
            <textarea className="textarea" value={draft.pastIllness} onChange={set("pastIllness")} />
          )}
        </div>
        <div className="form-grid-2">
          <div>
            <span className="field-label">Drug allergy</span>
            {!editing ? (
              <div style={{ fontSize: 16 }}>{patient.drugAllergy}</div>
            ) : (
              <input className="input" value={draft.drugAllergy} onChange={set("drugAllergy")} />
            )}
          </div>
          <div>
            <span className="field-label">Food allergy</span>
            {!editing ? (
              <div style={{ fontSize: 16 }}>{patient.foodAllergy}</div>
            ) : (
              <input className="input" value={draft.foodAllergy} onChange={set("foodAllergy")} />
            )}
          </div>
        </div>
        <div>
          <span className="field-label">Advance care plan: Goal / Code status</span>
          {!editing ? (
            <div style={{ fontSize: 16, lineHeight: 1.6 }}>
              {patient.carePlanGoal} · {patient.codeStatus}
            </div>
          ) : (
            <div className="form-stack-sm">
              <input className="input" placeholder="Goal" value={draft.carePlanGoal} onChange={set("carePlanGoal")} />
              <input
                className="input"
                placeholder="เช่น CPR, ETT, Vasopressor, Dialysis"
                value={draft.codeStatus}
                onChange={set("codeStatus")}
              />
            </div>
          )}
        </div>
        <div>
          <span className="field-label">ผลตรวจร่างกายแรกรับ</span>
          {!editing ? (
            <div style={{ fontSize: 16, lineHeight: 1.6 }}>{patient.physicalExam}</div>
          ) : (
            <textarea className="textarea" style={{ minHeight: 90 }} value={draft.physicalExam} onChange={set("physicalExam")} />
          )}
        </div>
      </div>
    </div>
  );
}
