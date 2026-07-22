// Role & capability model — shared by the server (permission checks) and the
// client (UI gating + the admin "manage roles" screen).
//
// A role is just a label + a set of capability flags. Built-in roles are fixed;
// admins can add/remove custom roles with any mix of the same capabilities,
// so new job functions don't need a code change.

// The capabilities a role can grant. Each maps to what the holder may WRITE.
export const CAPABILITIES = [
  { key: "general", label: "ข้อมูลทั่วไป / ประวัติ / ยา / Nurse Note / จำหน่าย / นัด / เตียง" },
  { key: "editName", label: "แก้ไขชื่อ-นามสกุลผู้ป่วย (สำหรับผู้จัดการ)" },
  { key: "vitals", label: "Vital Signs (รวมสแกน QR ปลายเตียง)" },
  { key: "doctorNote", label: "Doctor Note" },
  { key: "ptNote", label: "PT/OT Note" },
  { key: "assess", label: "แบบประเมิน ADL / Fall" },
  { key: "admin", label: "ผู้ดูแลระบบ (จัดการผู้ใช้/บทบาท · แก้ไขเวชระเบียนกลาง · แก้/ลบข้อมูลย้อนหลัง)" },
];

// Built-in roles (cannot be edited or deleted).
export const BUILTIN_ROLES = [
  { slug: "admin", label: "ผู้ดูแลระบบ", builtin: true, caps: { admin: true } },
  { slug: "manager", label: "ผู้จัดการ", builtin: true, caps: { general: true, editName: true, vitals: true, assess: true } },
  { slug: "doctor", label: "แพทย์", builtin: true, caps: { general: true, vitals: true, doctorNote: true, ptNote: true, assess: true } },
  { slug: "nurse", label: "พยาบาล", builtin: true, caps: { general: true, vitals: true, ptNote: true, assess: true } },
  { slug: "pt", label: "นักกายภาพบำบัด", builtin: true, caps: { vitals: true, ptNote: true, assess: true } },
  { slug: "ot", label: "นักกิจกรรมบำบัด", builtin: true, caps: { vitals: true, ptNote: true, assess: true } },
  { slug: "caregiver", label: "ผู้ดูแลผู้ป่วย", builtin: true, caps: { vitals: true } },
  { slug: "viewer", label: "อื่นๆ (ดูอย่างเดียว)", builtin: true, caps: {} },
];

// Normalize a caps object; the admin capability implies every other capability.
export function resolveCaps(caps) {
  if (caps?.admin) {
    return { general: true, editName: true, vitals: true, doctorNote: true, ptNote: true, assess: true, admin: true };
  }
  return {
    general: !!caps?.general,
    editName: !!caps?.editName,
    vitals: !!caps?.vitals,
    doctorNote: !!caps?.doctorNote,
    ptNote: !!caps?.ptNote,
    assess: !!caps?.assess,
    admin: false,
  };
}

export function isBuiltinRole(slug) {
  return BUILTIN_ROLES.some((r) => r.slug === slug);
}

export function builtinRole(slug) {
  return BUILTIN_ROLES.find((r) => r.slug === slug);
}
