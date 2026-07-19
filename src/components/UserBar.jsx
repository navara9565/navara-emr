import { useNavigate } from "react-router-dom";
import { useAuth, ROLE_LABELS } from "../state/AuthContext";

export default function UserBar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div className="userbar print-hide">
      <span className="userbar-chip" title={user.username}>
        👤 {user.name} · {ROLE_LABELS[user.role] || user.role}
      </span>
      {isAdmin && (
        <button className="userbar-btn" onClick={() => navigate("/users")}>⚙️ ผู้ใช้งาน</button>
      )}
      <button
        className="userbar-btn"
        onClick={async () => {
          await logout();
          navigate("/login");
        }}
      >
        ออกจากระบบ
      </button>
    </div>
  );
}
