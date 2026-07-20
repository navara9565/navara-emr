import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { scanBedUrl } from "../utils/qr";
import { bedLabel } from "../data/beds";

export default function BedsideQR({ patient }) {
  const navigate = useNavigate();
  const link = scanBedUrl(patient.bed);

  return (
    <div className="card qr-card print-hide">
      <div className="qr-visual">
        <QRCodeSVG value={link} size={132} level="M" marginSize={1} />
        <div className="qr-bed">{bedLabel(patient.bed)}</div>
      </div>
      <div className="qr-info">
        <div className="section-title" style={{ marginBottom: 6 }}>สแกน QR ปลายเตียงเพื่อบันทึกสัญญาณชีพ</div>
        <p className="qr-desc">
          พยาบาลสแกน QR ที่ปลายเตียงด้วยมือถือ จะเปิดฟอร์มบันทึกสัญญาณชีพของผู้ป่วยรายนี้โดยเฉพาะ
          เลือกรอบเวลาแล้วบันทึก — ข้อมูลจะเข้าระบบและอัปเดตกราฟทันที
        </p>
        <div className="qr-actions">
          <button className="btn-primary" onClick={() => navigate(`/scan-bed/${patient.bed}`)}>📷 ทดลองสแกน (จำลอง)</button>
          <button className="btn btn-outline" onClick={() => navigate(`/bedcard/${patient.id}`)}>🖨️ พิมพ์การ์ดปลายเตียง</button>
        </div>
      </div>
    </div>
  );
}
