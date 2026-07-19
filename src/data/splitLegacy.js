// Splits a legacy patient document (with embedded vitalsHistory / doctorNotes
// / nurseNotes / ptNotes arrays) into a lean doc + separate vital/note rows.
// Used by both the server migration/seeding (server/db.js) and demo mode
// (src/demoApi.js) so both storage layers share one schema.

const DAY = 24 * 60 * 60 * 1000;

// Legacy rows carry only Thai display dates, so timestamps are synthesized
// from array order: vitals are stored oldest-first (1/day ending today),
// notes newest-first (1/day back from today). Display date/time strings on
// each row are preserved as-is.
export function splitLegacyDoc(doc, now = Date.now()) {
  const { vitalsHistory, doctorNotes, nurseNotes, ptNotes, ...rest } = doc;
  const vitals = [];
  const notes = [];

  if (Array.isArray(vitalsHistory)) {
    const n = vitalsHistory.length;
    vitalsHistory.forEach((v, i) => {
      vitals.push({
        id: `v_${doc.id}_${i}`,
        patientId: doc.id,
        ts: new Date(now - (n - 1 - i) * DAY).toISOString(),
        date: v.date,
        time: v.time,
        temp: String(v.temp),
        sys: Number(v.sys),
        dia: Number(v.dia),
        hr: Number(v.hr),
        rr: Number(v.rr),
        spo2: Number(v.spo2),
        recordedBy: v.recordedBy || "พยาบาลประจำเวร",
      });
    });
  }

  const pushNotes = (list, kind) => {
    if (!Array.isArray(list)) return;
    list.forEach((item, i) => {
      const { date, author, ...payload } = item;
      notes.push({
        id: `n_${kind}_${doc.id}_${i}`,
        patientId: doc.id,
        kind,
        ts: new Date(now - i * DAY).toISOString(),
        date,
        author,
        payload,
      });
    });
  };
  pushNotes(doctorNotes, "doctor");
  pushNotes(nurseNotes, "nurse");
  pushNotes(ptNotes, "pt");

  return { doc: rest, vitals, notes };
}

export function isLegacyDoc(doc) {
  return Boolean(doc.vitalsHistory || doc.doctorNotes || doc.nurseNotes || doc.ptNotes);
}
