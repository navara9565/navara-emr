import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { LogoImg, LogoFull } from "../components/Logo";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const from = new URLSearchParams(location.search).get("from") || "/";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <LogoImg height={150} fallback={<LogoFull width={240} />} />
        </div>
        <div className="login-title">ณวรา ศูนย์ดูแลผู้สูงอายุและฟื้นฟูสมรรถภาพ</div>
        <div className="login-sub">ระบบเวชระเบียนออนไลน์ · เข้าสู่ระบบ</div>

        <div className="scan-field">
          <span className="field-label">ชื่อผู้ใช้</span>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </div>
        <div className="scan-field">
          <span className="field-label">รหัสผ่าน</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && <div className="admit-error" style={{ marginBottom: 0 }}>{error}</div>}

        <button className="btn-primary scan-submit" disabled={busy} type="submit">
          {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>

        <div className="login-hint">
          บัญชีเริ่มต้น: admin · doctor1 · nurse1
          <br />
          (รหัสผ่าน: ชื่อผู้ใช้ตามด้วย 1234 — ควรเปลี่ยนหลังใช้งานครั้งแรก)
        </div>
      </form>
    </div>
  );
}
