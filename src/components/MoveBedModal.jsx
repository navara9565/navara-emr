import { useMemo, useState } from "react";
import { usePatients } from "../state/PatientsContext";
import { buildOccupancy, bedLabel } from "../data/beds";
import BedPicker from "./BedPicker";

export default function MoveBedModal({ patient, onClose }) {
  const { patients, bedCounts, moveBed } = usePatients();
  const occupancy = useMemo(() => buildOccupancy(patients), [patients]);
  const [target, setTarget] = useState("");

  const submit = () => {
    if (!target) return;
    moveBed(patient.id, target);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="card-title">ย้ายเตียง</div>
            <div className="modal-sub">{patient.name} · เตียงปัจจุบัน {bedLabel(patient.bed)}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">✕</button>
        </div>

        <div className="modal-note" style={{ background: "oklch(96% 0.03 260)", borderColor: "oklch(85% 0.05 260)", color: "oklch(42% 0.1 260)" }}>
          เลือกเตียงว่างที่ต้องการย้ายผู้ป่วยไป {target && <b>· ปลายทาง: {bedLabel(target)}</b>}
        </div>

        <BedPicker bedCounts={bedCounts} occupancy={occupancy} value={target} onChange={setTarget} currentBed={patient.bed} />

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
          <button className="btn-primary" onClick={submit} disabled={!target} style={!target ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
            ยืนยันย้ายเตียง
          </button>
        </div>
      </div>
    </div>
  );
}
