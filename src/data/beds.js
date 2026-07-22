// Facility layout: ชั้น (floor) → ห้อง (room) → เตียง (bed).
// Bed count per room is dynamic (add/remove) and lives in context state;
// FLOORS below only defines which rooms exist on each floor.

export const FLOORS = [
  {
    id: "1",
    name: "ชั้น 1",
    rooms: [
      { id: "N101" },
      { id: "N102" },
      { id: "staff", name: "Staff", staff: true },
    ],
  },
  {
    id: "2",
    name: "ชั้น 2",
    rooms: [
      { id: "N201" },
      { id: "N202" },
      { id: "N203" },
      { id: "N204" },
      { id: "N205" },
      { id: "N206" },
      { id: "N207" },
      { id: "N208" },
    ],
  },
  {
    id: "3",
    name: "ชั้น 3",
    rooms: [
      { id: "N301" },
      { id: "N302" },
      { id: "N303" },
      { id: "N304" },
    ],
  },
];

// Initial number of beds in each room.
export const INITIAL_BED_COUNTS = {
  N101: 1, N102: 1, staff: 1,
  N201: 1, N202: 4, N203: 1, N204: 4, N205: 1, N206: 4, N207: 4, N208: 1,
  N301: 1, N302: 4, N303: 1, N304: 4,
};

export const ALL_ROOMS = FLOORS.flatMap((f) =>
  f.rooms.map((r) => ({ ...r, floorId: f.id, floorName: f.name }))
);

export function roomName(roomId) {
  const r = ALL_ROOMS.find((x) => x.id === roomId);
  if (r?.name) return r.name;
  return roomId;
}

// Physical order of rooms (floor → room, following FLOORS).
const ROOM_ORDER = Object.fromEntries(ALL_ROOMS.map((r, i) => [r.id, i]));

// Compare two bed ids by floor, then room, then bed number.
export function compareBeds(a, b) {
  const pa = parseBed(a);
  const pb = parseBed(b);
  const ra = ROOM_ORDER[pa.roomId] ?? 9999;
  const rb = ROOM_ORDER[pb.roomId] ?? 9999;
  if (ra !== rb) return ra - rb;
  return (pa.num || 0) - (pb.num || 0);
}

export function bedId(roomId, n) {
  return roomId + "-" + n;
}

export function parseBed(id) {
  const s = id || "";
  const idx = s.lastIndexOf("-");
  if (idx < 0) return { roomId: s, num: null };
  return { roomId: s.slice(0, idx), num: parseInt(s.slice(idx + 1), 10) };
}

// "N202 · เตียง 3" / "Staff · เตียง 1"
export function bedLabel(id) {
  const { roomId, num } = parseBed(id);
  if (num == null) return id || "-";
  return roomName(roomId) + " · เตียง " + num;
}

// Compact form: "N202/3"
export function bedShort(id) {
  const { roomId, num } = parseBed(id);
  if (num == null) return id || "-";
  return roomName(roomId) + "/" + num;
}

// Ordered list of bed objects for the given bed counts.
export function listBeds(bedCounts) {
  const beds = [];
  for (const room of ALL_ROOMS) {
    const c = bedCounts[room.id] || 0;
    for (let n = 1; n <= c; n++) {
      beds.push({ id: bedId(room.id, n), roomId: room.id, num: n, floorId: room.floorId, staff: room.staff });
    }
  }
  return beds;
}

// bedId -> active patient occupying it (discharged patients free their bed).
export function buildOccupancy(patients) {
  const map = {};
  for (const p of patients) {
    if (p.status !== "discharged" && p.bed) map[p.bed] = p;
  }
  return map;
}

export function totalBeds(bedCounts) {
  return Object.values(bedCounts).reduce((a, b) => a + b, 0);
}
