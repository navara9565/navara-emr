import { SIGNERS } from "../data/constants";

// Dropdown of the facility's regular staff names + อื่นๆ (free text).
// Controlled by a plain string: known names map to the select, anything
// else switches the select to อื่นๆ with the text shown in the input.
export default function SignerSelect({ value, onChange, small, options = SIGNERS }) {
  const known = options.includes(value);
  const cls = small ? "input-sm" : "input";

  return (
    <div className="signer-select">
      <select
        className={cls}
        value={known ? value : "อื่นๆ"}
        onChange={(e) => onChange(e.target.value === "อื่นๆ" ? "" : e.target.value)}
      >
        {options.map((s) => <option key={s} value={s}>{s}</option>)}
        <option value="อื่นๆ">อื่นๆ</option>
      </select>
      {!known && (
        <input
          className={cls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ระบุชื่อผู้บันทึก"
        />
      )}
    </div>
  );
}
