import { useState, useEffect } from 'react'
import { departmentsApi } from '../utils/api'
import { Department } from '../types'
import { toast } from 'react-toastify'
import { Building2, Users, Search } from 'lucide-react'
import Card, { CardHeader, CardContent } from '../components/ui/Card'

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    try {
      setLoading(true)
      const response = await departmentsApi.getAll()
      setDepartments(response.data)
    } catch (error) {
      console.error('Failed to fetch departments:', error)
      toast.error('Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dept.description && dept.description.toLowerCase().includes(searchTerm.toLowerCase()))
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Departments</h1>
          <p className="text-slate-600 mt-1">Browse our medical departments</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Departments Grid */}
        {filteredDepartments.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No departments found</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDepartments.map((department) => (
              <Card key={department._id} hover>
                <CardContent>
                  <div className="flex items-start mb-4">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary-600" />
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">
                        {department.name}
                      </h3>
                      {department.description && (
                        <p className="text-sm text-slate-600">{department.description}</p>
                      )}
                    </div>
                  </div>
                  {department.head && (
                    <div className="flex items-center text-sm text-slate-600">
                      <Users className="h-4 w-4 mr-2" />
                      <span>
                        Head: {typeof department.head === 'object' ? department.head.name : 'N/A'}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}



