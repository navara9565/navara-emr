import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api, connectWS } from "../api";
import { createPatient } from "../data/createPatient";
import { bedId } from "../data/beds";
import { fmtDate, TODAY } from "../utils/format";

const PatientsContext = createContext(null);

export function PatientsProvider({ children }) {
  const [patients, setPatients] = useState([]);
  const [bedCounts, setBedCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wsStatus, setWsStatus] = useState("connecting");

  const patientsRef = useRef(patients);
  patientsRef.current = patients;

  // Simple event bus: vitals/notes hooks subscribe to realtime messages.
  const listenersRef = useRef(new Set());
  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const refetch = useCallback(async () => {
    try {
      const d = await api.fetchAll();
      setPatients(d.patients);
      setBedCounts(d.bedCounts);
      setError("");
    } catch (e) {
      setError(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + realtime subscription.
  useEffect(() => {
    refetch();
    const close = connectWS((msg) => {
      if (msg.type === "patient" && msg.patient) {
        setPatients((prev) => {
          const exists = prev.some((p) => p.id === msg.patient.id);
          return exists ? prev.map((p) => (p.id === msg.patient.id ? msg.patient : p)) : [...prev, msg.patient];
        });
      } else if (msg.type === "snapshot" && Array.isArray(msg.patients)) {
        setPatients(msg.patients);
      } else if (msg.type === "bedcounts" && msg.bedCounts) {
        setBedCounts(msg.bedCounts);
      } else if (msg.type === "refresh") {
        refetch();
      }
      // Forward everything (vital/note/refresh) to subscribed hooks.
      for (const fn of listenersRef.current) fn(msg);
    }, setWsStatus);
    return close;
  }, [refetch]);

  // Compute the new document locally, apply optimistically, persist to the
  // server (which broadcasts it to every other device).
  const mutate = useCallback(
    (id, action, updater) => {
      const current = patientsRef.current.find((p) => p.id === id);
      if (!current) return;
      const next = updater(current);
      setPatients((prev) => prev.map((p) => (p.id === id ? next : p)));
      api.applyAction(id, action, next).catch((e) => {
        setError(e.message || "บันทึกไม่สำเร็จ");
        refetch(); // roll back to server truth
      });
    },
    [refetch]
  );

  const actions = useMemo(() => {
    const today = () => fmtDate(TODAY);

    return {
      saveCover: (id, d) =>
        mutate(id, "saveCover", (p) => ({
          ...p,
          age: d.age === undefined || d.age === "" ? p.age : parseInt(d.age, 10) || 0,
          gender: d.gender || p.gender,
          idNumber: d.idNumber,
          address: d.address,
          diagnosis: d.diagnosis,
          contact1Name: d.contact1Name,
          contact1Relation: d.contact1Relation,
          contact1Phone: d.contact1Phone,
          contact2Name: d.contact2Name,
          contact2Relation: d.contact2Relation,
          contact2Phone: d.contact2Phone,
        })),

      saveHistory: (id, d) =>
        mutate(id, "saveHistory", (p) => ({
          ...p,
          presentIllness: d.presentIllness,
          pastIllness: d.pastIllness,
          drugAllergy: d.drugAllergy,
          foodAllergy: d.foodAllergy,
          carePlanGoal: d.carePlanGoal,
          codeStatus: d.codeStatus,
          physicalExam: d.physicalExam,
        })),

      addMedication: (id, draft) => {
        if (!draft.name) return;
        const usage = [draft.dose, draft.route, draft.freq].filter(Boolean).join(" · ");
        mutate(id, "addMedication", (p) => ({
          ...p,
          medications: [
            ...p.medications,
            { id: "m" + Date.now(), name: draft.name, dose: draft.dose, route: draft.route, freq: draft.freq, prescriber: "แพทย์เจ้าของไข้" },
          ],
          medChangeLog: [
            { date: today(), changeType: "เพิ่มยาใหม่", drugName: draft.name, usage, reason: draft.reason || "-", signer: draft.signer || "-" },
            ...p.medChangeLog,
          ],
        }));
      },

      editMedication: (id, medId, d) => {
        mutate(id, "editMedication", (p) => {
          const med = p.medications.find((m) => m.id === medId);
          if (!med) return p;
          const usage = [d.dose, d.route, d.freq].filter(Boolean).join(" · ");
          return {
            ...p,
            medications: p.medications.map((m) => (m.id === medId ? { ...m, dose: d.dose, route: d.route, freq: d.freq } : m)),
            medChangeLog: [
              { date: today(), changeType: "ปรับยา", drugName: med.name, usage, reason: d.reason || "-", signer: d.signer || "-" },
              ...p.medChangeLog,
            ],
          };
        });
      },

      removeMedication: (id, medId, d) => {
        mutate(id, "removeMedication", (p) => {
          const med = p.medications.find((m) => m.id === medId);
          if (!med) return p;
          const usage = [med.dose, med.route, med.freq].filter(Boolean).join(" · ");
          return {
            ...p,
            medications: p.medications.filter((m) => m.id !== medId),
            medChangeLog: [
              { date: today(), changeType: "หยุด/ลดยา", drugName: med.name, usage, reason: d.reason || "-", signer: d.signer || "-" },
              ...p.medChangeLog,
            ],
          };
        });
      },

      // Vitals live in their own table now — server stamps time, updates
      // lastVital/isAlert on the doc, and broadcasts to every device.
      addVital: async (id, f) => {
        if (!f.temp && !f.sys) return;
        await api.addVital(id, f);
      },

      dischargePatient: (id, info) => {
        if (!info.type) return;
        mutate(id, "discharge", (p) => ({
          ...p,
          status: "discharged",
          discharge: {
            date: info.date || today(),
            type: info.type,
            summary: info.summary || "-",
            plan: info.plan || "-",
            signer: info.signer || "-",
            archivedAt: new Date().toISOString(),
          },
        }));
      },

      // Replace the whole hospital-appointment list of one patient.
      saveAppointments: (id, appointments) => {
        mutate(id, "saveAppointments", (p) => ({ ...p, appointments }));
      },

      // Admin-only correction of the medication change history.
      adminEditLog: (id, newLog) => {
        mutate(id, "adminEditLog", (p) => ({ ...p, medChangeLog: newLog }));
      },

      readmitPatient: (id) => {
        mutate(id, "readmit", (p) => {
          const rest = { ...p };
          delete rest.discharge;
          return { ...rest, status: "active" };
        });
      },

      admitPatient: async (form) => {
        const newPatient = createPatient(form, Date.now());
        await api.admit(newPatient);
        setPatients((prev) => (prev.some((p) => p.id === newPatient.id) ? prev : [...prev, newPatient]));
        return newPatient.id;
      },

      moveBed: (id, newBed) => {
        if (!newBed) return;
        mutate(id, "moveBed", (p) => ({ ...p, bed: newBed }));
      },

      addBed: (roomId) => {
        setBedCounts((prev) => {
          const next = { ...prev, [roomId]: (prev[roomId] || 0) + 1 };
          api.saveBedCounts(next).catch(() => refetch());
          return next;
        });
      },

      removeBed: (roomId) => {
        setBedCounts((prev) => {
          const count = prev[roomId] || 0;
          if (count <= 0) return prev;
          const lastBed = bedId(roomId, count);
          const occupied = patientsRef.current.some((p) => p.status !== "discharged" && p.bed === lastBed);
          if (occupied) return prev;
          const next = { ...prev, [roomId]: count - 1 };
          api.saveBedCounts(next).catch(() => refetch());
          return next;
        });
      },
    };
  }, [mutate, refetch]);

  const value = useMemo(
    () => ({ patients, bedCounts, loading, error, wsStatus, refetch, subscribe, ...actions }),
    [patients, bedCounts, loading, error, wsStatus, refetch, subscribe, actions]
  );

  return <PatientsContext.Provider value={value}>{children}</PatientsContext.Provider>;
}

export function usePatients() {
  const ctx = useContext(PatientsContext);
  if (!ctx) throw new Error("usePatients must be used within PatientsProvider");
  return ctx;
}

export function usePatient(id) {
  const { patients } = usePatients();
  return patients.find((p) => p.id === id);
}
