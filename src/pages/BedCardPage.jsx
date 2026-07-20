import { Navigate, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { usePatient } from "../state/PatientsContext";
import { scanBedUrl } from "../utils/qr";
import { bedLabel } from "../data/beds";
import { TreeMark } from "../components/Logo";

export default function BedCardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const patient = usePatient(id);

  if (!patient) return <Navigate to="/" replace />;

  return (
    <div className="bedcard-page">
      <div className="bedcard-toolbar print-hide">
        <button className="btn btn-outline" onClick={() => navigate(`/patient/${patient.id}/vitals`)}>← กลับ</button>
        <button className="btn-primary" onClick={() => window.print()}>🖨️ พิมพ์การ์ด</button>
      </div>

      <div className="bedcard">
        <div className="bedcard-head">
          <div className="bedcard-facility">
            <TreeMark size={34} />
            <span>ณวรา ศูนย์ดูแลผู้สูงอายุและฟื้นฟูสมรรถภาพ<br /><span className="logo-sub" style={{ fontSize: 9.5 }}>NAVARA · NURSING HOME</span></span>
          </div>
          <div className="bedcard-bed">{bedLabel(patient.bed)}</div>
        </div>

        <div className="bedcard-name">{patient.name}</div>
        <div className="bedcard-sub">{patient.age} ปี · {patient.gender} · {patient.diagnosis}</div>

        <div className="bedcard-qr">
          <QRCodeSVG value={scanBedUrl(patient.bed)} size={240} level="M" marginSize={2} />
        </div>

        <div className="bedcard-cta">สแกนเพื่อบันทึกสัญญาณชีพ</div>
        <div className="bedcard-steps">
          เปิดกล้องมือถือ → สแกน QR → เลือกรอบเวลา → กรอกค่า → บันทึกเข้าระบบ
        </div>
      </div>
    </div>
  );
}
