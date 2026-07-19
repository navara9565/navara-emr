import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { usePatients } from "../state/PatientsContext";

// Windowed vitals for one patient. days: 7 | 30 | 90 | 0 (= all history).
export function useVitals(patientId, days) {
  const { subscribe } = usePatients();
  const [vitals, setVitals] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    let live = true;
    api.listVitals(patientId, days).then((d) => {
      if (live) {
        setVitals(d.vitals);
        setLoading(false);
      }
    }).catch(() => live && setLoading(false));
    return () => { live = false; };
  }, [patientId, days]);

  useEffect(() => {
    setLoading(true);
    const cancel = refetch();
    const unsub = subscribe((msg) => {
      if (msg.type === "vital" && msg.patientId === patientId && msg.vital) {
        setVitals((prev) => (prev.some((v) => v.id === msg.vital.id) ? prev : [...prev, msg.vital]));
      } else if (msg.type === "vital-updated" && msg.patientId === patientId && msg.vital) {
        setVitals((prev) => prev.map((v) => (v.id === msg.vital.id ? msg.vital : v)));
      } else if (msg.type === "vital-deleted" && msg.patientId === patientId) {
        setVitals((prev) => prev.filter((v) => v.id !== msg.vitalId));
      } else if (msg.type === "refresh") {
        refetch();
      }
    });
    return () => {
      cancel();
      unsub();
    };
  }, [patientId, days, refetch, subscribe]);

  // Admin corrections to saved rows.
  const updateVital = useCallback(
    async (vid, payload) => {
      const d = await api.updateVital(patientId, vid, payload);
      setVitals((prev) => prev.map((v) => (v.id === vid ? d.vital : v)));
    },
    [patientId]
  );

  const deleteVital = useCallback(
    async (vid) => {
      await api.deleteVital(patientId, vid);
      setVitals((prev) => prev.filter((v) => v.id !== vid));
    },
    [patientId]
  );

  return { vitals, loading, updateVital, deleteVital };
}

// Monthly aggregate summary (for long stays).
export function useVitalsSummary(patientId) {
  const { subscribe } = usePatients();
  const [months, setMonths] = useState([]);

  useEffect(() => {
    let live = true;
    const load = () => api.vitalsSummary(patientId).then((d) => live && setMonths(d.months)).catch(() => {});
    load();
    const unsub = subscribe((msg) => {
      const mine = ["vital", "vital-updated", "vital-deleted"].includes(msg.type) && msg.patientId === patientId;
      if (mine || msg.type === "refresh") load();
    });
    return () => {
      live = false;
      unsub();
    };
  }, [patientId, subscribe]);

  return months;
}
