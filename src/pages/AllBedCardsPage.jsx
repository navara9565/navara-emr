import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { usePatients } from "../state/PatientsContext";
import { scanBedUrl } from "../utils/qr";
import { FLOORS, listBeds, roomName } from "../data/beds";
import { TreeMark } from "../components/Logo";

// Printable sheet of one QR card per physical bed — grouped by floor/room,
// meant to be cut out and stuck at each bedside once. The QR encodes the
// bed itself (not a patient), so cards never need reprinting on turnover.
export default function AllBedCardsPage() {
  const { bedCounts, loading } = usePatients();
  const navigate = useNavigate();

  if (loading) return <div className="app-loading">กำลังโหลดข้อมูล...</div>;

  const beds = listBeds(bedCounts);
  const byFloor = FLOORS.map((floor) => ({
    floor,
    beds: beds.filter((b) => b.floorId === floor.id),
  })).filter((f) => f.beds.length > 0);

  return (
    <div className="allcards-page">
      <div className="bedcard-toolbar print-hide">
        <button className="btn btn-outline" onClick={() => navigate("/")}>← กลับ</button>
        <button className="btn-primary" onClick={() => window.print()}>🖨️ พิมพ์ QR ทุกเตียง ({beds.length} ใบ)</button>
      </div>

      <p className="allcards-hint print-hide">
        พิมพ์แล้วตัดตามเส้นประ แปะที่ปลายเตียงแต่ละเตียง — QR นี้ผูกกับ "เตียง" ไม่ใช่ผู้ป่วย จึงไม่ต้องพิมพ์ใหม่เวลาเปลี่ยนผู้ป่วย
      </p>

      {byFloor.map(({ floor, beds: floorBeds }) => (
        <div key={floor.id} className="allcards-floor">
          <div className="allcards-floor-title">{floor.name}</div>
          <div className="allcards-grid">
            {floorBeds.map((b) => (
              <div key={b.id} className="minicard">
                <div className="minicard-head">
                  <TreeMark size={18} />
                  <span>NAVARA</span>
                </div>
                <div className="minicard-bed">{roomName(b.roomId)} · เตียง {b.num}</div>
                <div className="minicard-qr">
                  <QRCodeSVG value={scanBedUrl(b.id)} size={108} level="M" marginSize={1} />
                </div>
                <div className="minicard-cta">สแกนบันทึกสัญญาณชีพ</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
