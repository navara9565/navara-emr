import { AVATAR_COLORS } from "./constants";
import { fmtDate, isAbnormal, TODAY } from "../utils/format";

const TITLES = ["เด็กชาย", "เด็กหญิง", "นางสาว", "นาย", "นาง", "คุณ"];

function initialOf(name) {
  let n = (name || "").trim();
  for (const t of TITLES) {
    if (n.startsWith(t)) {
      n = n.slice(t.length).trim();
      break;
    }
  }
  return (n || name || "?").charAt(0) || "?";
}

// Build a complete patient record from the admission form.
export function createPatient(form, colorSeed = Date.now()) {
  const temp = parseFloat(form.temp) || 36.5;
  const sys = parseInt(form.sys, 10) || 120;
  const dia = parseInt(form.dia, 10) || 78;
  const hr = parseInt(form.hr, 10) || 76;
  const rr = parseInt(form.rr, 10) || 18;
  const spo2 = parseInt(form.spo2, 10) || 98;
  const admitDate = form.admitDate || fmtDate(TODAY);

  return {
    id: "p" + Date.now(),
    name: form.name.trim(),
    age: parseInt(form.age, 10) || 0,
    gender: form.gender || "ชาย",
    status: "active",
    bed: form.bed,
    room: "-",
    diagnosis: form.diagnosis || "-",
    idNumber: form.idNumber || "-",
    address: form.address || "-",
    admitDate,
    contact1Name: form.contact1Name || "-",
    contact1Relation: form.contact1Relation || "-",
    contact1Phone: form.contact1Phone || "-",
    contact2Name: "-",
    contact2Relation: "-",
    contact2Phone: "-",
    drugAllergy: form.drugAllergy || "ไม่มีประวัติแพ้ยา",
    foodAllergy: form.foodAllergy || "ไม่มี",
    carePlanGoal: form.carePlanGoal || "-",
    codeStatus: form.codeStatus || "-",
    avatarBg: AVATAR_COLORS[Math.abs(colorSeed) % AVATAR_COLORS.length],
    initial: initialOf(form.name),
    presentIllness: form.presentIllness || "-",
    pastIllness: form.pastIllness || "-",
    physicalExam: form.physicalExam || "-",
    medications: [],
    medChangeLog: [],
    doctorNotes: [],
    nurseNotes: [],
    ptNotes: [],
    vitalsHistory: [
      { date: admitDate, time: "แรกรับ", temp: temp.toFixed(1), sys, dia, hr, rr, spo2, recordedBy: "พยาบาลแรกรับ" },
    ],
    lastVital: { temp: temp.toFixed(1), bp: sys + "/" + dia, hr, spo2 },
    isAlert: isAbnormal(temp, sys, hr, spo2),
  };
}
