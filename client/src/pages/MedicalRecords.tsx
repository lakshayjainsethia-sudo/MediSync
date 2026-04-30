import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLocation } from 'react-router-dom'
import { medicalRecordsApi } from '../utils/api'
import { MedicalRecord } from '../types'
import { toast } from 'react-toastify'
import { FileText, Plus, Calendar, User, Search } from 'lucide-react'
import Card, { CardHeader, CardContent } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import CreateMedicalRecordModal from '../components/medical/CreateMedicalRecordModal'
import { format } from 'date-fns'

export default function MedicalRecords() {
  const { user } = useAuth()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchRecords()
  }, [])

  const fetchRecords = async () => {
    try {
      setLoading(true)
      const response = await medicalRecordsApi.getMine()
      setRecords(response.data)
    } catch (error) {
      console.error('Failed to fetch medical records:', error)
      toast.error('Failed to load medical records')
    } finally {
      setLoading(false)
    }
  }

  const filteredRecords = records.filter(record =>
    record.chiefComplaint.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.diagnosis.primary.toLowerCase().includes(searchTerm.toLowerCase())
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
            <h1 className="text-3xl font-bold text-slate-900">Medical Records</h1>
            <p className="text-slate-600 mt-1">View and manage medical records</p>
          </div>
          {user?.role === 'doctor' && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-5 w-5 mr-2" />
              New Record
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Records List */}
        {filteredRecords.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No medical records found</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredRecords.map((record) => {
              const doctor = typeof record.doctor === 'object' ? record.doctor : null
              const patient = typeof record.patient === 'object' ? record.patient : null
              
              return (
                <Card key={record._id} hover>
                  <CardContent>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          {record.chiefComplaint}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-slate-600">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {format(new Date(record.visitDate), 'MMM dd, yyyy')}
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
                      <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                        {record.diagnosis.primary}
                      </span>
                    </div>

                    {record.symptoms && record.symptoms.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Symptoms:</p>
                        <p className="text-sm text-slate-600">{record.symptoms.join(', ')}</p>
                      </div>
                    )}

                    {record.vitalSigns && (
                      <div className="mb-3 p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-2">Vital Signs:</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          {record.vitalSigns.bloodPressure && (
                            <div>
                              <span className="text-slate-600">BP: </span>
                              <span className="font-medium">
                                {record.vitalSigns.bloodPressure.systolic}/
                                {record.vitalSigns.bloodPressure.diastolic}
                              </span>
                            </div>
                          )}
                          {record.vitalSigns.heartRate && (
                            <div>
                              <span className="text-slate-600">HR: </span>
                              <span className="font-medium">{record.vitalSigns.heartRate} bpm</span>
                            </div>
                          )}
                          {record.vitalSigns.temperature && (
                            <div>
                              <span className="text-slate-600">Temp: </span>
                              <span className="font-medium">
                                {record.vitalSigns.temperature.value}°{record.vitalSigns.temperature.unit === 'celsius' ? 'C' : 'F'}
                              </span>
                            </div>
                          )}
                          {record.vitalSigns.oxygenSaturation && (
                            <div>
                              <span className="text-slate-600">SpO2: </span>
                              <span className="font-medium">{record.vitalSigns.oxygenSaturation}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {record.notes && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                        <p className="text-sm text-slate-600">{record.notes}</p>
                      </div>
                    )}

                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRecord(record)
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
      {showCreateModal && selectedRecord && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false)
            setSelectedRecord(null)
          }}
          title="Medical Record Details"
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint</label>
              <p className="text-slate-900">{selectedRecord.chiefComplaint}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Diagnosis</label>
              <p className="text-slate-900">{selectedRecord.diagnosis.primary}</p>
            </div>
            {selectedRecord.symptoms && selectedRecord.symptoms.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Symptoms</label>
                <p className="text-slate-900">{selectedRecord.symptoms.join(', ')}</p>
              </div>
            )}
            {selectedRecord.vitalSigns && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vital Signs</label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selectedRecord.vitalSigns.bloodPressure && (
                    <p>BP: {selectedRecord.vitalSigns.bloodPressure.systolic}/{selectedRecord.vitalSigns.bloodPressure.diastolic}</p>
                  )}
                  {selectedRecord.vitalSigns.heartRate && (
                    <p>HR: {selectedRecord.vitalSigns.heartRate} bpm</p>
                  )}
                  {selectedRecord.vitalSigns.temperature && (
                    <p>Temp: {selectedRecord.vitalSigns.temperature.value}°{selectedRecord.vitalSigns.temperature.unit === 'celsius' ? 'C' : 'F'}</p>
                  )}
                  {selectedRecord.vitalSigns.oxygenSaturation && (
                    <p>SpO2: {selectedRecord.vitalSigns.oxygenSaturation}%</p>
                  )}
                </div>
              </div>
            )}
            {selectedRecord.notes && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <p className="text-slate-900">{selectedRecord.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Create Modal */}
      {showCreateModal && !selectedRecord && (
        <CreateMedicalRecordModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false)
            setSelectedRecord(null)
            setInitialPatientId(undefined)
            setInitialAppointmentId(undefined)
          }}
          onSuccess={() => {
            fetchRecords()
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

