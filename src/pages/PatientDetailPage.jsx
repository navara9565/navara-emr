import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { usePatient, usePatients } from "../state/PatientsContext";
import { useAuth } from "../state/AuthContext";
import Avatar from "../components/Avatar";
import DischargeModal from "../components/DischargeModal";
import MoveBedModal from "../components/MoveBedModal";
import AppointmentsModal from "../components/AppointmentsModal";
import { bedLabel } from "../data/beds";
import { thaiDate, todayISO } from "../utils/format";
import { TABS } from "../data/tabs";
import CoverTab from "../components/tabs/CoverTab";
import HistoryTab from "../components/tabs/HistoryTab";
import VitalsTab from "../components/tabs/VitalsTab";
import MedicationsTab from "../components/tabs/MedicationsTab";
import DoctorNoteTab from "../components/tabs/DoctorNoteTab";
import NurseNoteTab from "../components/tabs/NurseNoteTab";
import PtOtTab from "../components/tabs/PtOtTab";
import AssessmentsTab from "../components/tabs/AssessmentsTab";

const TAB_COMPONENTS = {
  cover: CoverTab,
  history: HistoryTab,
  vitals: VitalsTab,
  medications: MedicationsTab,
  "doctor-note": DoctorNoteTab,
  "nurse-note": NurseNoteTab,
  "pt-ot": PtOtTab,
  assessments: AssessmentsTab,
};

