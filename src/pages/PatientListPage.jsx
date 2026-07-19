import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePatients } from "../state/PatientsContext";
import { useAuth } from "../state/AuthContext";
import Avatar from "../components/Avatar";
import MoveBedModal from "../components/MoveBedModal";
import UserBar from "../components/UserBar";
import AppointmentCalendar from "../components/AppointmentCalendar";
import { TreeMark } from "../components/Logo";
import { FLOORS, roomName, bedId, bedShort, bedLabel, buildOccupancy, totalBeds } from "../data/beds";

export default function PatientListPage() {
  const { patients, bedCounts, addBed, removeBed, loading, error, wsStatus } = usePatients();
  const { canWrite } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showAlertOnly, setShowAlertOnly] = useState(false);
  const [view, setView] = useState("active"); // "active" | "beds" | "archive"
  const [moveTarget, setMoveTarget] = useState(null);

  const activePatients = useMemo(() => patients.filter((p) => p.status !== "discharged"), [patients]);
  const dischargedPatients = useMemo(() => patients.filter((p) => p.status === "discharged"), [patients]);
  const occupancy = useMemo(() => buildOccupancy(patients), [patients]);

  const alertCount = useMemo(() => activePatients.filter((p) => p.isAlert).length, [activePatients]);
  const capacity = totalBeds(bedCounts);
  const occupied = Object.keys(occupancy).length;

  const matches = (p, q) =>
    !q ||
    p.name.toLowerCase().includes(q) ||
    (p.bed || "").toLowerCase().includes(q) ||
    p.diagnosis.toLowerCase().includes(q);

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activePatients.filter((p) => matches(p, q) && (!showAlertOnly || p.isAlert));
  }, [activePatients, search, showAlertOnly]);

  const filteredArchive = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dischargedPatients.filter((p) => matches(p, q));
  }, [dischargedPatients, search]);

  const openPatient = (id) => navigate(`/patient/${id}/cover`);
  const isArchive = view === "archive";
  const isBeds = view === "beds";

  return (
    <div className="list-shell">
      <div className="top-header">
        <div className="brand-block">
          <TreeMark size={52} />
          <div>
            <div className="brand-eyebrow">NAVARA · NURSING HOME</div>
            <div className="brand-title">ณวรา ศูนย์ดูแลผู้สูงอายุและฟื้นฟูสมรรถภาพ</div>
            <div className="brand-subtitle">ระบบเวชระเบียนออนไลน์ · ภาพรวมผู้ป่วยทั้งหมด</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {wsStatus === "offline" && <span className="ws-chip">⚠ ออฟไลน์ — กำลังเชื่อมต่อใหม่</span>}
          {canWrite && <button className="admit-cta" onClick={() => navigate("/admit")}>🛎️ รับผู้ป่วยใหม่</button>}
          <UserBar />
        </div>
      </div>

      {loading && <div className="app-loading">กำลังโหลดข้อมูล...</div>}
      {error && !loading && <div className="admit-error">{error}</div>}

      <div className="view-tabs" style={{ flexWrap: "wrap", marginBottom: 20 }}>
        <button className={view === "active" ? "view-tab active" : "view-tab"} onClick={() => setView("active")}>
          🛏️ ผู้ป่วยในความดูแล
        </button>
        <button className={view === "calendar" ? "view-tab active" : "view-tab"} onClick={() => { setView("calendar"); setShowAlertOnly(false); }}>
          📅 ตารางนัด
        </button>
        <button className={isBeds ? "view-tab active" : "view-tab"} onClick={() => { setView("beds"); setShowAlertOnly(false); }}>
          🗺️ ผังเตียง
        </button>
        <button className={isArchive ? "view-tab active" : "view-tab"} onClick={() => { setView("archive"); setShowAlertOnly(false); }}>
          🗄️ เวชระเบียนกลาง
        </button>
      </div>

      {view === "active" && (
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-label">ผู้ป่วยในความดูแล</div>
            <div className="stat-value">{activePatients.length} คน</div>
          </div>
          <div
            className={showAlertOnly ? "alert-card active" : "alert-card"}
            onClick={() => setShowAlertOnly((v) => !v)}
            role="button"
            tabIndex={0}
          >
            <div className="alert-card-label">
              <span className="pulse-dot" />
              ต้องเฝ้าระวัง (สัญญาณชีพผิดปกติ) · คลิกเพื่อดูรายชื่อ
            </div>
            <div className="alert-card-value">{alertCount} คน</div>
          </div>
        </div>
      )}

      {isBeds && (
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-label">เตียงที่ใช้งาน</div>
            <div className="stat-value">{occupied} / {capacity}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">เตียงว่าง</div>
            <div className="stat-value">{capacity - occupied} เตียง</div>
          </div>
        </div>
      )}

      {isArchive && (
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-label">เวชระเบียนที่จำหน่ายแล้ว</div>
            <div className="stat-value">{dischargedPatients.length} ราย</div>
          </div>
        </div>
      )}

      {view === "active" && showAlertOnly && (
        <div className="filter-banner">
          <span className="filter-banner-text">⚠ กำลังแสดงเฉพาะผู้ป่วยที่สัญญาณชีพผิดปกติ</span>
          <button className="filter-banner-clear" onClick={() => setShowAlertOnly(false)}>✕ ล้างตัวกรอง</button>
        </div>
      )}

      {!isBeds && view !== "calendar" && (
        <div style={{ marginBottom: 18 }}>
          <input
            className="search-input"
            placeholder="ค้นหาชื่อผู้ป่วย, ห้อง/เตียง, การวินิจฉัย..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {view === "calendar" ? (
        <AppointmentCalendar patients={activePatients} />
      ) : isBeds ? (
        <BedBoard
          bedCounts={bedCounts}
          occupancy={occupancy}
          canWrite={canWrite}
          onOpen={openPatient}
          onMove={setMoveTarget}
          onAdmit={(bed) => navigate(`/admit?bed=${bed}`)}
          onAddBed={addBed}
          onRemoveBed={removeBed}
        />
      ) : isArchive ? (
        <ArchiveList patients={filteredArchive} onOpen={openPatient} />
      ) : (
        <ActiveList patients={filteredPatients} onOpen={openPatient} />
      )}

      {moveTarget && <MoveBedModal patient={moveTarget} onClose={() => setMoveTarget(null)} />}
    </div>
  );
}

