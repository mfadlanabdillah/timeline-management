import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminProjectView } from './pages/AdminProjectView';
import { GuestLanding } from './pages/GuestLanding';
import { GuestProjectView } from './pages/GuestProjectView';
import { LoginPage } from './pages/LoginPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<GuestLanding />} />
      <Route path="/p/:code" element={<GuestProjectView />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/projects/:id"
        element={
          <ProtectedRoute>
            <AdminProjectView />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
