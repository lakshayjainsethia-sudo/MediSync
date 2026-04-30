import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { patientsApi, doctorsApi } from '../utils/api'
import { toast } from 'react-toastify'
import { User, Mail, Phone, Calendar, Edit, Save, X } from 'lucide-react'
import Card, { CardHeader, CardContent } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      })
    }
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      let response
      if (user?.role === 'patient') {
        response = await patientsApi.updateProfile(formData)
      } else if (user?.role === 'doctor') {
        response = await doctorsApi.updateProfile(formData)
      }
      
      if (response) {
        updateUser(response.data)
        toast.success('Profile updated successfully')
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
            <p className="text-slate-600 mt-1">Manage your account information</p>
          </div>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-5 w-5 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  setFormData({
                    name: user.name || '',
                    email: user.email || '',
                    phone: user.phone || '',
                  })
                }}
              >
                <X className="h-5 w-5 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} isLoading={loading}>
                <Save className="h-5 w-5 mr-2" />
                Save Changes
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card>
            <CardContent>
              <div className="text-center">
                <div className="mx-auto h-24 w-24 bg-primary-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-4">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-1">{user.name}</h2>
                <p className="text-sm text-slate-600 mb-2">{user.email}</p>
                <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
                {user.specialization && (
                  <p className="text-sm text-primary-600 mt-2">{user.specialization}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Details Card */}
          <Card className="lg:col-span-2">
            <CardHeader title="Personal Information" />
            <CardContent>
              <div className="space-y-4">
                <Input
                  label="Full Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
                <Input
                  label="Phone Number"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
                {user.specialization && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Specialization
                    </label>
                    <p className="text-slate-900">{user.specialization}</p>
                  </div>
                )}
                {user.experience && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Experience
                    </label>
                    <p className="text-slate-900">{user.experience} years</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}



