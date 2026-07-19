import { useState } from "react";
import { useNotes } from "../../hooks/useNotes";
import { useAuth } from "../../state/AuthContext";

const EMPTY = { s: "", o: "", a: "", p: "" };

export default function DoctorNoteTab({ patient, readOnly }) {
  const { user, canDoctorNote, isAdmin } = useAuth();
  const { notes, hasMore, total, loading, loadMore, addNote, updateNote, deleteNote } = useNotes(patient.id, "doctor");
  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(EMPTY);
  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));
  const setE = (key) => (e) => setEditDraft((d) => ({ ...d, [key]: e.target.value }));

  const submit = async () => {
    if (!draft.s.trim() && !draft.a.trim()) return;
    await addNote(user?.name, { s: draft.s || "-", o: draft.o || "-", a: draft.a || "-", p: draft.p || "-" });
    setDraft(EMPTY);
  };

  const startEdit = (n) => {
    setEditingId(n.id);
    setEditDraft({ s: n.s, o: n.o, a: n.a, p: n.p });
  };
  const saveEdit = async (n) => {
    await updateNote(n.id, n.author, editDraft);
    setEditingId(null);
  };
  const remove = async (n) => {
    if (!window.confirm(`ลบ Doctor Note วันที่ ${n.date}?`)) return;
    await deleteNote(n.id);
  };

  return (
    <>
      {!readOnly && !canDoctorNote && (
        <div className="modal-note print-hide" style={{ marginBottom: 18 }}>
          🔒 เฉพาะแพทย์เท่านั้นที่เพิ่ม Doctor Note ได้ — บัญชีของคุณดูได้อย่างเดียวในหน้านี้
        </div>
      )}
      {!readOnly && canDoctorNote && (
      <div className="card print-hide">
        <div className="section-title">เพิ่ม Doctor Note (SOAP)</div>
        <div className="form-stack-12">
          <div>
            <span className="field-label">S: Subjective</span>
            <textarea className="textarea" style={{ minHeight: 56 }} value={draft.s} onChange={set("s")} />
          </div>
          <div>
            <span className="field-label">O: Objective (รวม V/S)</span>
            <textarea className="textarea" style={{ minHeight: 56 }} value={draft.o} onChange={set("o")} />
          </div>
          <div>
            <span className="field-label">A: Assessment</span>
            <textarea className="textarea" style={{ minHeight: 56 }} value={draft.a} onChange={set("a")} />
          </div>
          <div>
            <span className="field-label">P: Plan / Order</span>
            <textarea className="textarea" style={{ minHeight: 56 }} value={draft.p} onChange={set("p")} />
          </div>
          <button className="btn-primary" style={{ alignSelf: "flex-start" }} onClick={submit}>บันทึก</button>
        </div>
      </div>
      )}

      <div className="stacked-list">
        {loading && <div className="app-loading" style={{ padding: 20 }}>กำลังโหลด...</div>}
        {notes.map((n) => (
          <div key={n.id} className="note-card">
            <div className="note-head">
              <span>{n.author}</span>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {n.date}
                {isAdmin && (
                  <span className="note-admin-actions print-hide">
                    <button className="btn-link btn-link-primary" onClick={() => startEdit(n)}>แก้ไข</button>
                    <button className="btn-link btn-link-danger" onClick={() => remove(n)}>ลบ</button>
                  </span>
                )}
              </span>
            </div>
            {editingId === n.id ? (
              <div className="form-stack-sm print-hide">
                <div><span className="field-label-sm">S</span><textarea className="textarea" style={{ minHeight: 44 }} value={editDraft.s} onChange={setE("s")} /></div>
                <div><span className="field-label-sm">O</span><textarea className="textarea" style={{ minHeight: 44 }} value={editDraft.o} onChange={setE("o")} /></div>
                <div><span className="field-label-sm">A</span><textarea className="textarea" style={{ minHeight: 44 }} value={editDraft.a} onChange={setE("a")} /></div>
                <div><span className="field-label-sm">P</span><textarea className="textarea" style={{ minHeight: 44 }} value={editDraft.p} onChange={setE("p")} /></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-secondary-sm" onClick={() => setEditingId(null)}>ยกเลิก</button>
                  <button className="btn-primary-sm" onClick={() => saveEdit(n)}>บันทึกแก้ไข</button>
                </div>
              </div>
            ) : (
              <div className="note-body">
                <div><b>S:</b> {n.s}</div>
                <div><b>O:</b> {n.o}</div>
                <div><b>A:</b> {n.a}</div>
                <div><b>P:</b> {n.p}</div>
              </div>
            )}
          </div>
        ))}
        {hasMore && (
          <button className="btn btn-outline load-more print-hide" onClick={loadMore}>
            ดูเพิ่ม ({notes.length}/{total})
          </button>
        )}
      </div>
    </>
  );
}