export default function PatientDetailPage() {
  const { id, tab } = useParams();
  const navigate = useNavigate();
  const patient = usePatient(id);
  const { readmitPatient, loading } = usePatients();
  const { canWrite, canVitals, canPtNote, canAssess, isAdmin } = useAuth();
  const [showDischarge, setShowDischarge] = useState(false);
  const [showMoveBed, setShowMoveBed] = useState(false);
  const [showAppointments, setShowAppointments] = useState(false);

  if (loading) return <div className="app-loading">กำลังโหลดข้อมูล...</div>;
  if (!patient) return <Navigate to="/" replace />;
  if (!TAB_COMPONENTS[tab]) return <Navigate to={`/patient/${id}/cover`} replace />;

  const ActiveTab = TAB_COMPONENTS[tab];
  const isDischarged = patient.status === "discharged";
  // Archived records (central archive) are editable by admin only.
  const readOnly = isDischarged ? !isAdmin : !canWrite;
  // แท็บ Vital Signs และ PT/OT เปิดสิทธิ์กว้างกว่าแท็บอื่น
  // (นักกายภาพ/กิจกรรมบำบัด/ผู้ดูแลผู้ป่วย บันทึกได้เฉพาะหน้าของตน)
  const tabReadOnly =
    tab === "vitals" ? (isDischarged ? !isAdmin : !canVitals)
    : tab === "pt-ot" ? (isDischarged ? !isAdmin : !canPtNote)
    : tab === "assessments" ? (isDischarged ? !isAdmin : !canAssess)
    : readOnly;

  // Next upcoming hospital appointment (shown under the header line).
  const today = todayISO();
  const nextAppt = [...(patient.appointments || [])]
    .filter((a) => a.date >= today)
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))[0];

  return (
    <div className="patient-shell">
      <div className="patient-header">
        <button className="btn btn-outline print-hide" onClick={() => navigate("/")}>
          ← กลับ
        </button>
        <Avatar bg={patient.avatarBg} initial={patient.initial} size={52} fontSize={19} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="patient-header-name">{patient.name}</div>
          <div className="patient-header-sub">
            🛏️ {bedLabel(patient.bed)} · {patient.age} ปี · {patient.gender} · {patient.diagnosis}
          </div>
          <div className="appt-line">
            {nextAppt ? (
              <span className="appt-chip" title="นัดโรงพยาบาลครั้งถัดไป">
                🏥 นัด {thaiDate(nextAppt.date)} · {nextAppt.time} น. · {nextAppt.hospital} · {nextAppt.department}
                {nextAppt.lab && " · 🧪 Lab"}
                {nextAppt.xray && " · 🩻 X-ray"}
                {nextAppt.note && ` · 📝 ${nextAppt.note}`}
              </span>
            ) : (
              <span className="appt-none">ไม่มีนัดโรงพยาบาล</span>
            )}
            <button className="appt-manage-btn print-hide" onClick={() => setShowAppointments(true)}>
              {canWrite && !isDischarged ? "จัดการนัด" : "ดูนัดทั้งหมด"}
            </button>
          </div>
        </div>
        {isDischarged ? (
          <span className="archive-badge" style={{ fontSize: 13.5, padding: "8px 14px" }}>🗄️ เวชระเบียนกลาง · จำหน่ายแล้ว</span>
        ) : (
          patient.isAlert && (
            <span className="badge badge-alert" style={{ fontSize: 13.5, padding: "8px 14px" }}>⚠ สัญญาณชีพผิดปกติ</span>
          )
        )}
        <div className="hdr-actions print-hide">
          {!isDischarged && canWrite && (
            <button className="btn-hdr" onClick={() => setShowMoveBed(true)}>
              🔀 ย้ายเตียง
            </button>
          )}
          {!isDischarged && canWrite && (
            <button className="btn-hdr danger" onClick={() => setShowDischarge(true)}>
              📤 จำหน่าย
            </button>
          )}
          <button className="btn-hdr primary" onClick={() => window.print()}>
            🖨️ PDF
          </button>
        </div>
      </div>

      {isDischarged && (
        <div className="discharge-banner">
          <div className="discharge-banner-head">
            <span className="discharge-banner-title">📤 ผู้ป่วยถูกจำหน่ายแล้ว</span>
            <span className="archive-badge">{patient.discharge?.type}</span>
            {isAdmin && (
              <span className="badge badge-normal print-hide">✏️ สิทธิ์ผู้ดูแลระบบ — แก้ไขเวชระเบียนกลางได้</span>
            )}
            {isAdmin && (
              <button
                className="btn-secondary-sm print-hide"
                style={{ marginLeft: "auto" }}
                onClick={() => readmitPatient(patient.id)}
              >
                ↩ รับผู้ป่วยกลับเข้าดูแล
              </button>
            )}
          </div>
          <div className="discharge-banner-grid">
            <div>
              <span className="discharge-detail-label">วันที่จำหน่าย</span>
              <div className="discharge-detail-value">{patient.discharge?.date}</div>
            </div>
            <div>
              <span className="discharge-detail-label">ผู้จำหน่าย</span>
              <div className="discharge-detail-value">{patient.discharge?.signer}</div>
            </div>
            <div className="span-2">
              <span className="discharge-detail-label">สรุปการรักษา / อาการเมื่อจำหน่าย</span>
              <div className="discharge-detail-value">{patient.discharge?.summary}</div>
            </div>
            <div className="span-2">
              <span className="discharge-detail-label">คำแนะนำ / แผนการดูแลต่อเนื่อง</span>
              <div className="discharge-detail-value">{patient.discharge?.plan}</div>
            </div>
          </div>
        </div>
      )}

      <div className="tab-nav print-hide">
        {TABS.map((t) => (
          <button
            key={t.slug}
            className={t.slug === tab ? "tab-nav-btn active" : "tab-nav-btn"}
            onClick={() => navigate(`/patient/${id}/${t.slug}`)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ActiveTab patient={patient} readOnly={tabReadOnly} />

      {showDischarge && <DischargeModal patient={patient} onClose={() => setShowDischarge(false)} />}
      {showMoveBed && <MoveBedModal patient={patient} onClose={() => setShowMoveBed(false)} />}
      {showAppointments && (
        <AppointmentsModal patient={patient} canWrite={!readOnly} onClose={() => setShowAppointments(false)} />
      )}
    </div>
  );
}
