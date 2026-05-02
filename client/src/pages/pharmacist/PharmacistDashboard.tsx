import { useState, useEffect, useRef } from 'react'
import { pharmacistApi } from '../../utils/api'
import { toast } from 'react-toastify'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { Pill, Activity, AlertTriangle, FileText, CheckCircle, Search, Plus, Trash2 } from 'lucide-react'
import { io } from 'socket.io-client'
import EquipmentView from '../../features/admin/components/EquipmentManager'

export default function PharmacistDashboard() {
  const [overview, setOverview] = useState<any>(null)
  const [pendingPrescriptions, setPendingPrescriptions] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'prescriptions' | 'equipment'>('prescriptions')

  // Search and Dispense states per appointment
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({})
  const [searchResults, setSearchResults] = useState<Record<string, any[]>>({})
  const [dispenseLists, setDispenseLists] = useState<Record<string, any[]>>({})
  
  const searchTimeout = useRef<any>(null)

  useEffect(() => {
    fetchDashboardData()

    const socket = io('/', { path: '/socket.io' })
    socket.emit('join', 'pharmacists')

    socket.on('new_prescription', (data) => {
      toast.info(`New prescription received for ${data.patientName}`)
      fetchDashboardData()
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [overviewRes, pendingRes, stockRes] = await Promise.all([
        pharmacistApi.getOverview(),
        pharmacistApi.getPendingPrescriptions(),
        pharmacistApi.getLowStockMedicines(50)
      ])
      setOverview(overviewRes.data)
      setPendingPrescriptions(pendingRes.data)
      setLowStock(stockRes.data)
    } catch (err) {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (appointmentId: string, q: string) => {
    setSearchQueries(prev => ({ ...prev, [appointmentId]: q }))
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    
    if (!q.trim()) {
      setSearchResults(prev => ({ ...prev, [appointmentId]: [] }))
      return
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await pharmacistApi.searchMedicines(q)
        setSearchResults(prev => ({ ...prev, [appointmentId]: res.data.data }))
      } catch (err) {
        console.error(err)
      }
    }, 300)
  }

  const handleAddToDispenseList = (appointmentId: string, medicine: any) => {
    const list = dispenseLists[appointmentId] || []
    if (list.find(item => item.medicineId === medicine._id)) {
      toast.warning('Medicine already added')
      return
    }
    const newList = [...list, { medicineId: medicine._id, name: medicine.name, quantity: 1, currentStock: medicine.stockQuantity }]
    setDispenseLists(prev => ({ ...prev, [appointmentId]: newList }))
    setSearchQueries(prev => ({ ...prev, [appointmentId]: '' }))
    setSearchResults(prev => ({ ...prev, [appointmentId]: [] }))
  }

  const updateQuantity = (appointmentId: string, medicineId: string, qty: number) => {
    if (qty < 1) return
    const list = dispenseLists[appointmentId] || []
    const newList = list.map(item => item.medicineId === medicineId ? { ...item, quantity: qty } : item)
    setDispenseLists(prev => ({ ...prev, [appointmentId]: newList }))
  }

  const removeFromDispenseList = (appointmentId: string, medicineId: string) => {
    const list = dispenseLists[appointmentId] || []
    const newList = list.filter(item => item.medicineId !== medicineId)
    setDispenseLists(prev => ({ ...prev, [appointmentId]: newList }))
  }

  const handleDispense = async (id: string) => {
    try {
      const medicinesToDispense = (dispenseLists[id] || []).map(item => ({
        medicineId: item.medicineId,
        quantity: item.quantity
      }))

      if (medicinesToDispense.length === 0) {
        if (!window.confirm("No medicines added to dispense list. Confirm dispense without deducting stock?")) {
          return
        }
      }

      await pharmacistApi.dispensePrescription(id, { medicinesToDispense })
      toast.success('Prescription dispensed successfully')
      setDispenseLists(prev => { const next = {...prev}; delete next[id]; return next })
      fetchDashboardData()
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.message === 'Prescription already dispensed') {
        toast.error('This prescription was already dispensed.')
        fetchDashboardData()
      } else {
        toast.error(err.response?.data?.message || 'Failed to dispense prescription')
      }
    }
  }

  const handleRestockRequest = (medicine: any) => {
    toast.success(`Restock request sent to admin for ${medicine.name}`)
  }

  if (loading && !overview) {
    return <div className="p-8 text-center">Loading pharmacist dashboard...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Pharmacist Console</h1>
        
        {/* KPI Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 flex items-center bg-white shadow-sm border border-slate-200">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Pending Dispense</p>
              <h3 className="text-2xl font-bold text-slate-800">{overview?.pendingDispense || 0}</h3>
            </div>
          </Card>
          <Card className="p-4 flex items-center bg-white shadow-sm border border-slate-200">
            <div className="p-3 rounded-full bg-emerald-100 text-emerald-600 mr-4">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Dispensed Today</p>
              <h3 className="text-2xl font-bold text-slate-800">{overview?.dispensedToday || 0}</h3>
            </div>
          </Card>
          <Card className="p-4 flex items-center bg-white shadow-sm border border-slate-200">
            <div className="p-3 rounded-full bg-amber-100 text-amber-600 mr-4">
              <Pill className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Low Stock Alerts</p>
              <h3 className="text-2xl font-bold text-slate-800">{overview?.lowStockCount || 0}</h3>
            </div>
          </Card>
          <Card className="p-4 flex items-center bg-white shadow-sm border border-slate-200">
            <div className="p-3 rounded-full bg-red-100 text-red-600 mr-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Maintenance Alerts</p>
              <h3 className="text-2xl font-bold text-slate-800">{overview?.maintenanceAlerts || 0}</h3>
            </div>
          </Card>
        </div>

        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('prescriptions')}
              className={`${
                activeTab === 'prescriptions'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Prescriptions & Inventory
            </button>
            <button
              onClick={() => setActiveTab('equipment')}
              className={`${
                activeTab === 'equipment'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Equipment Status
            </button>
          </nav>
        </div>

        {activeTab === 'prescriptions' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Prescription Queue</h2>
              {pendingPrescriptions.length === 0 ? (
                <Card className="p-12 text-center flex flex-col items-center justify-center border-dashed border-2">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
                  <p className="text-lg text-slate-600 font-medium">No pending prescriptions</p>
                  <p className="text-slate-400 text-sm">All patients have been served.</p>
                </Card>
              ) : (
                pendingPrescriptions.map(apt => (
                  <Card key={apt._id} className="p-5 border-l-4 border-l-primary-500">
                    <div className="flex justify-between items-start mb-4 border-b pb-4">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{apt.patient?.name || 'Unknown'}</h3>
                        <p className="text-sm text-slate-500">Dr. {apt.doctor?.name || 'Unknown'} • {new Date(apt.date).toLocaleDateString()}</p>
                      </div>
                      <Button onClick={() => handleDispense(apt._id)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                        Confirm Dispense
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Doctor's Notes</h4>
                        <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm text-slate-700 whitespace-pre-wrap border border-slate-200 min-h-[120px]">
                          {apt.prescription}
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                          <span>Dispense List</span>
                        </h4>
                        
                        <div className="relative mb-3">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            placeholder="Search inventory..."
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            value={searchQueries[apt._id] || ''}
                            onChange={(e) => handleSearchChange(apt._id, e.target.value)}
                          />
                          
                          {/* Search Results Dropdown */}
                          {searchResults[apt._id] && searchResults[apt._id].length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-48 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                              {searchResults[apt._id].map(med => (
                                <div
                                  key={med._id}
                                  className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-slate-100 flex justify-between items-center"
                                  onClick={() => handleAddToDispenseList(apt._id, med)}
                                >
                                  <span className="block truncate font-medium">{med.name}</span>
                                  <span className={`text-xs ${med.stockQuantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>Stock: {med.stockQuantity}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          {(dispenseLists[apt._id] || []).length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4 italic">No items added to dispense.</p>
                          ) : (
                            (dispenseLists[apt._id] || []).map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-slate-200 shadow-sm">
                                <div className="truncate flex-1 mr-2">
                                  <p className="text-sm font-medium text-slate-800 truncate" title={item.name}>{item.name}</p>
                                  <p className="text-xs text-slate-500">Stock: {item.currentStock}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input 
                                    type="number" 
                                    min="1" 
                                    value={item.quantity}
                                    onChange={(e) => updateQuantity(apt._id, item.medicineId, parseInt(e.target.value) || 1)}
                                    className="w-16 p-1 text-sm border border-slate-300 rounded text-center"
                                  />
                                  <button onClick={() => removeFromDispenseList(apt._id, item.medicineId)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Low Stock Panel</h2>
              <Card className="p-0 overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto">
                  {lowStock.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">Inventory levels look good.</div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {lowStock.map(med => (
                        <li key={med._id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                          <div>
                            <p className="font-medium text-slate-800">{med.name}</p>
                            <p className="text-sm text-slate-500">Stock: <span className="text-red-600 font-bold">{med.stockQuantity}</span> (Min: {med.minimumThreshold || 50})</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleRestockRequest(med)}>
                            Request
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'equipment' && (
          <div className="mt-6">
            <EquipmentView />
          </div>
        )}

      </div>
    </div>
  )
}
