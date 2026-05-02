export interface User {
  _id: string
  name: string
  email: string
  role: 'patient' | 'doctor' | 'admin' | 'nurse' | 'pharmacist' | 'receptionist'
  phone?: string
  specialization?: string
  department?: string | Department
  isApproved?: boolean
  isVerified?: boolean
  isActive?: boolean
  profileImage?: string
  consultationFee?: number
  experience?: number
  qualifications?: string[]
  bio?: string
  availability?: {
    days: string[]
    startTime: string
    endTime: string
  }
  createdAt?: string
  updatedAt?: string
}

export type RegisterableRole = 'patient' | 'doctor' | 'nurse' | 'pharmacist' | 'receptionist'

export interface Department {
  _id: string
  name: string
  description?: string
  head?: string | User
  isActive: boolean
}

export interface Appointment {
  _id: string
  patient: string | User
  doctor: string | User
  date: string
  startTime: string
  endTime: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
  notes?: string
  symptoms?: string[]
  diagnosis?: string
  prescription?: string
  triage_tag?: 'RED' | 'ORANGE' | 'GREEN'
  severity?: number
  urgency_score?: number
  weightedScore?: number
  aiPriority?: string
  aiConfidence?: number
  aiReasoning?: string
  aiRedFlags?: string[]
  riskOverride?: boolean
  pulse?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface MedicalRecord {
  _id: string
  patient: string | User
  doctor: string | User
  appointment?: string | Appointment
  visitDate: string
  chiefComplaint: string
  symptoms?: string[]
  diagnosis: {
    primary: string
    secondary?: string[]
    icd10Code?: string
  }
  vitalSigns?: {
    bloodPressure?: {
      systolic: number
      diastolic: number
    }
    heartRate?: number
    temperature?: {
      value: number
      unit: 'celsius' | 'fahrenheit'
    }
    respiratoryRate?: number
    oxygenSaturation?: number
    weight?: {
      value: number
      unit: 'kg' | 'lbs'
    }
    height?: {
      value: number
      unit: 'cm' | 'feet'
    }
  }
  examination?: {
    general?: string
    cardiovascular?: string
    respiratory?: string
    abdominal?: string
    neurological?: string
    other?: string
  }
  notes?: string
  followUp?: {
    required: boolean
    date?: string
    notes?: string
  }
  attachments?: Array<{
    type: 'image' | 'document' | 'lab-report'
    url: string
    name: string
    uploadedAt: string
  }>
  createdAt?: string
  updatedAt?: string
}

export interface Prescription {
  _id: string
  patient: string | User
  doctor: string | User
  appointment?: string | Appointment
  medicalRecord?: string | MedicalRecord
  medications: Array<{
    name: string
    dosage: string
    frequency: string
    duration: {
      value: number
      unit: 'days' | 'weeks' | 'months'
    }
    instructions?: string
    quantity?: number
    beforeMeal?: boolean
    afterMeal?: boolean
  }>
  instructions?: string
  issuedDate: string
  validUntil?: string
  status: 'active' | 'completed' | 'cancelled'
  pharmacy?: {
    name: string
    address: string
    phone: string
  }
  createdAt?: string
  updatedAt?: string
}

export interface LabTest {
  _id: string
  patient: string | User
  doctor: string | User
  appointment?: string | Appointment
  testName: string
  testType: 'blood' | 'urine' | 'imaging' | 'biopsy' | 'culture' | 'other'
  orderedDate: string
  scheduledDate?: string
  completedDate?: string
  status: 'ordered' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  results?: Array<{
    parameter: string
    value: string
    unit?: string
    normalRange?: string
    status: 'normal' | 'abnormal' | 'critical'
  }>
  labTechnician?: string | User
  notes?: string
  reportUrl?: string
  cost?: number
  createdAt?: string
  updatedAt?: string
}

export interface Billing {
  _id: string
  patient: string | User
  appointment?: string | Appointment
  invoiceNumber: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
    category: 'consultation' | 'medication' | 'lab-test' | 'procedure' | 'other'
  }>
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded'
  paymentMethod?: 'cash' | 'card' | 'insurance' | 'online' | 'other'
  payments?: Array<{
    amount: number
    method: string
    transactionId?: string
    paidAt: string
  }>
  dueDate?: string
  paidAt?: string
  insurance?: {
    provider?: string
    policyNumber?: string
    coverage?: number
    claimNumber?: string
  }
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export interface Notification {
  _id: string
  user: string | User
  type: 'appointment' | 'prescription' | 'lab-test' | 'billing' | 'system' | 'reminder'
  title: string
  message: string
  relatedId?: string
  relatedModel?: 'Appointment' | 'Prescription' | 'LabTest' | 'Billing'
  read: boolean
  readAt?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  actionUrl?: string
  createdAt?: string
  updatedAt?: string
}

export interface TimeSlot {
  time: string
  endTime: string
  startTime?: string
  endTime24?: string
  available: boolean
}

export interface AuthResponse {
  success: boolean
  token: string
  user: User
}

export interface DashboardStats {
  totalPatients: number
  totalDoctors: number
  totalAppointments: number
  todaysAppointments: number
  pendingApprovals: number
  revenue: number
  appointmentsByStatus: Array<{
    _id: string
    count: number
  }>
  appointmentsByDay: Array<{
    _id: string
    count: number
  }>
  triageDistribution?: Array<{
    _id: string
    count: number
  }>
  revenueTrend?: Array<{
    _id: string
    total: number
  }>
  revenueBreakdown?: Array<{
    _id: string
    total: number
  }>
  userDistribution?: Array<{
    _id: string
    count: number
  }>
  topDoctors: Array<{
    _id: string
    name: string
    specialization?: string
    appointmentCount: number
  }>
  bloodLevels?: Array<{
    _id: string
    total: number
  }>
}
