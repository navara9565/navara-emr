import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { api, getToken, setToken } from "../api";

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  admin: "ผู้ดูแลระบบ",
  doctor: "แพทย์",
  nurse: "พยาบาล",
  pt: "นักกายภาพบำบัด",
  ot: "นักกิจกรรมบำบัด",
  caregiver: "ผู้ดูแลผู้ป่วย",
  viewer: "อื่นๆ (ดูอย่างเดียว)",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));

  // Restore session on load.
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => setToken(""))
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const d = await api.login(username, password);
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // token may already be invalid — clear locally anyway
    }
    setToken("");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      checking,
      login,
      logout,
      // สิทธิ์บันทึกทั่วไป (ประวัติ ยา nurse note จำหน่าย ฯลฯ)
      canWrite: ["nurse", "doctor", "admin"].includes(user?.role),
      // สิทธิ์บันทึก Vital Signs (รวมสแกน QR ปลายเตียง)
      canVitals: ["nurse", "doctor", "admin", "pt", "ot", "caregiver"].includes(user?.role),
      // สิทธิ์บันทึก PT/OT Note
      canPtNote: ["nurse", "doctor", "admin", "pt", "ot"].includes(user?.role),
      // สิทธิ์บันทึกแบบประเมิน ADL / Fall (รวมนักกายภาพ/กิจกรรมบำบัด)
      canAssess: ["nurse", "doctor", "admin", "pt", "ot"].includes(user?.role),
      canDoctorNote: ["doctor", "admin"].includes(user?.role),
      isAdmin: user?.role === "admin",
    }),
    [user, checking, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
