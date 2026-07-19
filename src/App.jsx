import { HashRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { PatientsProvider } from "./state/PatientsContext";
import PatientListPage from "./pages/PatientListPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import AdmitPage from "./pages/AdmitPage";
import ScanVitalsPage from "./pages/ScanVitalsPage";
import BedCardPage from "./pages/BedCardPage";
import LoginPage from "./pages/LoginPage";
import UsersPage from "./pages/UsersPage";
import "./App.css";

function RedirectToCoverTab() {
  const { id } = useParams();
  return <Navigate to={`/patient/${id}/cover`} replace />;
}

// Wraps all data-backed pages: requires login, then loads patient data.
function Protected({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) {
    return <div className="app-loading">กำลังตรวจสอบสิทธิ์...</div>;
  }
  if (!user) {
    const from = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?from=${from}`} replace />;
  }
  return <PatientsProvider>{children}</PatientsProvider>;
}

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <div className="page">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Protected><PatientListPage /></Protected>} />
            <Route path="/admit" element={<Protected><AdmitPage /></Protected>} />
            <Route path="/users" element={<Protected><UsersPage /></Protected>} />
            <Route path="/scan/:id" element={<Protected><ScanVitalsPage /></Protected>} />
            <Route path="/bedcard/:id" element={<Protected><BedCardPage /></Protected>} />
            <Route path="/patient/:id" element={<Protected><RedirectToCoverTab /></Protected>} />
            <Route path="/patient/:id/:tab" element={<Protected><PatientDetailPage /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
