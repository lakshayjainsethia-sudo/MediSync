import { useState, useEffect } from 'react'
import { Search, Edit2, Plus } from 'lucide-react'
import { toast } from 'react-toastify'
import Card, { CardContent, CardHeader } from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { pharmacistApi } from '../../../utils/api'

export default function PharmacyManager() {
  const [medicines, setMedicines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Edit State
  const [editingMed, setEditingMed] = useState<any | null>(null)
  const [editPrice, setEditPrice] = useState<string>('')
  const [editThreshold, setEditThreshold] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  
  // Add State
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMed, setNewMed] = useState({ name: '', category: 'General', price: '', stockQuantity: '', unit: 'mg', minimumThreshold: '', expiryDate: '' })

  useEffect(() => {
    fetchMedicines()
  }, [])

  const fetchMedicines = async () => {
    setLoading(true)
    try {
      const res = await pharmacistApi.searchMedicines('')
      setMedicines(res.data?.data || res.data || [])
    } catch (err) {
      toast.error('Failed to load medicines')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMed) return
    setIsSaving(true)
    try {
      await pharmacistApi.updateMedicine(editingMed._id, {
        price: Number(editPrice), 
        minimumThreshold: Number(editThreshold) 
      })
      
      toast.success('Medicine updated successfully')
      setEditingMed(null)
      fetchMedicines()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update medicine')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await pharmacistApi.createMedicine({
        ...newMed,
        price: Number(newMed.price),
        stockQuantity: Number(newMed.stockQuantity),
        minimumThreshold: Number(newMed.minimumThreshold)
      })
      toast.success('Medicine added successfully')
      setShowAddForm(false)
      setNewMed({ name: '', category: 'General', price: '', stockQuantity: '', unit: 'mg', minimumThreshold: '', expiryDate: '' })
      fetchMedicines()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create medicine')
    } finally {
      setIsSaving(false)
    }
  }

  const filtered = medicines.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Card>
      <CardHeader
        title="Pharmacy Inventory & Pricing"
        subtitle="Manage medicine catalog, prices, and low-stock thresholds."
        action={
          <div className="flex items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search medicines..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Button onClick={() => setShowAddForm(true)} className="ml-3 bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-1">
              <Plus size={16} /> Medicine
            </Button>
          </div>
        }
      />
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medicine Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (₹)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Threshold</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map(med => (
                  <tr key={med._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-sm text-gray-900">{med.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{med.category}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">₹{med.price || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{med.stockQuantity} {med.unit}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{med.minimumThreshold || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          setEditingMed(med)
                          setEditPrice(med.price?.toString() || '0')
                          setEditThreshold(med.minimumThreshold?.toString() || '0')
                        }}
                      >
                        <Edit2 className="h-4 w-4" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No medicines found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {editingMed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Edit Medicine: {editingMed.name}</h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Minimum Stock Threshold</label>
                  <input
                    type="number"
                    value={editThreshold}
                    onChange={(e) => setEditThreshold(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500"
                    min="0"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="outline" type="button" onClick={() => setEditingMed(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={isSaving}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Add New Medicine</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newMed.name}
                    onChange={(e) => setNewMed({...newMed, name: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={newMed.category}
                    onChange={(e) => setNewMed({...newMed, category: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit (mg, ml, etc)</label>
                  <input
                    type="text"
                    value={newMed.unit}
                    onChange={(e) => setNewMed({...newMed, unit: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={newMed.price}
                    onChange={(e) => setNewMed({...newMed, price: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500"
                    min="0" required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Init Stock</label>
                  <input
                    type="number"
                    value={newMed.stockQuantity}
                    onChange={(e) => setNewMed({...newMed, stockQuantity: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500"
                    min="0" required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Alert</label>
                  <input
                    type="number"
                    value={newMed.minimumThreshold}
                    onChange={(e) => setNewMed({...newMed, minimumThreshold: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500"
                    min="0" required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={newMed.expiryDate}
                    onChange={(e) => setNewMed({...newMed, expiryDate: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="outline" type="button" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={isSaving}>
                    Save
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
