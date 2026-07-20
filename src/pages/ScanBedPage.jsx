import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePatients } from "../state/PatientsContext";
import { useAuth } from "../state/AuthContext";
import { buildOccupancy, bedLabel } from "../data/beds";
import BedsideVitalsForm from "../components/BedsideVitalsForm";

// Entry point for the permanent, bed-mounted QR card: looks up whichever
// patient currently occupies this physical bed, so the printed card never
// goes stale across admissions/discharges.
export default function ScanBedPage() {
  const { bedId } = useParams();
  const navigate = useNavigate();
  const { patients, loading } = usePatients();
  const { canVitals } = useAuth();

  const patient = useMemo(() => buildOccupancy(patients)[bedId], [patients, bedId]);

  if (loading) return <div className="app-loading">กำลังโหลดข้อมูล...</div>;

  if (!canVitals) {
    return (
      <div className="scan-page">
        <div className="scan-card">
          <div className="scan-title">ไม่มีสิทธิ์บันทึกข้อมูล</div>
          <p className="scan-muted">บัญชีของคุณเป็นแบบดูอย่างเดียว — การบันทึกสัญญาณชีพทำได้เฉพาะเจ้าหน้าที่</p>
          <button className="btn-primary" onClick={() => navigate("/")}>กลับหน้าหลัก</button>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="scan-page">
        <div className="scan-card">
          <div className="scan-title">เตียงว่าง</div>
          <p className="scan-muted">{bedLabel(bedId)} ยังไม่มีผู้ป่วยในความดูแลขณะนี้</p>
          <button className="btn-primary" onClick={() => navigate("/")}>กลับหน้าหลัก</button>
        </div>
      </div>
    );
  }

  return <BedsideVitalsForm patient={patient} />;
}
