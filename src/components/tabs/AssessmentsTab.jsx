import { useMemo, useState } from "react";
import { useNotes } from "../../hooks/useNotes";
import { useAuth } from "../../state/AuthContext";
import SignerSelect from "../SignerSelect";
import { todayISO } from "../../utils/format";
import {
  ADL_ITEMS, adlLevel,
  FALL_ITEMS, FALL_RISK_FACTORS, fallLevel,
} from "../../data/constants";

// ---- shared scoring helpers ----
function maxScore(items) {
  return items.reduce((sum, it) => sum + Math.max(...it.options.map((o) => o.score)), 0);
}
function totalScore(items, values) {
  return items.reduce((sum, it) => sum + (Number(values[it.key]) || 0), 0);
}

// One assessment kind (ADL or Fall): entry form + dated history.
function AssessmentSection({ patient, readOnly, kind, items, levelFn, factors }) {
  const { isAdmin } = useAuth();
  const { notes, hasMore, total, loading, loadMore, addNote, deleteNote } = useNotes(patient.id, kind);

  const blank = useMemo(
    () => Object.fromEntries(items.map((it) => [it.key, ""])),
    [items]
  );
  const [values, setValues] = useState(blank);
  const [checkedFactors, setCheckedFactors] = useState([]);
  const [drugNote, setDrugNote] = useState("");
  const [assessedDate, setAssessedDate] = useState(todayISO());
  const [signer, setSigner] = useState("");
  const [saving, setSaving] = useState(false);

  const complete = items.every((it) => values[it.key] !== "");
  const sum = totalScore(items, values);
  const max = maxScore(items);
  const level = complete ? levelFn(sum) : null;

  const setItem = (key, score) => setValues((v) => ({ ...v, [key]: score }));
  const toggleFactor = (f) =>
    setCheckedFactors((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const submit = async () => {
    if (!complete || saving) return;
    setSaving(true);
    try {
      await addNote(signer, {
        assessedDate,
        values: { ...values },
        factors: factors ? checkedFactors : undefined,
        drugNote: factors ? drugNote.trim() : undefined,
        total: sum,
        max,
        level: levelFn(sum),
      });
      setValues(blank);
      setCheckedFactors([]);
      setDrugNote("");
      setAssessedDate(todayISO());
    } finally {
      setSaving(false);
    }
  };

  const remove = async (n) => {
    if (!window.confirm(`ลบผลประเมินวันที่ ${n.assessedDate || n.date}?`)) return;
    await deleteNote(n.id);
  };

  const levelClass = (code) =>
    code === "H" || code === "TD" ? "badge-alert"
    : code === "M" || code === "SD" || code === "MD" ? "badge-amber"
    : "badge-normal";

  return (
    <>
      {!readOnly && (
        <div className="card print-hide">
          <div className="section-title">
            {kind === "adl" ? "ประเมิน ADL (Barthel Index)" : "ประเมินความเสี่ยงพลัดตกหกล้ม (Morse Fall Risk)"}
          </div>

          <div className="form-stack-12">
            <div style={{ maxWidth: 220 }}>
              <span className="field-label">วันที่ประเมิน</span>
              <input className="input" type="date" value={assessedDate} onChange={(e) => setAssessedDate(e.target.value)} />
            </div>

            {factors && (
              <div className="assess-factors">
                <span className="field-label">ปัจจัยเสี่ยง (ติ๊กได้หลายข้อ)</span>
                <div className="assess-factor-grid">
                  {factors.map((f) => (
                    <label key={f} className={checkedFactors.includes(f) ? "chk-chip active" : "chk-chip"}>
                      <input type="checkbox" checked={checkedFactors.includes(f)} onChange={() => toggleFactor(f)} />
                      <span>{f}</span>
                    </label>
                  ))}
                </div>
                <input className="input" style={{ marginTop: 8 }} placeholder="ระบุชื่อยาเสี่ยง (ถ้ามี)" value={drugNote} onChange={(e) => setDrugNote(e.target.value)} />
              </div>
            )}

            {items.map((it) => (
              <div key={it.key} className="assess-item">
                <div className="assess-item-label">{it.label}</div>
                <div className="assess-options">
                  {it.options.map((o) => (
                    <label key={o.score} className={String(values[it.key]) === String(o.score) ? "assess-opt active" : "assess-opt"}>
                      <input
                        type="radio"
                        name={`${kind}-${it.key}`}
                        checked={String(values[it.key]) === String(o.score)}
                        onChange={() => setItem(it.key, o.score)}
                      />
                      <span className="assess-opt-score">{o.score}</span>
                      <span className="assess-opt-text">{o.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="assess-live">
              <span>คะแนนรวม: <b>{sum}</b> / {max}</span>
              {level && <span className={`badge ${levelClass(level.code)}`}>{level.label}</span>}
              {!complete && <span className="assess-hint">— กรุณาเลือกให้ครบทุกข้อ</span>}
            </div>

            <div style={{ maxWidth: 320 }}>
              <span className="field-label">ผู้ประเมิน / ลงนาม</span>
              <SignerSelect value={signer} onChange={setSigner} />
            </div>

            <button className="btn-primary" style={{ alignSelf: "flex-start" }} disabled={!complete || saving} onClick={submit}>
              {saving ? "กำลังบันทึก..." : "บันทึกผลประเมิน"}
            </button>
          </div>
        </div>
      )}

      <div className="stacked-list">
        {loading && <div className="app-loading" style={{ padding: 20 }}>กำลังโหลด...</div>}
        {!loading && notes.length === 0 && <div className="empty-hint">ยังไม่มีผลประเมิน</div>}
        {notes.map((n) => {
          const lv = n.level || (levelFn ? levelFn(n.total) : null);
          return (
            <div key={n.id} className="note-card">
              <div className="note-head">
                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <b>คะแนน {n.total}/{n.max}</b>
                  {lv && <span className={`badge ${levelClass(lv.code)}`}>{lv.label}</span>}
                </span>
                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  วันที่ประเมิน {n.assessedDate || n.date}
                  {isAdmin && (
                    <span className="note-admin-actions print-hide">
                      <button className="btn-link btn-link-danger" onClick={() => remove(n)}>ลบ</button>
                    </span>
                  )}
                </span>
              </div>
              {n.author && n.author !== "-" && <div className="assess-signer">ผู้ประเมิน: {n.author}</div>}
              {n.factors && n.factors.length > 0 && (
                <div className="assess-detail"><b>ปัจจัยเสี่ยง:</b> {n.factors.join(" · ")}{n.drugNote ? ` · ยา: ${n.drugNote}` : ""}</div>
              )}
              <div className="assess-breakdown">
                {items.map((it) => {
                  const sc = n.values?.[it.key];
                  const opt = it.options.find((o) => String(o.score) === String(sc));
                  return (
                    <div key={it.key} className="assess-bd-row">
                      <span className="assess-bd-label">{it.label}</span>
                      <span className="assess-bd-val">{sc ?? "-"} · {opt ? opt.text : "-"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {hasMore && (
          <button className="btn btn-outline load-more print-hide" onClick={loadMore}>
            ดูเพิ่ม ({notes.length}/{total})
          </button>
        )}
      </div>
    </>
  );
}

export default function AssessmentsTab({ patient, readOnly }) {
  const [sub, setSub] = useState("adl");
  return (
    <>
      <div className="view-tabs print-hide" style={{ marginBottom: 18 }}>
        <button className={sub === "adl" ? "view-tab active" : "view-tab"} onClick={() => setSub("adl")}>
          🧩 ADL (Barthel Index)
        </button>
        <button className={sub === "fall" ? "view-tab active" : "view-tab"} onClick={() => setSub("fall")}>
          ⚠️ ประเมินการพลัดตกหกล้ม (Fall)
        </button>
      </div>

      {sub === "adl" ? (
        <AssessmentSection patient={patient} readOnly={readOnly} kind="adl" items={ADL_ITEMS} levelFn={adlLevel} />
      ) : (
        <AssessmentSection patient={patient} readOnly={readOnly} kind="fall" items={FALL_ITEMS} levelFn={fallLevel} factors={FALL_RISK_FACTORS} />
      )}
    </>
  );
}
