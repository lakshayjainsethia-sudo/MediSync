import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { appointmentsApi } from '../utils/api'
import { Appointment } from '../types'
import { Calendar, Clock, User as UserIcon, Plus, X, FileText, Pill, Check } from 'lucide-react'
import Button from '../components/ui/Button'
import { format } from 'date-fns'
import AppointmentForm from '../components/appointments/AppointmentForm'

export default function PatientDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [showBookingModal, setShowBookingModal] = useState(false)

  useEffect(() => {
    fetchAppointments()
  }, [])

  const fetchAppointments = async () => {
    try {
      const response = await appointmentsApi.getMine()
      setAppointments(response.data)
    } catch (error) {
      console.error('Failed to fetch appointments:', error)
    }
  }

  const handleCancelAppointment = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return

    try {
      await appointmentsApi.cancel(id)
      toast.success('Appointment cancelled')
      fetchAppointments()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel appointment')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Patient Dashboard</h1>
          <p className="text-slate-600 mt-1">Welcome, {user?.name}</p>
        </div>
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Button
            onClick={() => setShowBookingModal(true)}
            className="w-full"
          >
            <Plus className="h-5 w-5 mr-2" />
            Book Appointment
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/doctors')}
            className="w-full"
          >
            <UserIcon className="h-5 w-5 mr-2" />
            Browse Doctors
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/medical-records')}
            className="w-full"
          >
            <FileText className="h-5 w-5 mr-2" />
            Medical Records
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/prescriptions')}
            className="w-full"
          >
            <Pill className="h-5 w-5 mr-2" />
            Prescriptions
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Appointments</p>
                <p className="text-2xl font-bold text-slate-900">{appointments.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-primary-600 opacity-20" />
            </div>
          </div>
          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Upcoming</p>
                <p className="text-2xl font-bold text-primary-600">
                  {appointments.filter(a => a.status === 'scheduled' && new Date(a.date) >= new Date()).length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-primary-600 opacity-20" />
            </div>
          </div>
          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {appointments.filter(a => a.status === 'completed').length}
                </p>
              </div>
              <Check className="h-8 w-8 text-green-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Appointments List */}
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-slate-900">My Appointments</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {appointments.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No appointments yet. Book your first appointment!</p>
              </div>
            ) : (
              appointments.map((apt) => {
                const doctor = typeof apt.doctor === 'object' ? apt.doctor : null
                return (
                  <div key={apt._id} className="py-4 hover:bg-slate-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <UserIcon className="h-5 w-5 text-primary-600" />
                          <h3 className="text-lg font-semibold text-slate-900">
                            Dr. {doctor?.name || 'Unknown'}
                          </h3>
                          {doctor?.specialization && (
                            <span className="px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded">
                              {doctor.specialization}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-slate-600 ml-8">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(apt.date), 'MMM dd, yyyy')}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{apt.startTime} - {apt.endTime}</span>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            apt.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                            apt.status === 'completed' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {apt.status}
                          </span>
                        </div>
                        {apt.symptoms && apt.symptoms.length > 0 && (
                          <div className="mt-2 ml-8">
                            <p className="text-sm text-slate-600">
                              <span className="font-medium">Symptoms:</span> {Array.isArray(apt.symptoms) ? apt.symptoms.join(', ') : apt.symptoms}
                            </p>
                          </div>
                        )}
                        {apt.diagnosis && (
                          <div className="mt-2 ml-8">
                            <p className="text-sm text-slate-600">
                              <span className="font-medium">Diagnosis:</span> {apt.diagnosis}
                            </p>
                          </div>
                        )}
                      </div>
                      {(apt.status === 'scheduled' || apt.status === 'Confirmed') && (
                        <button
                          onClick={() => handleCancelAppointment(apt._id)}
                          className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
               <h2 className="text-xl font-semibold text-slate-900">Book Appointment</h2>
               <button
                 onClick={() => setShowBookingModal(false)}
                 className="text-gray-400 hover:text-slate-600"
               >
                 <X className="h-6 w-6" />
               </button>
            </div>
            <div className="px-6 py-6 border-b border-gray-200">
               <AppointmentForm 
                  onSuccess={() => {
                     setShowBookingModal(false)
                     fetchAppointments()
                  }} 
                  onCancel={() => setShowBookingModal(false)} 
               />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