function ActiveList({ patients, onOpen }) {
  return (
    <>
      {/* Desktop table */}
      <div className="patient-table desktop-only">
        <div className="patient-table-head">
          <div>ผู้ป่วย</div>
          <div>ห้อง/เตียง</div>
          <div>การวินิจฉัยหลัก</div>
          <div>อายุ/เพศ</div>
          <div>สัญญาณชีพล่าสุด</div>
          <div>สถานะ</div>
          <div></div>
        </div>
        {patients.map((p) => (
          <div key={p.id} className="patient-table-row" onClick={() => onOpen(p.id)}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar bg={p.avatarBg} initial={p.initial} />
              <div className="patient-name">{p.name}</div>
            </div>
            <div className="cell-muted">🛏️ {bedShort(p.bed)}</div>
            <div className="cell-muted-sm">{p.diagnosis}</div>
            <div className="cell-muted-sm">{p.age} / {p.gender}</div>
            <div className="vital-cell">
              T {p.lastVital.temp}°C · BP {p.lastVital.bp}
              <br />
              HR {p.lastVital.hr} · SpO2 {p.lastVital.spo2}%
            </div>
            <div>
              {p.isAlert ? <span className="badge badge-alert">⚠ ผิดปกติ</span> : <span className="badge badge-normal">ปกติ</span>}
            </div>
            <div className="view-link">ดูข้อมูล →</div>
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="patient-card-list mobile-only" style={{ maxWidth: 420, margin: "0 auto" }}>
        {patients.map((p) => (
          <div key={p.id} className="patient-card" onClick={() => onOpen(p.id)}>
            {p.isAlert && <span className="patient-card-alert-dot" />}
            <div className="patient-card-head">
              <Avatar bg={p.avatarBg} initial={p.initial} size={52} fontSize={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="patient-card-name">{p.name}</div>
                <div className="patient-card-sub">🛏️ {bedLabel(p.bed)} · {p.age} ปี · {p.gender}</div>
              </div>
            </div>
            <div className="patient-card-dx">{p.diagnosis}</div>
            <div className="patient-card-vitals">
              <span className="pill-chip">🌡 {p.lastVital.temp}°</span>
              <span className="pill-chip">BP {p.lastVital.bp}</span>
              <span className="pill-chip">SpO2 {p.lastVital.spo2}%</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function BedBoard({ bedCounts, occupancy, canWrite, onOpen, onMove, onAdmit, onAddBed, onRemoveBed }) {
  return (
    <div>
      {FLOORS.map((floor) => {
        const floorBeds = floor.rooms.reduce((a, r) => a + (bedCounts[r.id] || 0), 0);
        const floorOcc = floor.rooms.reduce(
          (a, r) => a + Array.from({ length: bedCounts[r.id] || 0 }, (_, i) => bedId(r.id, i + 1)).filter((b) => occupancy[b]).length,
          0
        );
        return (
          <div key={floor.id} className="floor-block">
            <div className="floor-head">
              <span className="floor-title">{floor.name}</span>
              <span className="floor-sub">ใช้งาน {floorOcc} / {floorBeds} เตียง</span>
            </div>

            <div className="room-list">
              {floor.rooms.map((room) => {
                const count = bedCounts[room.id] || 0;
                const lastBedOccupied = count > 0 && Boolean(occupancy[bedId(room.id, count)]);
                const roomOcc = Array.from({ length: count }, (_, i) => bedId(room.id, i + 1)).filter((b) => occupancy[b]).length;
                return (
                  <div key={room.id} className={room.staff ? "room-panel room-staff" : "room-panel"}>
                    <div className="room-head">
                      <div className="room-head-left">
                        <span className="room-name">🚪 {roomName(room.id)}</span>
                        <span className="room-occ">{roomOcc}/{count} เตียง</span>
                      </div>
                      {canWrite && (
                        <div className="room-bed-controls print-hide">
                          <button
                            className="bedctl-btn"
                            title="ลดเตียง (เตียงสุดท้ายต้องว่าง)"
                            disabled={count === 0 || lastBedOccupied}
                            onClick={() => onRemoveBed(room.id)}
                          >
                            − ลดเตียง
                          </button>
                          <button className="bedctl-btn add" title="เพิ่มเตียงในห้องนี้" onClick={() => onAddBed(room.id)}>
                            + เพิ่มเตียง
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="room-beds">
                      {count === 0 && <div className="room-empty">ห้องนี้ยังไม่มีเตียง — กด “+ เพิ่มเตียง”</div>}
                      {Array.from({ length: count }, (_, i) => {
                        const n = i + 1;
                        const id = bedId(room.id, n);
                        const p = occupancy[id];
                        if (!p) {
                          return (
                            <div key={id} className="bed-cell empty">
                              <span className="bed-cell-id">เตียง {n} · ว่าง</span>
                              {canWrite && <button className="btn-primary-sm" onClick={() => onAdmit(id)}>+ รับ</button>}
                            </div>
                          );
                        }
                        return (
                          <div
                            key={id}
                            className={p.isAlert ? "bed-cell occupied alert" : "bed-cell occupied"}
                            onClick={() => onOpen(p.id)}
                            title={`${p.name} · ดูเวชระเบียน`}
                          >
                            <div className="bed-cell-topline">
                              <span className="bed-cell-id">เตียง {n}</span>
                              {p.isAlert ? (
                                <span className="bed-status alert" title="สัญญาณชีพผิดปกติ">⚠</span>
                              ) : (
                                <span className="bed-status ok" title="ปกติ" />
                              )}
                            </div>
                            <div className="bed-cell-body">
                              <Avatar bg={p.avatarBg} initial={p.initial} size={30} fontSize={13} />
                              <div className="bed-cell-name">{p.name}</div>
                              {canWrite && (
                                <button
                                  className="bed-move-btn print-hide"
                                  title="ย้ายเตียง"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMove(p);
                                  }}
                                >
                                  🔀
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArchiveList({ patients, onOpen }) {
  if (patients.length === 0) {
    return <div className="archive-empty">ยังไม่มีเวชระเบียนที่จำหน่าย · เมื่อจำหน่ายผู้ป่วยแล้ว ข้อมูลจะถูกเก็บไว้ที่นี่</div>;
  }
  return (
    <>
      {/* Desktop table */}
      <div className="patient-table desktop-only">
        <div className="patient-table-head" style={{ gridTemplateColumns: "2.1fr 1.6fr 1.3fr 1.3fr 0.8fr" }}>
          <div>ผู้ป่วย</div>
          <div>การวินิจฉัยหลัก</div>
          <div>วันที่จำหน่าย</div>
          <div>ประเภทการจำหน่าย</div>
          <div></div>
        </div>
        {patients.map((p) => (
          <div
            key={p.id}
            className="patient-table-row"
            style={{ gridTemplateColumns: "2.1fr 1.6fr 1.3fr 1.3fr 0.8fr" }}
            onClick={() => onOpen(p.id)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar bg={p.avatarBg} initial={p.initial} />
              <div>
                <div className="patient-name">{p.name}</div>
                <div className="cell-muted-sm">เตียงเดิม {bedLabel(p.bed)} · {p.age} ปี · {p.gender}</div>
              </div>
            </div>
            <div className="cell-muted-sm">{p.diagnosis}</div>
            <div className="cell-muted-sm">{p.discharge?.date}</div>
            <div><span className="archive-badge">{p.discharge?.type}</span></div>
            <div className="view-link">ดูเวชระเบียน →</div>
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="patient-card-list mobile-only" style={{ maxWidth: 420, margin: "0 auto" }}>
        {patients.map((p) => (
          <div key={p.id} className="patient-card" onClick={() => onOpen(p.id)}>
            <div className="patient-card-head">
              <Avatar bg={p.avatarBg} initial={p.initial} size={52} fontSize={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="patient-card-name">{p.name}</div>
                <div className="patient-card-sub">เตียงเดิม {bedLabel(p.bed)} · {p.age} ปี · {p.gender}</div>
              </div>
            </div>
            <div className="patient-card-dx">{p.diagnosis}</div>
            <div className="patient-card-vitals">
              <span className="archive-badge">{p.discharge?.type}</span>
              <span className="pill-chip">จำหน่าย {p.discharge?.date}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
