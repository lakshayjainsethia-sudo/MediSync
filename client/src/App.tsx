import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import Header from './components/layout/Header'
import Login from './pages/Login'
import Register from './pages/Register'
import PatientDashboard from './pages/PatientDashboard'
import DoctorDashboard from './pages/DoctorDashboard'
import ConsultationView from './pages/doctor/ConsultationView'
import StaffDashboard from './pages/StaffDashboard'
import ReceptionistDashboard from './pages/ReceptionistDashboard'
import AdminDashboard from './pages/AdminDashboard'
import AdminUsers from './pages/AdminUsers'
import Home from './pages/Home'
import MedicalRecords from './pages/MedicalRecords'
import Prescriptions from './pages/Prescriptions'
import BillingList from './pages/billing/BillingList'
import BillDetail from './pages/billing/BillDetail'
import Departments from './pages/Departments'
import Profile from './pages/Profile'
import Doctors from './pages/Doctors'
import Appointments from './pages/Appointments'
import Lobby from './pages/Lobby'
import TriageQueue from './pages/TriageQueue'
import PharmacistDashboard from './pages/pharmacist/PharmacistDashboard'
import Dispensary from './pages/pharmacist/Dispensary'

const STAFF_ROLES = ['nurse'] as const

interface PrivateRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

function PrivateRoute({ children, allowedRoles }: PrivateRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/login" element={user ? <Navigate to={`/${user.role}/dashboard`} replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={`/${user.role}/dashboard`} replace /> : <Register />} />
      <Route
        path="/patient/dashboard"
        element={
          <PrivateRoute allowedRoles={['patient']}>
            <PatientDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/doctor/dashboard"
        element={
          <PrivateRoute allowedRoles={['doctor']}>
            <DoctorDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/doctor/consultation/:appointmentId"
        element={
          <PrivateRoute allowedRoles={['doctor']}>
            <ConsultationView />
          </PrivateRoute>
        }
      />
      {STAFF_ROLES.map(role => (
        <Route
          key={role}
          path={`/${role}/dashboard`}
          element={
            <PrivateRoute allowedRoles={[role]}>
              <StaffDashboard />
            </PrivateRoute>
          }
        />
      ))}
      <Route
        path="/receptionist/dashboard"
        element={
          <PrivateRoute allowedRoles={['receptionist']}>
            <ReceptionistDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/pharmacist/dashboard"
        element={
          <PrivateRoute allowedRoles={['pharmacist']}>
            <PharmacistDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/pharmacist/dispensary"
        element={
          <PrivateRoute allowedRoles={['pharmacist']}>
            <Dispensary />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <PrivateRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <PrivateRoute allowedRoles={['admin']}>
            <AdminUsers />
          </PrivateRoute>
        }
      />
      <Route
        path="/medical-records"
        element={
          <PrivateRoute>
            <MedicalRecords />
          </PrivateRoute>
        }
      />
      <Route
        path="/prescriptions"
        element={
          <PrivateRoute>
            <Prescriptions />
          </PrivateRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <PrivateRoute allowedRoles={['admin', 'receptionist']}>
            <BillingList />
          </PrivateRoute>
        }
      />
      <Route
        path="/billing/:id"
        element={
          <PrivateRoute allowedRoles={['admin', 'receptionist']}>
            <BillDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/departments"
        element={<Departments />}
      />
      <Route
        path="/doctors"
        element={<Doctors />}
      />
      <Route
        path="/appointments"
        element={
          <PrivateRoute>
            <Appointments />
          </PrivateRoute>
        }
      />
      <Route
        path="/triage"
        element={
          <PrivateRoute allowedRoles={['receptionist', 'admin', 'nurse']}>
            <TriageQueue />
          </PrivateRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <div className="min-h-screen bg-gray-50">
            <Header />
            <AppRoutes />
          </div>
          <ToastContainer position="top-right" autoClose={3000} />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  )
}

export default App

