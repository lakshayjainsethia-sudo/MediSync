import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { appointmentsApi } from '../utils/api'
import { Appointment } from '../types'
import { Calendar, Clock, User as UserIcon, Check, X, FileText, Pill, Search } from 'lucide-react'
import Button from '../components/ui/Button'
import Card, { CardHeader, CardContent } from '../components/ui/Card'
import { format } from 'date-fns'

export default function Appointments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (user) {
      fetchAppointments()
    }
  }, [user])

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      let response;
      if (['admin', 'receptionist', 'pharmacist', 'nurse'].includes(user?.role || '')) {
        response = await appointmentsApi.getAll()
      } else {
        response = await appointmentsApi.getMine()
      }
      setAppointments(response.data)
    } catch (error: any) {
      console.error('Failed to fetch appointments:', error)
      toast.error('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return
    }

    try {
      await appointmentsApi.cancel(id)
      toast.success('Appointment cancelled successfully')
      fetchAppointments()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel appointment')
    }
  }

  const handleCreateRecord = (appointment: Appointment) => {
    const patient = typeof appointment.patient === 'object' ? appointment.patient : null
    navigate('/medical-records', { 
      state: { 
        createForAppointment: appointment._id, 
        patientId: patient?._id 
      } 
    })
  }

  const handleCreatePrescription = (appointment: Appointment) => {
    const patient = typeof appointment.patient === 'object' ? appointment.patient : null
    navigate('/prescriptions', { 
      state: { 
        createForAppointment: appointment._id, 
        patientId: patient?._id 
      } 
    })
  }

  const filteredAppointments = appointments.filter((apt) => {
    // Filter by status
    if (filter === 'upcoming') {
      const aptDate = new Date(apt.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (aptDate < today || apt.status === 'completed' || apt.status === 'cancelled') {
        return false
      }
    } else if (filter === 'past') {
      const aptDate = new Date(apt.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (aptDate >= today && apt.status === 'scheduled') {
        return false
      }
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const patient = typeof apt.patient === 'object' ? apt.patient : null
      const doctor = typeof apt.doctor === 'object' ? apt.doctor : null
      
      const matchesPatient = patient?.name?.toLowerCase().includes(searchLower)
      const matchesDoctor = doctor?.name?.toLowerCase().includes(searchLower)
      const matchesDate = format(new Date(apt.date), 'MMM dd, yyyy').toLowerCase().includes(searchLower)
      const matchesTime = apt.startTime?.toLowerCase().includes(searchLower)
      
      if (!matchesPatient && !matchesDoctor && !matchesDate && !matchesTime) {
        return false
      }
    }

    return true
  })

  const upcomingAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return aptDate >= today && apt.status === 'scheduled'
  })

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Please login to view appointments</p>
          <Button onClick={() => navigate('/login')}>Login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">My Appointments</h1>
          <p className="text-slate-600">
            {user.role === 'doctor' 
              ? 'Manage your patient appointments' 
              : 'View and manage your appointments'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Appointments</p>
                  <p className="text-2xl font-bold text-slate-900">{appointments.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-primary-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Upcoming</p>
                  <p className="text-2xl font-bold text-primary-600">{upcomingAppointments.length}</p>
                </div>
                <Clock className="h-8 w-8 text-primary-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {appointments.filter(a => a.status === 'completed').length}
                  </p>
                </div>
                <Check className="h-8 w-8 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Filter Buttons */}
              <div className="flex gap-2">
                <Button
                  variant={filter === 'all' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'upcoming' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('upcoming')}
                >
                  Upcoming
                </Button>
                <Button
                  variant={filter === 'past' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('past')}
                >
                  Past
                </Button>
              </div>

              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by patient, doctor, date, or time..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card>
          <CardHeader title="Appointments" />
          <CardContent>
            {loading ? (
              <div className="py-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-slate-600">Loading appointments...</p>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No appointments found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredAppointments.map((apt) => {
                  const patient = typeof apt.patient === 'object' ? apt.patient : null
                  const doctor = typeof apt.doctor === 'object' ? apt.doctor : null
                  
                  return (
                    <div key={apt._id} className="py-6 hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            {user.role === 'doctor' ? (
                              <UserIcon className="h-5 w-5 text-primary-600" />
                            ) : (
                              <UserIcon className="h-5 w-5 text-primary-600" />
                            )}
                            <h3 className="text-lg font-semibold text-slate-900">
                              {user.role === 'doctor' 
                                ? (patient?.name || 'Unknown Patient')
                                : (doctor?.name || 'Unknown Doctor')}
                            </h3>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              apt.status === 'completed' ? 'bg-green-100 text-green-800' :
                              apt.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              apt.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {apt.status}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 ml-8">
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4" />
                              <span>{format(new Date(apt.date), 'MMM dd, yyyy')}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>{apt.startTime} - {apt.endTime}</span>
                            </div>
                            {user.role === 'doctor' && patient?.email && (
                              <span className="text-gray-500">{patient.email}</span>
                            )}
                            {user.role === 'patient' && doctor?.specialization && (
                              <span className="text-gray-500">{doctor.specialization}</span>
                            )}
                          </div>

                          {apt.symptoms && apt.symptoms.length > 0 && (
                            <div className="mt-2 ml-8">
                              <p className="text-sm text-slate-600">
                                <span className="font-medium">Symptoms:</span> {Array.isArray(apt.symptoms) ? apt.symptoms.join(', ') : apt.symptoms}
                              </p>
                            </div>
                          )}

                          {apt.notes && (
                            <div className="mt-2 ml-8">
                              <p className="text-sm text-slate-600">
                                <span className="font-medium">Notes:</span> {apt.notes}
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

                          {apt.prescription && (
                            <div className="mt-2 ml-8">
                              <p className="text-sm text-slate-600">
                                <span className="font-medium">Prescription:</span> {apt.prescription}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                          {user.role === 'doctor' && apt.status === 'scheduled' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCreateRecord(apt)}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Record
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCreatePrescription(apt)}
                              >
                                <Pill className="h-4 w-4 mr-1" />
                                Prescribe
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => navigate('/doctor/dashboard')}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Complete
                              </Button>
                            </>
                          )}
                          {user.role === 'patient' && apt.status === 'scheduled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancel(apt._id)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

