import { FLOORS, roomName, bedId } from "../data/beds";

/**
 * Bed grid grouped by ชั้น (floor) → ห้อง (room) → เตียง (bed).
 * - bedCounts: { roomId: number }
 * - occupancy: { bedId: patient }
 * - value: currently selected free bed id
 * - onChange: (bedId) => void
 * - currentBed: patient's own bed (shown as "ปัจจุบัน", not selectable)
 */
export default function BedPicker({ bedCounts = {}, occupancy = {}, value, onChange, currentBed }) {
  return (
    <div className="bedpicker">
      {FLOORS.map((floor) => (
        <div key={floor.id} className="bedpicker-floor">
          <div className="bedpicker-floor-head">{floor.name}</div>
          <div className="bedpicker-rooms">
            {floor.rooms.map((room) => {
              const count = bedCounts[room.id] || 0;
              return (
                <div key={room.id} className="bedpicker-room">
                  <div className="bedpicker-room-name">{roomName(room.id)}</div>
                  <div className="bedpicker-room-beds">
                    {count === 0 && <span className="bedpicker-noroom">ไม่มีเตียง</span>}
                    {Array.from({ length: count }, (_, i) => {
                      const id = bedId(room.id, i + 1);
                      const occupant = occupancy[id];
                      const isCurrent = id === currentBed;
                      const isSelected = value === id;
                      const disabled = Boolean(occupant) || isCurrent;
                      let cls = "bed-chip";
                      if (isSelected) cls += " selected";
                      else if (isCurrent) cls += " current";
                      else if (occupant) cls += " occupied";
                      else cls += " free";
                      return (
                        <button
                          key={id}
                          type="button"
                          className={cls}
                          disabled={disabled}
                          title={occupant ? `${roomName(room.id)} เตียง ${i + 1} · ${occupant.name}` : isCurrent ? "เตียงปัจจุบัน" : "ว่าง"}
                          onClick={() => !disabled && onChange(id)}
                        >
                          <span className="bed-chip-id">เตียง {i + 1}</span>
                          <span className="bed-chip-status">
                            {occupant ? occupant.initial : isCurrent ? "ปัจจุบัน" : "ว่าง"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
