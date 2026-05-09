import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { appointmentsApi, doctorsApi } from '../utils/api'
import { Appointment, User } from '../types'
import { Calendar, Clock, User as UserIcon, Plus, X, FileText, Pill, Check, Star } from 'lucide-react'
import Button from '../components/ui/Button'
import { format } from 'date-fns'
import AppointmentForm from '../components/appointments/AppointmentForm'

export default function PatientDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [topDoctors, setTopDoctors] = useState<User[]>([])
  const [showBookingModal, setShowBookingModal] = useState(false)
  
  // Rating state
  const [ratingModal, setRatingModal] = useState<{ isOpen: boolean; appointmentId: string; doctorName: string }>({ isOpen: false, appointmentId: '', doctorName: '' })
  const [ratingScore, setRatingScore] = useState(5)
  const [ratingReview, setRatingReview] = useState('')
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)

  useEffect(() => {
    fetchAppointments()
    fetchTopDoctors()
  }, [])

  const fetchTopDoctors = async () => {
    try {
      const response = await doctorsApi.getTop()
      setTopDoctors(response.data)
    } catch (error) {
      console.error('Failed to fetch top doctors', error)
    }
  }

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

  const handleRateSubmit = async () => {
    if (!ratingModal.appointmentId) return
    try {
      setIsSubmittingRating(true)
      await appointmentsApi.rateAppointment(ratingModal.appointmentId, { rating: ratingScore, review: ratingReview })
      toast.success('Thank you for your feedback!')
      setRatingModal({ isOpen: false, appointmentId: '', doctorName: '' })
      setRatingScore(5)
      setRatingReview('')
      fetchAppointments()
      fetchTopDoctors()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit rating')
    } finally {
      setIsSubmittingRating(false)
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
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
                      <div key={apt._id} className="py-4 px-6 hover:bg-slate-50">
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
                            {apt.status === 'completed' && apt.rating && (
                              <div className="mt-2 ml-8 flex items-center text-sm text-amber-500">
                                <Star className="h-4 w-4 mr-1 fill-current" />
                                <span>You rated this visit {apt.rating}/5</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            {(apt.status === 'scheduled' || apt.status === 'Confirmed') && (
                              <button
                                onClick={() => handleCancelAppointment(apt._id)}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              >
                                Cancel
                              </button>
                            )}
                            {apt.status === 'completed' && !apt.rating && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRatingModal({ isOpen: true, appointmentId: apt._id, doctorName: doctor?.name || 'Doctor' })}
                              >
                                <Star className="h-4 w-4 mr-1" />
                                Rate
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
          
          {/* Top Doctors Panel */}
          <div className="lg:col-span-1">
            <div className="glass-card overflow-hidden sticky top-6">
              <div className="px-6 py-4 border-b border-gray-200 bg-amber-50/50">
                <div className="flex items-center space-x-2">
                  <Star className="h-5 w-5 text-amber-500 fill-current" />
                  <h2 className="text-xl font-semibold text-slate-900">Top Rated Doctors</h2>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {topDoctors.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    No ratings available yet.
                  </div>
                ) : (
                  topDoctors.map(doc => (
                    <div key={doc._id} className="p-4 hover:bg-slate-50 transition flex items-center justify-between cursor-pointer" onClick={() => navigate('/doctors')}>
                      <div>
                        <h3 className="font-semibold text-slate-900">Dr. {doc.name}</h3>
                        <p className="text-xs text-slate-500">{doc.specialization}</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center text-amber-500">
                          <Star className="h-4 w-4 fill-current" />
                          <span className="ml-1 font-bold">{doc.averageRating?.toFixed(1) || '5.0'}</span>
                        </div>
                        <span className="text-xs text-slate-400">{doc.totalRatings} reviews</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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

      {/* Rating Modal */}
      {ratingModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-slate-50">
               <h2 className="text-xl font-semibold text-slate-900">Rate your visit</h2>
               <button
                 onClick={() => setRatingModal({ isOpen: false, appointmentId: '', doctorName: '' })}
                 className="text-gray-400 hover:text-slate-600"
               >
                 <X className="h-6 w-6" />
               </button>
            </div>
            <div className="px-6 py-6">
               <p className="text-center text-slate-600 mb-6">
                 How was your consultation with <strong>Dr. {ratingModal.doctorName}</strong>?
               </p>
               <div className="flex justify-center space-x-2 mb-6">
                 {[1, 2, 3, 4, 5].map(star => (
                   <button
                     key={star}
                     type="button"
                     onClick={() => setRatingScore(star)}
                     className={`p-2 transition-transform hover:scale-110 ${ratingScore >= star ? 'text-amber-500' : 'text-gray-300'}`}
                   >
                     <Star className={`h-10 w-10 ${ratingScore >= star ? 'fill-current' : ''}`} />
                   </button>
                 ))}
               </div>
               <div className="mb-6">
                 <label className="block text-sm font-medium text-gray-700 mb-2">Write a review (optional)</label>
                 <textarea
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 min-h-[100px]"
                   placeholder="Share details of your experience..."
                   value={ratingReview}
                   onChange={e => setRatingReview(e.target.value)}
                 />
               </div>
               <Button className="w-full" onClick={handleRateSubmit} isLoading={isSubmittingRating}>
                 Submit Feedback
               </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

