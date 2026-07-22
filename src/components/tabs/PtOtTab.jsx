import { useState } from "react";
import { useNotes } from "../../hooks/useNotes";
import { useAuth } from "../../state/AuthContext";
import SignerSelect from "../SignerSelect";
import { PT_SIGNERS } from "../../data/constants";
import { todayISO } from "../../utils/format";

export default function PtOtTab({ patient, readOnly }) {
  const { isAdmin } = useAuth();
  const { notes, hasMore, total, loading, loadMore, addNote, updateNote, deleteNote } = useNotes(patient.id, "pt");
  const [text, setText] = useState("");
  const [noteDate, setNoteDate] = useState(todayISO());
  const [author, setAuthor] = useState(PT_SIGNERS[0]);
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
    setEditText(n.text || "");
    setEditDate(n.noteDate || todayISO());
  };
  const saveEdit = async (n) => {
    await updateNote(n.id, n.author, { text: editText.trim(), noteDate: editDate });
    setEditingId(null);
  };
  const remove = async (n) => {
    if (!window.confirm(`ลบ PT/OT Note วันที่ ${n.date}?`)) return;
    await deleteNote(n.id);
  };

  return (
    <>
      {!readOnly && (
      <div className="card print-hide">
        <div className="section-title">เพิ่มบันทึก PT/OT Note (Rehabilitation record)</div>
        <div className="form-stack-12">
          <div style={{ maxWidth: 220 }}>
            <span className="field-label">วันที่</span>
            <input className="input" type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
          </div>
          <div>
            <span className="field-label">Plan and Management</span>
            <textarea
              className="textarea"
              style={{ minHeight: 130 }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="พิมพ์บันทึกได้อิสระ"
            />
          </div>
          <div>
            <span className="field-label">ผู้บันทึก</span>
            <SignerSelect value={author} onChange={setAuthor} options={PT_SIGNERS} />
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
                {n.noteDate || n.date}
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
              <>
                {n.goal && n.goal !== "-" && (
                  <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>เป้าหมาย: {n.goal}</div>
                )}
                <div style={{ fontSize: 16, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.text}</div>
              </>
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
