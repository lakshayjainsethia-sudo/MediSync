import axios from 'axios'
import { toast } from 'react-toastify'
import { RegisterableRole } from '../types'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    const message = error.response?.data?.message || error.message || 'An error occurred'
    if (error.response?.status !== 401) {
      toast.error(message)
    }
    return Promise.reject(error)
  }
)

export default api

// API endpoints
export const authApi = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  register: (data: { name: string; email: string; password: string; role: RegisterableRole }) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

export const doctorsApi = {
  getAll: () => api.get('/doctors'),
  getById: (id: string) => api.get(`/doctors/${id}`),
  getMyAppointments: () => api.get('/doctors/me/appointments'),
  updateProfile: (data: any) => api.put('/doctors/me', data),
}

export const patientsApi = {
  getProfile: () => api.get('/patients/me'),
  updateProfile: (data: any) => api.put('/patients/me', data),
  getAppointments: () => api.get('/patients/me/appointments'),
  getUpcomingAppointments: () => api.get('/patients/me/appointments/upcoming'),
  getPastAppointments: () => api.get('/patients/me/appointments/past'),
  getMedicalHistory: () => api.get('/patients/me/medical-history'),
  updatePassword: (data: { currentPassword: string; newPassword: string }) => api.post('/patients/me/update-password', data),
}

export const appointmentsApi = {
  create: (data: any) => api.post('/appointments', data),
  getAll: () => api.get('/appointments'),
  getMine: () => api.get('/appointments/me'),
  cancel: (id: string) => api.put(`/appointments/${id}/cancel`),
  complete: (id: string, data: { diagnosis?: string; prescription?: string }) => api.put(`/appointments/${id}/complete`, data),
  endConsultation: (id: string, data: { diagnosis?: string; prescription?: string; clinicalNotes?: string; billingSummary?: string }) => api.put(`/appointments/${id}/end-consultation`, data),
  completeReview: (id: string, data: { status: 'completed'; billingSummary?: string }) => api.put(`/appointments/${id}/complete-review`, data),
  getAvailableSlots: (doctorId: string, date: string) => api.get(`/appointments/available-slots?doctorId=${doctorId}&date=${date}`),
}

export const medicalRecordsApi = {
  create: (data: any) => api.post('/medical-records', data),
  getMine: () => api.get('/medical-records/me'),
  getByPatient: (patientId: string) => api.get(`/medical-records/patient/${patientId}`),
  getById: (id: string) => api.get(`/medical-records/${id}`),
  update: (id: string, data: any) => api.put(`/medical-records/${id}`, data),
  delete: (id: string) => api.delete(`/medical-records/${id}`),
}

export const prescriptionsApi = {
  create: (data: any) => api.post('/prescriptions', data),
  getMine: () => api.get('/prescriptions/me'),
  getByPatient: (patientId: string) => api.get(`/prescriptions/patient/${patientId}`),
  getById: (id: string) => api.get(`/prescriptions/${id}`),
  update: (id: string, data: any) => api.put(`/prescriptions/${id}`, data),
}

export const billingApi = {
  create: (data: any) => api.post('/billing', data),
  generateFinal: (data: { appointmentId: string; additionalCharges?: any[] }) => api.post('/billing/generate-final', data),
  getMine: () => api.get('/billing/me'),
  getByPatient: (patientId: string) => api.get(`/billing/patient/${patientId}`),
  getById: (id: string) => api.get(`/billing/${id}`),
  recordPayment: (id: string, data: any) => api.put(`/billing/${id}/payment`, data),
  update: (id: string, data: any) => api.put(`/billing/${id}`, data),
}

export const notificationsApi = {
  getAll: (params?: { read?: boolean; type?: string; limit?: number }) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread'),
  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
}

export const adminApi = {
  getAnalytics: () => api.get('/admin/analytics'),
  getPendingDoctors: () => api.get('/admin/doctors/pending'),
  approveDoctor: (id: string) => api.put(`/admin/doctors/${id}/approve`),
  updateDoctor: (id: string, data: any) => api.patch(`/admin/doctors/${id}`, data),
  approveUser: (id: string) => api.put(`/admin/users/${id}/approve`),
  deleteDoctor: (id: string) => api.delete(`/admin/doctors/${id}`),

  getAllUsers: (page = 1, limit = 50) => api.get(`/admin/users?page=${page}&limit=${limit}`),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
}

export const departmentsApi = {
  getAll: () => api.get('/departments'),
  getById: (id: string) => api.get(`/departments/${id}`),
  create: (data: any) => api.post('/departments', data),
}

export const equipmentApi = {
  getAll: (params?: { unit?: string; status?: string; department?: string }) => api.get('/equipment', { params }),

  getById: (id: string) => api.get(`/equipment/${id}`),
  create: (data: any) => api.post('/equipment', data),
  update: (id: string, data: any) => api.patch(`/equipment/${id}`, data),
  addLog: (id: string, data: any) => api.post(`/equipment/${id}/maintenance-log`, data),
}

export const aiApi = {
  predictMaintenance: (id: string) => api.get(`/ai/predict-maintenance/${id}`),
  analyzePrescription: (data: any) => api.post('/ai/analyze-prescription', data),
  suggestSymptoms: (query: string) => api.get(`/ai/symptom-suggest?q=${encodeURIComponent(query)}`)
}

export const pharmacistApi = {
  getOverview: () => api.get('/pharmacist/overview'),
  getPendingPrescriptions: () => api.get('/pharmacist/prescriptions/pending'),
  dispensePrescription: (id: string, data: { medicinesToDispense: any[] }) => api.patch(`/pharmacist/prescriptions/${id}/dispense`, data),
  noMedicineHandoff: (id: string) => api.patch(`/pharmacist/prescriptions/${id}/no-medicine`),
  getLowStockMedicines: (threshold?: number) => api.get('/pharmacist/medicines/low-stock', { params: { threshold } }),
  searchMedicines: (q: string) => api.get(`/pharmacist/medicine/search?q=${encodeURIComponent(q)}`)
}
export const receptionistApi = {
  getBillingQueue: () => api.get('/receptionist/billing-queue')
}
