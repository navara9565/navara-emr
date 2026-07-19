import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { usePatients } from "../state/PatientsContext";

const PAGE = 20;

// Paginated notes of one kind for one patient, newest first.
export function useNotes(patientId, kind) {
  const { subscribe } = usePatients();
  const [notes, setNotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const loadFirstPage = () =>
      api.listNotes(patientId, kind, PAGE, 0).then((d) => {
        if (live) {
          setNotes(d.notes);
          setTotal(d.total);
          setLoading(false);
        }
      }).catch(() => live && setLoading(false));

    setLoading(true);
    loadFirstPage();

    const unsub = subscribe((msg) => {
      if (msg.type === "note" && msg.patientId === patientId && msg.kind === kind && msg.note) {
        setNotes((prev) => (prev.some((n) => n.id === msg.note.id) ? prev : [msg.note, ...prev]));
        setTotal((t) => t + 1);
      } else if (msg.type === "note-updated" && msg.patientId === patientId && msg.kind === kind && msg.note) {
        setNotes((prev) => prev.map((n) => (n.id === msg.note.id ? msg.note : n)));
      } else if (msg.type === "note-deleted" && msg.patientId === patientId && msg.kind === kind) {
        setNotes((prev) => prev.filter((n) => n.id !== msg.noteId));
        setTotal((t) => Math.max(0, t - 1));
      } else if (msg.type === "refresh") {
        loadFirstPage(); // demo-mode cross-tab sync
      }
    });
    return () => {
      live = false;
      unsub();
    };
  }, [patientId, kind, subscribe]);

  const loadMore = useCallback(async () => {
    const d = await api.listNotes(patientId, kind, PAGE, notes.length);
    setNotes((prev) => {
      const seen = new Set(prev.map((n) => n.id));
      return [...prev, ...d.notes.filter((n) => !seen.has(n.id))];
    });
    setTotal(d.total);
  }, [patientId, kind, notes.length]);

  const addNote = useCallback(
    async (author, payload) => {
      const d = await api.addNote(patientId, kind, author, payload);
      // Prepend immediately; the WS echo is deduped by id.
      setNotes((prev) => (prev.some((n) => n.id === d.note.id) ? prev : [d.note, ...prev]));
      setTotal((t) => t + 1);
    },
    [patientId, kind]
  );

  // Admin corrections to saved notes.
  const updateNote = useCallback(
    async (noteId, author, payload) => {
      const d = await api.updateNote(patientId, noteId, author, payload);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? d.note : n)));
    },
    [patientId]
  );

  const deleteNote = useCallback(
    async (noteId) => {
      await api.deleteNote(patientId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setTotal((t) => Math.max(0, t - 1));
    },
    [patientId]
  );

  return { notes, total, hasMore: notes.length < total, loading, loadMore, addNote, updateNote, deleteNote };
}
