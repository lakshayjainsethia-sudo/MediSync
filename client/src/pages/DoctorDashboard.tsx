import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { appointmentsApi } from '../utils/api'
import { Appointment } from '../types'
import { Calendar, Clock, User as UserIcon, LogOut, Check, FileText, Pill } from 'lucide-react'
import Button from '../components/ui/Button'
import Card, { CardHeader, CardContent } from '../components/ui/Card'
import { format } from 'date-fns'
import { io } from 'socket.io-client'

export default function DoctorDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [diagnosis, setDiagnosis] = useState('')
  const [prescription, setPrescription] = useState('')
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [billingSummary, setBillingSummary] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  useEffect(() => {
    fetchAppointments()

    // Listen for emergencies
    const socket = io('http://localhost:5000', { withCredentials: true })
    socket.on('emergency_update', (data) => {
      toast.error(`🚨 EMERGENCY CONFIRMED: Patient ${data.patientName} has been pushed to the top of your queue!`, { autoClose: false })
      fetchAppointments()
    })

    socket.on('red_triage_alert', (data) => {
      // Play 440Hz beep for 0.3s
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = ctx.createOscillator()
        osc.connect(ctx.destination)
        osc.frequency.value = 440
        osc.start()
        setTimeout(() => osc.stop(), 300)
      } catch (e) { console.error('Audio play failed', e) }
      
      toast.error(`🚨 AI RED ALERT: Patient ${data.patientName} flagged as EMERGENCY! Reason: ${data.triage_reason}`, { autoClose: false })
      
      setAppointments(prev => {
        const existing = prev.find(a => a._id === data.appointmentId)
        if (existing) {
          const updated = prev.map(a => 
            a._id === data.appointmentId 
              ? { ...a, triage_tag: 'RED' as 'RED', weightedScore: data.weightedScore, pulse: true } 
              : a
          )
          return updated.sort((a: any, b: any) => {
            if (a.riskOverride && !b.riskOverride) return -1;
            if (!a.riskOverride && b.riskOverride) return 1;
            return (b.weightedScore || 0) - (a.weightedScore || 0);
          })
        }
        fetchAppointments()
        return prev
      })
    })

    socket.on('prescription_dispensed', (data) => {
      toast.info(`💊 Prescription dispensed for ${data.patientName}`, { autoClose: 4000 })
    })

    socket.on('vitals_updated', (data) => {
      toast.info(`📋 Vitals recorded for ${data.patientName} by Nurse ${data.nurseName}`, { autoClose: 5000 })
    })

    socket.on('triage_escalated', (data) => {
      toast.error(`🚨 EMERGENCY ESCALATION: Patient ${data.patientName} was escalated to RED by ${data.escalatedBy}. Reason: ${data.reason}`, { autoClose: 15000 })
      setAppointments(prev => {
        const updated = prev.map(a => 
          a._id === data.appointmentId 
            ? { ...a, triage_tag: 'RED' as 'RED', pulse: true } 
            : a
        )
        return updated.sort((a: any, b: any) => {
          if (a.riskOverride && !b.riskOverride) return -1;
          if (!a.riskOverride && b.riskOverride) return 1;
          return (b.weightedScore || 0) - (a.weightedScore || 0);
        })
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const fetchAppointments = async () => {
    try {
      const response = await appointmentsApi.getMine()
      setAppointments(response.data)
    } catch (error) {
      console.error('Failed to fetch appointments:', error)
    }
  }

  const handleEndConsultation = async () => {
    if (!selectedAppointment) return

    setLoading(true)
    try {
      await appointmentsApi.endConsultation(selectedAppointment._id, {
        diagnosis,
        prescription,
        clinicalNotes,
        billingSummary
      })
      
      setAppointments(prev => prev.filter(a => a._id !== selectedAppointment._id))
      toast.success('✓ Patient handed off to pharmacy successfully.', { autoClose: 4000 })
      
      setShowCompleteModal(false)
      setSelectedAppointment(null)
      setDiagnosis('')
      setPrescription('')
      setClinicalNotes('')
      setBillingSummary('')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to complete appointment')
    } finally {
      setLoading(false)
    }
  }

  const openCompleteModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setDiagnosis(appointment.diagnosis || '')
    setPrescription(appointment.prescription || '')
    setClinicalNotes((appointment as any).clinicalNotes || '')
    setBillingSummary((appointment as any).billingSummary || '')
    setShowCompleteModal(true)
  }

  const upcomingAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return aptDate >= today && apt.status === 'scheduled'
  }).sort((a: any, b: any) => {
    if (a.riskOverride && !b.riskOverride) return -1;
    if (!a.riskOverride && b.riskOverride) return 1;
    return (b.weightedScore || 0) - (a.weightedScore || 0);
  });

  const pastAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return aptDate < today || apt.status === 'completed' || apt.status === 'cancelled'
  })

  if (user && !user.isApproved) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Account Pending Approval</h2>
          <p className="text-slate-600 mb-6">
            Your doctor account is pending admin approval. You will be able to access the dashboard once approved.
          </p>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            Logout
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Doctor Dashboard</h1>
              <p className="text-sm text-slate-600 font-medium">Welcome, Dr. {user?.name}</p>
              {user?.specialization && (
                <p className="text-sm text-blue-600 font-semibold">{user.specialization}</p>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-slate-700 hover:bg-slate-100/50 rounded-lg transition-colors font-medium border border-transparent hover:border-slate-200"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium">Total Appointments</p>
                  <p className="text-2xl font-bold text-slate-900">{appointments.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium">Upcoming</p>
                  <p className="text-2xl font-bold text-blue-600">{upcomingAppointments.length}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium">Completed</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {appointments.filter(a => a.status === 'completed').length}
                  </p>
                </div>
                <Check className="h-8 w-8 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Appointments */}
        <Card className="mb-8">
          <CardHeader title="Upcoming Appointments" className="border-b border-slate-100" />
          <CardContent className="bg-white/60 backdrop-blur-xl">
            <div className="divide-y divide-slate-100">
              {upcomingAppointments.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>No upcoming appointments</p>
                </div>
              ) : (
                upcomingAppointments.map((apt) => {
                  const patient = typeof apt.patient === 'object' ? apt.patient : null
                  return (
                    <div key={apt._id} className={`py-5 hover:bg-slate-50/50 transition duration-150 rounded-xl ${(apt as any).pulse || apt.triage_tag === 'RED' ? 'emergency-pulse bg-red-50/50' : ''}`}>
                      <div className="flex justify-between items-start px-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <UserIcon className="h-5 w-5 text-blue-600" />
                            <h3 className="text-lg font-semibold text-slate-900">
                              {patient?.name || 'Unknown Patient'}
                            </h3>
                            {apt.triage_tag && (
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                apt.triage_tag === 'RED' ? 'bg-red-100 text-red-800 border border-red-200' :
                                apt.triage_tag === 'ORANGE' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                                'bg-green-100 text-green-800 border border-green-200'
                              }`}>
                                {apt.triage_tag}
                              </span>
                            )}
                            {apt.riskOverride && (
                              <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-md font-bold uppercase tracking-wider shadow-sm animate-pulse">
                                Receptionist Override
                              </span>
                            )}
                          </div>
                          {apt.riskOverride && apt.riskOverrideReason && (
                            <div className="ml-8 mb-2">
                              <p className="text-xs text-red-600 font-semibold bg-red-50 inline-block px-2 py-1 rounded border border-red-100">
                                Override Reason: {apt.riskOverrideReason}
                              </p>
                            </div>
                          )}
                          <div className="flex items-center space-x-4 text-sm text-slate-600 ml-8">
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              <span>{format(new Date(apt.date), 'MMM dd, yyyy')}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4 text-slate-400" />
                              <span>{apt.startTime} - {apt.endTime}</span>
                            </div>
                            {patient?.email && (
                              <span className="text-slate-400">{patient.email}</span>
                            )}
                          </div>
                          {apt.symptoms && apt.symptoms.length > 0 && (
                            <div className="mt-3 ml-8">
                              <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                                <span className="font-semibold px-1">Symptoms:</span> {Array.isArray(apt.symptoms) ? apt.symptoms.join(', ') : apt.symptoms}
                              </p>
                            </div>
                          )}
                          {apt.notes && (
                            <div className="mt-2 ml-8">
                              <p className="text-sm text-slate-600 italic">
                                <span className="font-medium not-italic">Notes:</span> {apt.notes}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              const patient = typeof apt.patient === 'object' ? apt.patient : null
                              navigate('/medical-records', { state: { createForAppointment: apt._id, patientId: patient?._id } })
                            }}
                            variant="outline"
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Record
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              navigate(`/doctor/consultation/${apt._id}`)
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                          >
                            <Pill className="h-4 w-4 mr-1" />
                            Consult
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Past Appointments */}
        <Card>
          <CardHeader title="Past Appointments" />
          <CardContent>
          <div className="divide-y divide-gray-200">
            {pastAppointments.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <p>No past appointments</p>
              </div>
            ) : (
              pastAppointments.map((apt) => {
                const patient = typeof apt.patient === 'object' ? apt.patient : null
                return (
                  <div key={apt._id} className="py-4 hover:bg-slate-50">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <UserIcon className="h-5 w-5 text-primary-600" />
                        <h3 className="text-lg font-semibold text-slate-900">
                          {patient?.name || 'Unknown Patient'}
                        </h3>
                        <span className={`px-2 py-1 rounded text-xs ${
                          apt.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {apt.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-slate-600 ml-8 mb-2">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{format(new Date(apt.date), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>{apt.startTime} - {apt.endTime}</span>
                        </div>
                      </div>
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
                  </div>
                )
              })
            )}
          </div>
          </CardContent>
        </Card>
      </div>

      {/* Complete Appointment Modal */}
      {showCompleteModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-slate-900">Complete Consultation</h2>
            </div>
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-bold text-red-700 mb-2">Clinical Notes (Private)</label>
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-red-300 bg-red-50 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Private doctor notes..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Billing & Pharmacy Summary (Shared)</label>
                <textarea
                  value={billingSummary}
                  onChange={(e) => setBillingSummary(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-blue-300 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Summary for receptionist and pharmacy..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosis</label>
                <textarea
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter diagnosis..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prescription</label>
                <textarea
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter prescription..."
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowCompleteModal(false)
                    setSelectedAppointment(null)
                    setDiagnosis('')
                    setPrescription('')
                    setClinicalNotes('')
                    setBillingSummary('')
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndConsultation}
                  disabled={loading}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Complete Appointment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

