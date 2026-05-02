import { useState, useEffect } from 'react'
import { equipmentApi, aiApi } from '../../../utils/api'
import { toast } from 'react-toastify'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { Plus, PenTool, Wrench, Calendar, Activity } from 'lucide-react'

export default function EquipmentManager() {
  const [equipment, setEquipment] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showLogModal, setShowLogModal] = useState<string | null>(null)
  const [showPredictionModal, setShowPredictionModal] = useState<any>(null)
  const [predicting, setPredicting] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    serialNumber: '',
    type: 'Ventilator',
    unit: '',
    location: '',
  })

  const [logData, setLogData] = useState({
    technician: '',
    notes: '',
    hoursOperated: '',
    issueFound: ''
  })

  useEffect(() => {
    fetchEquipment()
  }, [])

  const fetchEquipment = async () => {
    try {
      setLoading(true)
      const res = await equipmentApi.getAll()
      setEquipment(res.data)
    } catch (err) {
      toast.error('Failed to load equipment')
    } finally {
      setLoading(false)
    }
  }

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await equipmentApi.create(formData)
      toast.success('Equipment added')
      setShowAddModal(false)
      fetchEquipment()
    } catch (err) {
      toast.error('Failed to add equipment')
    }
  }

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showLogModal) return
    try {
      await equipmentApi.addLog(showLogModal, {
        ...logData,
        hoursOperated: Number(logData.hoursOperated) || 0
      })
      toast.success('Log added')
      setShowLogModal(null)
      fetchEquipment()
    } catch (err) {
      toast.error('Failed to add log')
    }
  }

  const handlePredict = async (equip: any) => {
    setPredicting(equip._id)
    try {
      const res = await aiApi.predictMaintenance(equip._id)
      setShowPredictionModal({ equip, prediction: res.data })
    } catch (err) {
      toast.error('Prediction failed')
    } finally {
      setPredicting(null)
    }
  }

  const handleUpdateNextService = async (id: string, date: string) => {
    try {
      await equipmentApi.update(id, { nextMaintenanceDate: date, status: 'Maintenance' })
      toast.success('Service scheduled')
      setShowPredictionModal(null)
      fetchEquipment()
    } catch (err) {
      toast.error('Failed to update service date')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Equipment Manager</h2>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Equipment
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-sm text-slate-600">Serial No.</th>
                <th className="p-4 font-semibold text-sm text-slate-600">Name</th>
                <th className="p-4 font-semibold text-sm text-slate-600">Type & Unit</th>
                <th className="p-4 font-semibold text-sm text-slate-600">Status</th>
                <th className="p-4 font-semibold text-sm text-slate-600">Service Dates</th>
                <th className="p-4 font-semibold text-sm text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">Loading equipment...</td>
                </tr>
              ) : equipment.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No equipment found</td>
                </tr>
              ) : (
                equipment.map(equip => (
                  <tr key={equip._id} className="hover:bg-slate-50">
                    <td className="p-4 font-mono text-sm text-slate-600">{equip.serialNumber}</td>
                    <td className="p-4 font-medium text-slate-900">{equip.name}</td>
                    <td className="p-4">
                      <div className="text-sm text-slate-900">{equip.type}</div>
                      <div className="text-xs text-slate-500">{equip.unit}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        equip.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                        equip.status === 'Maintenance' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {equip.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      <div><span className="font-medium text-slate-500">Last:</span> {equip.lastMaintenanceDate ? new Date(equip.lastMaintenanceDate).toLocaleDateString() : 'N/A'}</div>
                      <div><span className="font-medium text-slate-500">Next:</span> {equip.nextMaintenanceDate ? new Date(equip.nextMaintenanceDate).toLocaleDateString() : 'N/A'}</div>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setShowLogModal(equip._id)}>
                        <Wrench className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => handlePredict(equip)} 
                        disabled={predicting === equip._id}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        {predicting === equip._id ? <Activity className="h-4 w-4 animate-pulse" /> : <PenTool className="h-4 w-4" />}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Equipment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Add Equipment</h3>
            <form onSubmit={handleAddEquipment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input required className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
                <input required className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500" value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  {['Ventilator','MRI','ECG','X-Ray','Infusion Pump','Defibrillator','Ultrasound','Other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                <input required className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500" placeholder="e.g. ICU" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input required className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500" placeholder="e.g. Ward 3" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Add Maintenance Log</h3>
            <form onSubmit={handleAddLog} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Technician</label>
                <input required className="w-full p-2 border border-slate-300 rounded" value={logData.technician} onChange={e => setLogData({...logData, technician: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea required className="w-full p-2 border border-slate-300 rounded" value={logData.notes} onChange={e => setLogData({...logData, notes: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Issue Found</label>
                <input className="w-full p-2 border border-slate-300 rounded" value={logData.issueFound} onChange={e => setLogData({...logData, issueFound: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hours Operated</label>
                <input type="number" className="w-full p-2 border border-slate-300 rounded" value={logData.hoursOperated} onChange={e => setLogData({...logData, hoursOperated: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="outline" onClick={() => setShowLogModal(null)}>Cancel</Button>
                <Button type="submit">Save Log</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prediction Modal */}
      {showPredictionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="h-6 w-6 text-indigo-600" />
              <h3 className="text-xl font-bold text-slate-900">AI Maintenance Prediction</h3>
            </div>
            
            {showPredictionModal.prediction.fallback ? (
              <div className="bg-slate-100 p-4 rounded text-slate-600 text-sm">
                {showPredictionModal.prediction.reasoning}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Predicted Next Service</p>
                    <p className="text-2xl font-bold text-slate-800">{showPredictionModal.prediction.predictedNextService}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    showPredictionModal.prediction.urgency === 'IMMEDIATE' ? 'bg-red-100 text-red-800' :
                    showPredictionModal.prediction.urgency === 'SCHEDULED' ? 'bg-amber-100 text-amber-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {showPredictionModal.prediction.urgency}
                  </span>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-slate-700 mb-1">Confidence</h4>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">{showPredictionModal.prediction.confidenceLevel}</span>
                </div>

                {showPredictionModal.prediction.predictedIssues?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-slate-700 mb-1">Predicted Issues</h4>
                    <ul className="list-disc pl-5 text-sm text-slate-600">
                      {showPredictionModal.prediction.predictedIssues.map((issue: string, i: number) => <li key={i}>{issue}</li>)}
                    </ul>
                  </div>
                )}

                {showPredictionModal.prediction.recommendedActions?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-slate-700 mb-1">Recommended Actions</h4>
                    <ul className="list-decimal pl-5 text-sm text-slate-600">
                      {showPredictionModal.prediction.recommendedActions.map((action: string, i: number) => <li key={i}>{action}</li>)}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="font-medium text-sm text-slate-700 mb-1">AI Reasoning</h4>
                  <p className="text-sm text-slate-500 italic">"{showPredictionModal.prediction.reasoning}"</p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
              <Button type="button" variant="outline" onClick={() => setShowPredictionModal(null)}>Close</Button>
              {!showPredictionModal.prediction.fallback && (
                <Button onClick={() => handleUpdateNextService(showPredictionModal.equip._id, showPredictionModal.prediction.predictedNextService)}>
                  <Calendar className="h-4 w-4 mr-2" /> Schedule This Service
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
