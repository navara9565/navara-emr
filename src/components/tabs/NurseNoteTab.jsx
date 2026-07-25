import { useState } from "react";
import { useNotes } from "../../hooks/useNotes";
import { useAuth } from "../../state/AuthContext";
import SignerSelect from "../SignerSelect";
import { todayISO } from "../../utils/format";

// Older nurse notes were structured; join them into text for display/editing.
function legacyText(n) {
  return [
    n.condition && n.condition !== "-" ? `อาการ: ${n.condition}` : "",
    n.meals && n.meals !== "-" ? `อาหาร: ${n.meals}` : "",
    n.urination && n.urination !== "-" ? `ขับถ่าย: ${n.urination}` : "",
    n.wound && n.wound !== "ไม่มี" ? `แผล: ${n.wound}` : "",
    n.note && n.note !== "-" ? `หมายเหตุ: ${n.note}` : "",
  ].filter(Boolean).join("\n");
}

const noteText = (n) => (n.text != null ? n.text : legacyText(n));

export default function NurseNoteTab({ patient, readOnly }) {
  const { user, canWrite } = useAuth();
  // Nurse notes can be corrected by anyone who can write them (nurse/doctor/admin),
  // not admins only — except on discharged records (readOnly).
  const canEdit = !readOnly && canWrite;
  const { notes, hasMore, total, loading, loadMore, addNote, updateNote, deleteNote } = useNotes(patient.id, "nurse");
  const [text, setText] = useState("");
  const [noteDate, setNoteDate] = useState(todayISO());
  const [author, setAuthor] = useState(user?.name || "");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editDate, setEditDate] = useState("");

  const submit = async () => {
    if (!text.trim()) return;
    await addNote(author, { text: text.trim(), noteDate });
    setText("");
    setNoteDate(todayISO());
  };

  const startEdit = (n) => {
    setEditingId(n.id);
    setEditText(noteText(n));
    setEditDate(n.noteDate || todayISO());
  };
  const saveEdit = async (n) => {
    await updateNote(n.id, n.author, { text: editText.trim(), noteDate: editDate });
    setEditingId(null);
  };
  const remove = async (n) => {
    if (!window.confirm(`ลบ Nurse Note วันที่ ${n.date}?`)) return;
    await deleteNote(n.id);
  };

  return (
    <>
      {!readOnly && (
      <div className="card print-hide">
        <div className="section-title">ลงรายงานประจำวัน (Nurse Note)</div>
        <div className="form-stack-12">
          <div style={{ maxWidth: 220 }}>
            <span className="field-label">วันที่</span>
            <input className="input" type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
          </div>
          <div>
            <span className="field-label">บันทึกอาการ / การดูแล</span>
            <textarea
              className="textarea"
              style={{ minHeight: 130 }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="พิมพ์บันทึกได้อิสระ เช่น อาการทั่วไป การรับประทานอาหาร การขับถ่าย แผล และการดูแลที่ให้"
            />
          </div>
          <div>
            <span className="field-label">ผู้บันทึก</span>
            <SignerSelect value={author} onChange={setAuthor} />
          </div>
          <button className="btn-primary" style={{ alignSelf: "flex-start" }} onClick={submit}>บันทึกรายงานวันนี้</button>
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
                {n.noteDate || n.date}
                {canEdit && (
                  <span className="note-admin-actions print-hide">
                    <button className="btn-link btn-link-primary" onClick={() => startEdit(n)}>แก้ไข</button>
                    <button className="btn-link btn-link-danger" onClick={() => remove(n)}>ลบ</button>
                  </span>
                )}
              </span>
            </div>
            {editingId === n.id ? (
              <div className="form-stack-sm print-hide">
                <div style={{ maxWidth: 200 }}>
                  <span className="field-label-sm">วันที่</span>
                  <input className="input-sm" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </div>
                <textarea className="textarea" style={{ minHeight: 110 }} value={editText} onChange={(e) => setEditText(e.target.value)} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-secondary-sm" onClick={() => setEditingId(null)}>ยกเลิก</button>
                  <button className="btn-primary-sm" onClick={() => saveEdit(n)}>บันทึกแก้ไข</button>
                </div>
              </div>
            ) : (
              <div className="note-body-loose" style={{ whiteSpace: "pre-wrap" }}>{noteText(n)}</div>
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
