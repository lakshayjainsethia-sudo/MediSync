import { useState, useEffect } from 'react'
import { medicalRecordsApi, appointmentsApi } from '../../utils/api'
import { Appointment } from '../../types'
import { toast } from 'react-toastify'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Button from '../ui/Button'

interface CreateMedicalRecordModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  patientId?: string
  appointmentId?: string
}

export default function CreateMedicalRecordModal({
  isOpen,
  onClose,
  onSuccess,
  patientId,
  appointmentId
}: CreateMedicalRecordModalProps) {
  const [formData, setFormData] = useState({
    patient: patientId || '',
    appointment: appointmentId || '',
    chiefComplaint: '',
    symptoms: [''],
    diagnosis: {
      primary: '',
      secondary: [] as string[]
    },
    vitalSigns: {
      bloodPressure: { systolic: '', diastolic: '' },
      heartRate: '',
      temperature: { value: '', unit: 'celsius' as 'celsius' | 'fahrenheit' },
      respiratoryRate: '',
      oxygenSaturation: ''
    },
    notes: ''
  })
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && !patientId) {
      fetchAppointments()
    }
  }, [isOpen, patientId])

  const fetchAppointments = async () => {
    try {
      const response = await appointmentsApi.getMine()
      setAppointments(response.data.filter((apt: Appointment) => apt.status === 'completed'))
    } catch (error) {
      console.error('Failed to fetch appointments:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.chiefComplaint || !formData.diagnosis.primary) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const recordData = {
        ...formData,
        symptoms: formData.symptoms.filter(s => s.trim()),
        vitalSigns: {
          ...formData.vitalSigns,
          bloodPressure: formData.vitalSigns.bloodPressure.systolic ? {
            systolic: parseInt(formData.vitalSigns.bloodPressure.systolic),
            diastolic: parseInt(formData.vitalSigns.bloodPressure.diastolic)
          } : undefined,
          heartRate: formData.vitalSigns.heartRate ? parseInt(formData.vitalSigns.heartRate) : undefined,
          temperature: formData.vitalSigns.temperature.value ? {
            value: parseFloat(formData.vitalSigns.temperature.value),
            unit: formData.vitalSigns.temperature.unit
          } : undefined,
          respiratoryRate: formData.vitalSigns.respiratoryRate ? parseInt(formData.vitalSigns.respiratoryRate) : undefined,
          oxygenSaturation: formData.vitalSigns.oxygenSaturation ? parseFloat(formData.vitalSigns.oxygenSaturation) : undefined
        }
      }
      
      await medicalRecordsApi.create(recordData)
      toast.success('Medical record created successfully')
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create medical record')
    } finally {
      setLoading(false)
    }
  }

  const addSymptom = () => {
    setFormData({ ...formData, symptoms: [...formData.symptoms, ''] })
  }

  const removeSymptom = (index: number) => {
    setFormData({ ...formData, symptoms: formData.symptoms.filter((_, i) => i !== index) })
  }

  const updateSymptom = (index: number, value: string) => {
    const newSymptoms = [...formData.symptoms]
    newSymptoms[index] = value
    setFormData({ ...formData, symptoms: newSymptoms })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Medical Record"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto">
        {!patientId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Appointment</label>
            <select
              value={formData.appointment}
              onChange={(e) => setFormData({ ...formData, appointment: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select an appointment...</option>
              {appointments.map((apt) => (
                <option key={apt._id} value={apt._id}>
                  {typeof apt.patient === 'object' ? apt.patient.name : 'Patient'} - {new Date(apt.date).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        )}

        <Input
          label="Chief Complaint"
          value={formData.chiefComplaint}
          onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Symptoms</label>
          {formData.symptoms.map((symptom, index) => (
            <div key={index} className="flex space-x-2 mb-2">
              <input
                type="text"
                value={symptom}
                onChange={(e) => updateSymptom(index, e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Enter symptom"
              />
              {formData.symptoms.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSymptom(index)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addSymptom}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            + Add Symptom
          </button>
        </div>

        <Input
          label="Primary Diagnosis"
          value={formData.diagnosis.primary}
          onChange={(e) => setFormData({ ...formData, diagnosis: { ...formData.diagnosis, primary: e.target.value } })}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Blood Pressure (Systolic)</label>
            <input
              type="number"
              value={formData.vitalSigns.bloodPressure.systolic}
              onChange={(e) => setFormData({
                ...formData,
                vitalSigns: {
                  ...formData.vitalSigns,
                  bloodPressure: { ...formData.vitalSigns.bloodPressure, systolic: e.target.value }
                }
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="120"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Blood Pressure (Diastolic)</label>
            <input
              type="number"
              value={formData.vitalSigns.bloodPressure.diastolic}
              onChange={(e) => setFormData({
                ...formData,
                vitalSigns: {
                  ...formData.vitalSigns,
                  bloodPressure: { ...formData.vitalSigns.bloodPressure, diastolic: e.target.value }
                }
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="80"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Heart Rate (bpm)"
            type="number"
            value={formData.vitalSigns.heartRate}
            onChange={(e) => setFormData({
              ...formData,
              vitalSigns: { ...formData.vitalSigns, heartRate: e.target.value }
            })}
          />
          <Input
            label="Temperature"
            type="number"
            step="0.1"
            value={formData.vitalSigns.temperature.value}
            onChange={(e) => setFormData({
              ...formData,
              vitalSigns: {
                ...formData.vitalSigns,
                temperature: { ...formData.vitalSigns.temperature, value: e.target.value }
              }
            })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="Additional notes..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            Create Record
          </Button>
        </div>
      </form>
    </Modal>
  )
}



