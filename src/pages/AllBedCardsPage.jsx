import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { usePatients } from "../state/PatientsContext";
import { scanBedUrl } from "../utils/qr";
import { FLOORS, listBeds, roomName, buildOccupancy } from "../data/beds";
import { TreeMark } from "../components/Logo";

// Printable sheet of one QR card per physical bed — grouped by floor/room.
// The QR encodes the bed (not a patient), but the card also prints the current
// occupant's name so staff can double-check they're logging the right person.
// Reprint after admissions/discharges to keep the names current.
export default function AllBedCardsPage() {
  const { bedCounts, patients, loading } = usePatients();
  const navigate = useNavigate();

  if (loading) return <div className="app-loading">กำลังโหลดข้อมูล...</div>;

  const occupancy = buildOccupancy(patients);
  // เฉพาะเตียงที่มีผู้ป่วย (ไม่แสดงเตียงว่าง)
  const beds = listBeds(bedCounts).filter((b) => occupancy[b.id]);
  const byFloor = FLOORS.map((floor) => ({
    floor,
    beds: beds.filter((b) => b.floorId === floor.id),
  })).filter((f) => f.beds.length > 0);

  return (
    <div className="allcards-page">
      <div className="bedcard-toolbar print-hide">
        <button className="btn btn-outline" onClick={() => navigate("/")}>← กลับ</button>
        <button className="btn-primary" onClick={() => window.print()}>🖨️ พิมพ์ QR ({beds.length} ใบ)</button>
      </div>

      <p className="allcards-hint print-hide">
        แสดงเฉพาะเตียงที่มีผู้ป่วย — พิมพ์แล้วตัดตามเส้นประ แปะที่ปลายเตียง · สแกนแล้วขึ้นชื่อผู้ป่วยให้ตรวจสอบก่อนบันทึก
        · หากเปลี่ยนผู้ป่วยให้พิมพ์การ์ดใบนั้นใหม่
      </p>
      {beds.length === 0 && <div className="empty-hint">ยังไม่มีผู้ป่วยในความดูแล</div>}

      {byFloor.map(({ floor, beds: floorBeds }) => (
        <div key={floor.id} className="allcards-floor">
          <div className="allcards-floor-title">{floor.name}</div>
          <div className="allcards-grid">
            {floorBeds.map((b) => {
              const occupant = occupancy[b.id];
              return (
                <div key={b.id} className="minicard">
                  <div className="minicard-head">
                    <TreeMark size={18} />
                    <span>NAVARA</span>
                  </div>
                  <div className="minicard-bed">{roomName(b.roomId)} · เตียง {b.num}</div>
                  <div className="minicard-name">{occupant ? occupant.name : "— เตียงว่าง —"}</div>
                  <div className="minicard-qr">
                    <QRCodeSVG value={scanBedUrl(b.id)} size={104} level="M" marginSize={1} />
                  </div>
                  <div className="minicard-cta">สแกนบันทึกสัญญาณชีพ</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
