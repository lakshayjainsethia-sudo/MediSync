import { useState, useEffect } from 'react'
import { prescriptionsApi, appointmentsApi } from '../../utils/api'
import { Appointment } from '../../types'
import { toast } from 'react-toastify'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Button from '../ui/Button'
import { Plus, X } from 'lucide-react'

interface CreatePrescriptionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  patientId?: string
  appointmentId?: string
}

export default function CreatePrescriptionModal({
  isOpen,
  onClose,
  onSuccess,
  patientId,
  appointmentId
}: CreatePrescriptionModalProps) {
  const [formData, setFormData] = useState({
    patient: patientId || '',
    appointment: appointmentId || '',
    medications: [{
      name: '',
      dosage: '',
      frequency: '',
      duration: { value: 7, unit: 'days' as 'days' | 'weeks' | 'months' },
      instructions: ''
    }],
    instructions: ''
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
    
    if (!formData.patient) {
      toast.error('Please select a patient or appointment')
      return
    }

    if (formData.medications.some(med => !med.name || !med.dosage || !med.frequency)) {
      toast.error('Please fill in all medication details')
      return
    }

    setLoading(true)
    try {
      await prescriptionsApi.create(formData)
      toast.success('Prescription created successfully')
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create prescription')
    } finally {
      setLoading(false)
    }
  }

  const addMedication = () => {
    setFormData({
      ...formData,
      medications: [...formData.medications, {
        name: '',
        dosage: '',
        frequency: '',
        duration: { value: 7, unit: 'days' },
        instructions: ''
      }]
    })
  }

  const removeMedication = (index: number) => {
    setFormData({
      ...formData,
      medications: formData.medications.filter((_, i) => i !== index)
    })
  }

  const updateMedication = (index: number, field: string, value: any) => {
    const newMedications = [...formData.medications]
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      const nestedValue = newMedications[index][parent as keyof typeof newMedications[0]]
      newMedications[index] = {
        ...newMedications[index],
        [parent]: {
          ...(typeof nestedValue === 'object' && nestedValue !== null ? nestedValue : {}),
          [child]: value
        }
      }
    } else {
      newMedications[index] = { ...newMedications[index], [field]: value }
    }
    setFormData({ ...formData, medications: newMedications })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Prescription"
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Medications</label>
          {formData.medications.map((med, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg mb-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-gray-900">Medication {index + 1}</h4>
                {formData.medications.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMedication(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Medication Name"
                  value={med.name}
                  onChange={(e) => updateMedication(index, 'name', e.target.value)}
                  required
                />
                <Input
                  label="Dosage"
                  value={med.dosage}
                  onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                  placeholder="e.g., 500mg"
                  required
                />
                <Input
                  label="Frequency"
                  value={med.frequency}
                  onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                  placeholder="e.g., Twice daily"
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={med.duration.value}
                      onChange={(e) => updateMedication(index, 'duration.value', parseInt(e.target.value) || 0)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      min="1"
                      required
                    />
                    <select
                      value={med.duration.unit}
                      onChange={(e) => updateMedication(index, 'duration.unit', e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Input
                  label="Instructions (Optional)"
                  value={med.instructions}
                  onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                  placeholder="e.g., Take with food"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addMedication}
            className="flex items-center text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Medication
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">General Instructions</label>
          <textarea
            value={formData.instructions}
            onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="Additional instructions for the patient..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            Create Prescription
          </Button>
        </div>
      </form>
    </Modal>
  )
}



