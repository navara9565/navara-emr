import { useMemo, useState } from "react";
import { usePatients } from "../../state/PatientsContext";
import { useAuth } from "../../state/AuthContext";
import { useVitals, useVitalsSummary } from "../../hooks/useVitals";
import { isAbnormal, monthLabel } from "../../utils/format";
import { VITAL_ROUNDS, suggestRound } from "../../utils/qr";
import BedsideQR from "../BedsideQR";

const EMPTY_FORM = { temp: "", sys: "", dia: "", hr: "", rr: "", spo2: "", intake: "", urine: "", stool: "", other: "" };
const io = (v) => (v === null || v === undefined || v === "" ? "-" : v);

const RANGES = [
  { days: 7, label: "7 วัน" },
  { days: 30, label: "30 วัน" },
  { days: 90, label: "3 เดือน" },
  { days: 0, label: "ทั้งหมด" },
];

export default function VitalsTab({ patient, readOnly }) {
  const { addVital } = usePatients();
  const { canWrite } = useAuth();
  // แก้ไข/ลบ Vital Signs ที่บันทึกแล้ว: admin / ผู้จัดการ / แพทย์ / พยาบาล
  // (เวชระเบียนกลางที่จำหน่ายแล้ว readOnly=true สำหรับทุกคนยกเว้นแอดมิน)
  const canEditRows = canWrite && !readOnly;
  const [form, setForm] = useState(EMPTY_FORM);
  const [time, setTime] = useState(suggestRound());
  const [days, setDays] = useState(7);
  const [showSummary, setShowSummary] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const { vitals, loading, updateVital, deleteVital } = useVitals(patient.id, days);
  const months = useVitalsSummary(patient.id);

  const startRowEdit = (v) => {
    setEditingId(v.id);
    setEditDraft({ time: v.time, temp: v.temp, sys: v.sys, dia: v.dia, hr: v.hr, rr: v.rr, spo2: v.spo2, intake: v.intake ?? "", urine: v.urine ?? "", stool: v.stool ?? "", other: v.other ?? "" });
  };
  const setE = (key) => (e) => setEditDraft((d) => ({ ...d, [key]: e.target.value }));
  const saveRowEdit = async () => {
    await updateVital(editingId, editDraft);
    setEditingId(null);
  };
  const removeRow = async (v) => {
    if (!window.confirm(`ลบรายการวันที่ ${v.date} เวลา ${v.time}?`)) return;
    await deleteVital(v.id);
    setEditingId(null);
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    if (!form.temp && !form.sys) return;
    await addVital(patient.id, { ...form, time });
    setForm(EMPTY_FORM);
    setTime(suggestRound());
  };

  const historyReversed = useMemo(
    () =>
      [...vitals].reverse().map((v) => ({
        ...v,
        bp: v.sys + "/" + v.dia,
        abnormal: isAbnormal(v.temp, v.sys, v.hr, v.spo2),
      })),
    [vitals]
  );

  return (
    <>
      {!readOnly && <BedsideQR patient={patient} />}

      {!readOnly && (
      <div className="card print-hide">
        <div className="section-title">บันทึกสัญญาณชีพใหม่</div>
        <div style={{ marginBottom: 14 }}>
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
          <input className="input" style={{ marginTop: 8, maxWidth: 200 }} value={time} onChange={(e) => setTime(e.target.value)} placeholder="เช่น 10:00" />
        </div>
        <div className="form-grid-3">
          <div>
            <span className="field-label">Temp. (°C)</span>
            <input className="input" inputMode="decimal" placeholder="36.5" value={form.temp} onChange={set("temp")} />
          </div>
          <div>
            <span className="field-label">BP บน (mmHg)</span>
            <input className="input" inputMode="numeric" placeholder="120" value={form.sys} onChange={set("sys")} />
          </div>
          <div>
            <span className="field-label">BP ล่าง (mmHg)</span>
            <input className="input" inputMode="numeric" placeholder="80" value={form.dia} onChange={set("dia")} />
          </div>
          <div>
            <span className="field-label">HR (/min)</span>
            <input className="input" inputMode="numeric" placeholder="75" value={form.hr} onChange={set("hr")} />
          </div>
          <div>
            <span className="field-label">RR (/min)</span>
            <input className="input" inputMode="numeric" placeholder="18" value={form.rr} onChange={set("rr")} />
          </div>
          <div>
            <span className="field-label">SpO2 (%)</span>
            <input className="input" inputMode="numeric" placeholder="98" value={form.spo2} onChange={set("spo2")} />
          </div>
        </div>
        <div className="form-grid-3" style={{ marginTop: 12 }}>
          <div>
            <span className="field-label">ปริมาณน้ำดื่ม (มล.)</span>
            <input className="input" inputMode="numeric" placeholder="เช่น 600" value={form.intake} onChange={set("intake")} />
          </div>
          <div>
            <span className="field-label">จำนวนปัสสาวะ (ครั้ง)</span>
            <input className="input" inputMode="numeric" placeholder="เช่น 3" value={form.urine} onChange={set("urine")} />
          </div>
          <div>
            <span className="field-label">จำนวนอุจจาระ (ครั้ง)</span>
            <input className="input" inputMode="numeric" placeholder="เช่น 1" value={form.stool} onChange={set("stool")} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <span className="field-label">อื่นๆ</span>
          <input className="input" placeholder="พิมพ์บันทึกเพิ่มเติมได้อิสระ" value={form.other} onChange={set("other")} />
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="btn-primary" onClick={submit}>บันทึกค่า</button>
        </div>
      </div>
      )}

      {/* Monthly summary for long stays */}
      <div className="card">
        <div className="card-header-row">
          <div className="section-title" style={{ marginBottom: 0 }}>สรุปรายเดือน (เคสอยู่ยาว)</div>
          <button className="btn btn-outline print-hide" onClick={() => setShowSummary((v) => !v)}>
            {showSummary ? "ซ่อน" : `แสดง (${months.length} เดือน)`}
          </button>
        </div>
        {showSummary && (
          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <div className="summary-table-head">
              <div>เดือน</div><div>ครั้งที่วัด</div><div>ผิดปกติ</div><div>Temp เฉลี่ย (ต่ำ-สูง)</div><div>BP เฉลี่ย</div><div>HR เฉลี่ย (ต่ำ-สูง)</div><div>SpO2 เฉลี่ย (ต่ำ)</div>
            </div>
            {months.map((m) => (
              <div key={m.month} className="summary-table-row" style={{ background: m.alerts > 0 ? "oklch(97% 0.02 25)" : "transparent" }}>
                <div style={{ fontWeight: 700 }}>{monthLabel(m.month)}</div>
                <div>{m.count}</div>
                <div>{m.alerts > 0 ? <span className="badge badge-alert">⚠ {m.alerts}</span> : <span style={{ color: "var(--color-text-muted-2)" }}>—</span>}</div>
                <div>{m.temp_avg}° ({m.temp_min}–{m.temp_max})</div>
                <div>{m.sys_avg}/{m.dia_avg}</div>
                <div>{m.hr_avg} ({m.hr_min}–{m.hr_max})</div>
                <div>{m.spo2_avg}% (ต่ำสุด {m.spo2_min})</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="chart-header-row" style={{ marginBottom: 12 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            ประวัติสัญญาณชีพ <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--color-text-muted-2)" }}>({historyReversed.length} รายการ)</span>
          </div>
          <div className="range-tabs print-hide">
            {RANGES.map((r) => (
              <button
                key={r.days}
                className={days === r.days ? "range-tab active" : "range-tab"}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {loading && <div className="app-loading" style={{ padding: 20 }}>กำลังโหลด...</div>}
        {!loading && historyReversed.length === 0 && (
          <div className="app-loading" style={{ padding: 20 }}>ไม่มีข้อมูลในช่วง{RANGES.find((r) => r.days === days)?.label}</div>
        )}
        <div className="vitals-scroll">
        <div className={canEditRows ? "vitals-table-head with-actions" : "vitals-table-head"}>
          <div>วันที่</div><div>เวลา</div><div>Temp.</div><div>BP</div><div>HR</div><div>RR</div><div>SpO2</div><div>น้ำดื่ม(มล.)</div><div>ปัสสาวะ(ครั้ง)</div><div>อุจจาระ(ครั้ง)</div>
          {canEditRows && <div className="print-hide"></div>}
        </div>
        {historyReversed.map((v) => (
          <div key={v.id}>
            <div className={canEditRows ? "vitals-table-row with-actions" : "vitals-table-row"} style={{ background: v.abnormal ? "oklch(96% 0.03 25)" : "transparent" }}>
              <div>{v.date}</div><div>{v.time}</div><div>{v.temp}°</div><div>{v.bp}</div><div>{v.hr}</div><div>{v.rr}</div><div>{v.spo2}%</div><div>{io(v.intake)}</div><div>{io(v.urine)}</div><div>{io(v.stool)}</div>
              {canEditRows && (
                <div className="row-actions print-hide">
                  <button className="btn-link btn-link-primary" onClick={() => startRowEdit(v)}>แก้ไข</button>
                  <button className="btn-link btn-link-danger" onClick={() => removeRow(v)}>ลบ</button>
                </div>
              )}
            </div>
            {v.other && <div className="vitals-note-line">📝 {v.other}</div>}
            {canEditRows && editingId === v.id && (
              <div className="row-edit-panel print-hide">
                <div><span className="field-label-sm">เวลา</span><input className="input-sm" value={editDraft.time} onChange={setE("time")} /></div>
                <div><span className="field-label-sm">Temp</span><input className="input-sm" value={editDraft.temp} onChange={setE("temp")} /></div>
                <div><span className="field-label-sm">BP บน</span><input className="input-sm" value={editDraft.sys} onChange={setE("sys")} /></div>
                <div><span className="field-label-sm">BP ล่าง</span><input className="input-sm" value={editDraft.dia} onChange={setE("dia")} /></div>
                <div><span className="field-label-sm">HR</span><input className="input-sm" value={editDraft.hr} onChange={setE("hr")} /></div>
                <div><span className="field-label-sm">RR</span><input className="input-sm" value={editDraft.rr} onChange={setE("rr")} /></div>
                <div><span className="field-label-sm">SpO2</span><input className="input-sm" value={editDraft.spo2} onChange={setE("spo2")} /></div>
                <div><span className="field-label-sm">น้ำดื่ม (มล.)</span><input className="input-sm" value={editDraft.intake} onChange={setE("intake")} /></div>
                <div><span className="field-label-sm">ปัสสาวะ (ครั้ง)</span><input className="input-sm" value={editDraft.urine} onChange={setE("urine")} /></div>
                <div><span className="field-label-sm">อุจจาระ (ครั้ง)</span><input className="input-sm" value={editDraft.stool} onChange={setE("stool")} /></div>
                <div style={{ gridColumn: "1 / -1" }}><span className="field-label-sm">อื่นๆ</span><input className="input-sm" value={editDraft.other} onChange={setE("other")} /></div>
                <div style={{ display: "flex", gap: 6, alignItems: "end" }}>
                  <button className="btn-secondary-sm" onClick={() => setEditingId(null)}>ยกเลิก</button>
                  <button className="btn-primary-sm" onClick={saveRowEdit}>บันทึก</button>
                </div>
              </div>
            )}
          </div>
        ))}
        </div>
      </div>
    </>
  );
}
