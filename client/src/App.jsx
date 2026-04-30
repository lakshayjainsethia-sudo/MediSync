import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';

// Placeholder Pages
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import AdminDashboard from './pages/admin/AdminDashboard';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import PatientDashboard from './pages/patient/PatientDashboard';
import NotFound from './pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected Routes bounded by MainLayout */}
          <Route element={<MainLayout />}>
            
            {/* Admin Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              {/* Other admin routes: /admin/users, /admin/billing */}
            </Route>

            {/* Doctor Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={['Doctor']} />}>
              <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
              {/* Other doctor routes: /doctor/patients, /doctor/calendar */}
            </Route>

            {/* Patient Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={['Patient']} />}>
              <Route path="/patient/dashboard" element={<PatientDashboard />} />
              {/* Other patient routes: /patient/appointments, /patient/records */}
            </Route>

            {/* Redirect root to dashboard based on role (could be handled in an index redirect component) */}
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Route>

          {/* Catch All */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
