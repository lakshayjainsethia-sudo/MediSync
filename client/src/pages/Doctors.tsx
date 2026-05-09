import { useState, useEffect } from 'react'
import { doctorsApi } from '../utils/api'
import { User } from '../types'
import { toast } from 'react-toastify'
import { UserCheck, Search, Calendar, Star, MapPin } from 'lucide-react'
import Card, { CardHeader, CardContent } from '../components/ui/Card'
import Button from '../components/ui/Button'
import { useNavigate } from 'react-router-dom'

export default function Doctors() {
  const navigate = useNavigate()
  const [doctors, setDoctors] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSpecialization, setFilterSpecialization] = useState('')

  useEffect(() => {
    fetchDoctors()
  }, [])

  const fetchDoctors = async () => {
    try {
      setLoading(true)
      const response = await doctorsApi.getAll()
      setDoctors(response.data)
    } catch (error) {
      console.error('Failed to fetch doctors:', error)
      toast.error('Failed to load doctors')
    } finally {
      setLoading(false)
    }
  }

  const specializations = Array.from(new Set(doctors.map(d => d.specialization).filter(Boolean)))

  const filteredDoctors = doctors.filter(doctor => {
    const matchesSearch = doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doctor.specialization && doctor.specialization.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesSpecialization = !filterSpecialization || doctor.specialization === filterSpecialization
    return matchesSearch && matchesSpecialization
  })

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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Our Doctors</h1>
          <p className="text-slate-600 mt-1">Find and book appointments with our expert doctors</p>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search doctors by name or specialization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterSpecialization}
            onChange={(e) => setFilterSpecialization(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All Specializations</option>
            {specializations.map(spec => (
              <option key={spec} value={spec}>{spec}</option>
            ))}
          </select>
        </div>

        {/* Doctors Grid */}
        {filteredDoctors.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-center py-12">
                <UserCheck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No doctors found</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDoctors.map((doctor) => (
              <Card key={doctor._id} hover>
                <CardContent>
                  <div className="text-center mb-4">
                    <div className="mx-auto h-20 w-20 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-3">
                      {doctor.name.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-1">
                      Dr. {doctor.name}
                    </h3>
                    {doctor.specialization && (
                      <p className="text-sm text-primary-600 font-medium mb-2">
                        {doctor.specialization}
                      </p>
                    )}
                    {doctor.experience && (
                      <p className="text-sm text-slate-600">
                        {doctor.experience} years of experience
                      </p>
                    )}
                  </div>

                  {doctor.bio && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                      {doctor.bio}
                    </p>
                  )}

                  <div className="space-y-2 mb-4">
                    {doctor.consultationFee && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Consultation Fee:</span>
                        <span className="font-semibold text-slate-900">₹{doctor.consultationFee}</span>
                      </div>
                    )}
                    {doctor.phone && (
                      <div className="flex items-center text-sm text-slate-600">
                        <span>{doctor.phone}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => navigate('/patient/dashboard', { state: { selectedDoctor: doctor._id } })}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Book Appointment
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}



