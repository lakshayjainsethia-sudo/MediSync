import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLocation } from 'react-router-dom'
import { prescriptionsApi } from '../utils/api'
import { Prescription } from '../types'
import { toast } from 'react-toastify'
import { Pill, Plus, Calendar, User, Search } from 'lucide-react'
import Card, { CardHeader, CardContent } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import CreatePrescriptionModal from '../components/prescriptions/CreatePrescriptionModal'
import { format } from 'date-fns'

export default function Prescriptions() {
  const { user } = useAuth()
  const location = useLocation()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [initialPatientId, setInitialPatientId] = useState<string | undefined>()
  const [initialAppointmentId, setInitialAppointmentId] = useState<string | undefined>()

  useEffect(() => {
    fetchPrescriptions()
    if (location.state) {
      const state = location.state as any
      if (state.createForAppointment || state.patientId) {
        setInitialPatientId(state.patientId)
        setInitialAppointmentId(state.createForAppointment)
        setShowCreateModal(true)
      }
    }
  }, [location])

  const fetchPrescriptions = async () => {
    try {
      setLoading(true)
      const response = await prescriptionsApi.getMine()
      setPrescriptions(response.data)
    } catch (error) {
      console.error('Failed to fetch prescriptions:', error)
      toast.error('Failed to load prescriptions')
    } finally {
      setLoading(false)
    }
  }

  const filteredPrescriptions = prescriptions.filter(prescription =>
    prescription.medications.some(med => 
      med.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Prescriptions</h1>
            <p className="text-slate-600 mt-1">View and manage prescriptions</p>
          </div>
          {user?.role === 'doctor' && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-5 w-5 mr-2" />
              New Prescription
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search prescriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Prescriptions List */}
        {filteredPrescriptions.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-center py-12">
                <Pill className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No prescriptions found</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredPrescriptions.map((prescription) => {
              const doctor = typeof prescription.doctor === 'object' ? prescription.doctor : null
              const patient = typeof prescription.patient === 'object' ? prescription.patient : null
              
              return (
                <Card key={prescription._id} hover>
                  <CardContent>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          Prescription #{prescription._id.slice(-6)}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-slate-600">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {format(new Date(prescription.issuedDate), 'MMM dd, yyyy')}
                          </div>
                          {user?.role === 'patient' && doctor && (
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              Dr. {doctor.name}
                            </div>
                          )}
                          {user?.role === 'doctor' && patient && (
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              {patient.name}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        prescription.status === 'active' ? 'bg-green-100 text-green-700' :
                        prescription.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {prescription.status}
                      </span>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Medications:</p>
                      <div className="space-y-2">
                        {prescription.medications.map((med, index) => (
                          <div key={index} className="p-3 bg-slate-50 rounded-lg">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-slate-900">{med.name}</p>
                                <p className="text-sm text-slate-600">
                                  {med.dosage} - {med.frequency}
                                </p>
                                {med.instructions && (
                                  <p className="text-sm text-gray-500 mt-1">{med.instructions}</p>
                                )}
                              </div>
                              {med.duration && (
                                <span className="text-xs text-gray-500">
                                  {med.duration.value} {med.duration.unit}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {prescription.instructions && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-1">Instructions:</p>
                        <p className="text-sm text-slate-600">{prescription.instructions}</p>
                      </div>
                    )}

                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPrescription(prescription)
                          setShowCreateModal(true)
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {showCreateModal && selectedPrescription && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false)
            setSelectedPrescription(null)
          }}
          title="Prescription Details"
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medications</label>
              <div className="space-y-2">
                {selectedPrescription.medications.map((med, index) => (
                  <div key={index} className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-medium text-slate-900">{med.name}</p>
                    <p className="text-sm text-slate-600">{med.dosage} - {med.frequency}</p>
                    {med.duration && (
                      <p className="text-sm text-gray-500">
                        Duration: {med.duration.value} {med.duration.unit}
                      </p>
                    )}
                    {med.instructions && (
                      <p className="text-sm text-gray-500 mt-1">Instructions: {med.instructions}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {selectedPrescription.instructions && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">General Instructions</label>
                <p className="text-slate-900">{selectedPrescription.instructions}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Create Modal */}
      {showCreateModal && !selectedPrescription && (
        <CreatePrescriptionModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false)
            setSelectedPrescription(null)
            setInitialPatientId(undefined)
            setInitialAppointmentId(undefined)
          }}
          onSuccess={() => {
            fetchPrescriptions()
            setShowCreateModal(false)
            setInitialPatientId(undefined)
            setInitialAppointmentId(undefined)
          }}
          patientId={initialPatientId}
          appointmentId={initialAppointmentId}
        />
      )}
    </div>
  )
}

