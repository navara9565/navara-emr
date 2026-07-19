import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { monthLabel, todayISO } from "../utils/format";

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function ym(d) {
  return d.toISOString().slice(0, 7);
}

// Month-grid calendar of every active patient's hospital appointments.
export default function AppointmentCalendar({ patients }) {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => ym(new Date())); // "YYYY-MM"
  const today = todayISO();

  const shiftMonth = (delta) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(ym(d));
  };

  // day ("YYYY-MM-DD") -> [{patient, appt}] sorted by time
  const byDay = useMemo(() => {
    const map = {};
    for (const p of patients) {
      for (const a of p.appointments || []) {
        if (a.date?.startsWith(month)) (map[a.date] ||= []).push({ patient: p, appt: a });
      }
    }
    for (const list of Object.values(map)) list.sort((x, y) => (x.appt.time < y.appt.time ? -1 : 1));
    return map;
  }, [patients, month]);

  const monthCount = Object.values(byDay).reduce((n, list) => n + list.length, 0);
  const todayCount = (byDay[today] || []).length;

  const [y, m] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-label">นัดใน{monthLabel(month)}</div>
          <div className="stat-value">{monthCount} ครั้ง</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">นัดวันนี้</div>
          <div className="stat-value">{todayCount} ครั้ง</div>
        </div>
      </div>

      <div className="cal-toolbar">
        <button className="btn btn-outline" onClick={() => shiftMonth(-1)}>‹ เดือนก่อน</button>
        <div className="cal-month-title">📅 {monthLabel(month)}</div>
        <button className="btn btn-outline" onClick={() => shiftMonth(1)}>เดือนถัดไป ›</button>
      </div>

      <div className="cal-grid-wrap">
        <div className="cal-grid">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-weekday">{w}</div>
          ))}
          {cells.map((day, idx) => {
            if (day === null) return <div key={"x" + idx} className="cal-cell blank" />;
            const iso = `${month}-${String(day).padStart(2, "0")}`;
            const items = byDay[iso] || [];
            return (
              <div key={iso} className={iso === today ? "cal-cell today" : "cal-cell"}>
                <div className="cal-daynum">{day}</div>
                <div className="cal-items">
                  {items.map(({ patient, appt }) => (
                    <button
                      key={appt.id}
                      className="cal-appt"
                      title={`${patient.name} · ${appt.time} น. · ${appt.hospital} · แผนก${appt.department}${appt.lab ? " · Lab" : ""}${appt.xray ? " · X-ray" : ""}${appt.note ? ` · 📝 ${appt.note}` : ""}`}
                      onClick={() => navigate(`/patient/${patient.id}/cover`)}
                    >
                      <span className="cal-appt-time">{appt.time}</span>
                      <span className="cal-appt-name">{patient.name.replace(/^(นาย|นางสาว|นาง)/, "")}</span>
                      <span className="cal-appt-flags">{appt.lab && "🧪"}{appt.xray && "🩻"}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="cal-legend">คลิกที่รายการนัดเพื่อเปิดเวชระเบียน · 🧪 = เจาะ Lab · 🩻 = X-ray</div>
    </div>
  );
}
