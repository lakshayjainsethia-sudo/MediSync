import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { toast } from 'react-toastify';
import { Package, AlertTriangle, Clock, Wrench, Search, Plus, Edit2, Trash2, Import, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type TabType = 'overview' | 'medicines' | 'equipment';

export default function InventoryDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Data State
  const [medicines, setMedicines] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [isFDAModalOpen, setIsFDAModalOpen] = useState(false);
  
  const [currentMed, setCurrentMed] = useState<any>(null);
  const [currentEquip, setCurrentEquip] = useState<any>(null);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const [medRes, eqRes] = await Promise.all([
        api.get('/medicines?limit=1000'), // Get all for dashboard simplicity
        api.get('/equipment')
      ]);
      setMedicines(medRes.data.data || []);
      setEquipment(eqRes.data || []);
    } catch (err) {
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const isAdmin = user?.role === 'admin';
  const isPharmacist = user?.role === 'pharmacist';
  const canEdit = isAdmin || isPharmacist;

  // Overview Metrics
  const totalMedicines = medicines.length;
  const lowStockCount = medicines.filter(m => m.stockQuantity <= m.minimumThreshold).length;
  const expiringSoonCount = medicines.filter(m => {
    const daysToExpiry = (new Date(m.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
    return daysToExpiry > 0 && daysToExpiry <= 30;
  }).length;
  const equipmentMaintenanceCount = equipment.filter(e => e.status === 'Maintenance').length;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-900">Inventory Dashboard</h1>
          {canEdit && (
            <div className="flex space-x-3">
              <button 
                onClick={() => { setCurrentMed(null); setIsMedModalOpen(true); }}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Medicine
              </button>
              <button 
                onClick={() => { setCurrentEquip(null); setIsEquipModalOpen(true); }}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Equipment
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`${activeTab === 'overview' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Overview Insights
            </button>
            <button
              onClick={() => setActiveTab('medicines')}
              className={`${activeTab === 'medicines' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Medicines
            </button>
            <button
              onClick={() => setActiveTab('equipment')}
              className={`${activeTab === 'equipment' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Equipment
            </button>
          </nav>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Total Medicines</p>
                      <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalMedicines}</h3>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                      <Package className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Low Stock Alerts</p>
                      <h3 className="text-2xl font-bold text-red-600 mt-1">{lowStockCount}</h3>
                    </div>
                    <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Expiring Soon (30d)</p>
                      <h3 className="text-2xl font-bold text-amber-600 mt-1">{expiringSoonCount}</h3>
                    </div>
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                      <Clock className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-500">In Maintenance</p>
                      <h3 className="text-2xl font-bold text-slate-900 mt-1">{equipmentMaintenanceCount}</h3>
                    </div>
                    <div className="p-3 bg-slate-100 text-slate-600 rounded-lg">
                      <Wrench className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'medicines' && (
              <MedicinesView 
                medicines={medicines} 
                canEdit={canEdit}
                onEdit={(med: any) => { setCurrentMed(med); setIsMedModalOpen(true); }}
                onDelete={async (id: string) => {
                  if (confirm('Delete this medicine?')) {
                    try {
                      await api.delete(`/medicines/${id}`);
                      toast.success('Deleted successfully');
                      fetchInventory();
                    } catch { toast.error('Failed to delete'); }
                  }
                }}
              />
            )}

            {activeTab === 'equipment' && (
              <EquipmentView 
                equipment={equipment}
                canEdit={canEdit}
                onEdit={(eq: any) => { setCurrentEquip(eq); setIsEquipModalOpen(true); }}
                onDelete={async (id: string) => {
                  if (confirm('Delete this equipment?')) {
                    try {
                      await api.delete(`/equipment/${id}`);
                      toast.success('Deleted successfully');
                      fetchInventory();
                    } catch { toast.error('Failed to delete'); }
                  }
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Medicines Modal */}
      {isMedModalOpen && (
        <MedicineModal 
          medicine={currentMed} 
          onClose={() => setIsMedModalOpen(false)}
          onSave={() => { setIsMedModalOpen(false); fetchInventory(); }}
          onOpenFDA={() => setIsFDAModalOpen(true)}
        />
      )}

      {/* Equipment Modal */}
      {isEquipModalOpen && (
        <EquipmentModal 
          equipment={currentEquip} 
          onClose={() => setIsEquipModalOpen(false)}
          onSave={() => { setIsEquipModalOpen(false); fetchInventory(); }}
        />
      )}

      {/* FDA Modal */}
      {isFDAModalOpen && (
        <FDAModal 
          onClose={() => setIsFDAModalOpen(false)}
          onSelect={(data: any) => {
            setCurrentMed({ ...currentMed, name: data.name, manufacturer: data.manufacturer, category: data.purpose });
            setIsFDAModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function MedicinesView({ medicines, canEdit, onEdit, onDelete }: any) {
  const [search, setSearch] = useState('');
  
  const filtered = medicines.filter((m: any) => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search medicines..." 
            className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Stock</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Expiry</th>
              {canEdit && <th className="px-6 py-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map((m: any) => {
              const isLowStock = m.stockQuantity <= m.minimumThreshold;
              const daysToExpiry = (new Date(m.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
              const isExpiring = daysToExpiry > 0 && daysToExpiry <= 30;

              return (
                <tr key={m._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{m.name}</td>
                  <td className="px-6 py-4 text-slate-600">
                    <span className="px-2 py-1 bg-slate-100 rounded-full text-xs">{m.category}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {m.stockQuantity} {m.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">${m.price}</td>
                  <td className="px-6 py-4">
                    <span className={`${isExpiring ? 'text-amber-600 font-medium' : 'text-slate-600'}`}>
                      {new Date(m.expiryDate).toLocaleDateString()}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => onEdit(m)} className="text-blue-600 hover:text-blue-800 mr-3"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => onDelete(m._id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EquipmentView({ equipment, canEdit, onEdit, onDelete }: any) {
  // Group by category/type to show counts visually, but still list individually
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Name / Category</th>
              <th className="px-6 py-4">Serial No.</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Status</th>
              {canEdit && <th className="px-6 py-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {equipment.map((e: any) => (
              <tr key={e._id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{e.name}</div>
                  <div className="text-xs text-slate-500">{e.category || e.type}</div>
                </td>
                <td className="px-6 py-4 text-slate-600">{e.serialNumber}</td>
                <td className="px-6 py-4 text-slate-600">{e.location} ({e.unit})</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    e.status === 'Active' ? 'bg-green-100 text-green-700' :
                    e.status === 'Maintenance' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {e.status}
                  </span>
                </td>
                {canEdit && (
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => onEdit(e)} className="text-blue-600 hover:text-blue-800 mr-3"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(e._id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MedicineModal({ medicine, onClose, onSave, onOpenFDA }: any) {
  const [form, setForm] = useState(medicine || {
    name: '', category: 'Analgesic', stockQuantity: 0, price: 0, minimumThreshold: 50, expiryDate: '', manufacturer: '', batchNumber: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (medicine) {
        await api.put(`/medicines/${medicine._id}`, form);
        toast.success('Medicine updated');
      } else {
        await api.post('/medicines', form);
        toast.success('Medicine added');
      }
      onSave();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error saving medicine');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">{medicine ? 'Edit Medicine' : 'Add Medicine'}</h2>
          <div className="flex items-center space-x-2">
            {!medicine && (
              <button onClick={onOpenFDA} className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg flex items-center hover:bg-blue-100 transition">
                <Import className="w-4 h-4 mr-1" /> Import OpenFDA
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input required type="text" className="w-full rounded-lg border-slate-300 border p-2 focus:ring-primary-500 focus:border-primary-500" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <input required type="text" className="w-full rounded-lg border-slate-300 border p-2" value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer</label>
            <input type="text" className="w-full rounded-lg border-slate-300 border p-2" value={form.manufacturer} onChange={e => setForm({...form, manufacturer: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Stock Quantity</label>
            <input required type="number" min="0" className="w-full rounded-lg border-slate-300 border p-2" value={form.stockQuantity} onChange={e => setForm({...form, stockQuantity: parseInt(e.target.value)})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Min Threshold</label>
            <input required type="number" min="0" className="w-full rounded-lg border-slate-300 border p-2" value={form.minimumThreshold} onChange={e => setForm({...form, minimumThreshold: parseInt(e.target.value)})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
            <input required type="number" min="0" step="0.01" className="w-full rounded-lg border-slate-300 border p-2" value={form.price} onChange={e => setForm({...form, price: parseFloat(e.target.value)})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
            <input required type="date" className="w-full rounded-lg border-slate-300 border p-2" value={form.expiryDate ? form.expiryDate.split('T')[0] : ''} onChange={e => setForm({...form, expiryDate: e.target.value})} />
          </div>
          <div className="col-span-2 pt-4 flex justify-end space-x-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save Medicine</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EquipmentModal({ equipment, onClose, onSave }: any) {
  const [form, setForm] = useState(equipment || {
    name: '', serialNumber: '', type: 'Other', category: 'Diagnostic', unit: '', location: '', status: 'Active'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (equipment) {
        await api.put(`/equipment/${equipment._id}`, form);
        toast.success('Equipment updated');
      } else {
        await api.post('/equipment', form);
        toast.success('Equipment added');
      }
      onSave();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error saving equipment');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">{equipment ? 'Edit Equipment' : 'Add Equipment'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input required type="text" className="w-full rounded-lg border-slate-300 border p-2" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
            <input required type="text" className="w-full rounded-lg border-slate-300 border p-2" value={form.serialNumber} onChange={e => setForm({...form, serialNumber: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select className="w-full rounded-lg border-slate-300 border p-2" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="Active">Active</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Offline">Offline</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unit / Department</label>
            <input required type="text" className="w-full rounded-lg border-slate-300 border p-2" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <input required type="text" className="w-full rounded-lg border-slate-300 border p-2" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
          </div>
          <div className="col-span-2 pt-4 flex justify-end space-x-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save Equipment</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FDAModal({ onClose, onSelect }: any) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const res = await api.get(`/external/medicines?search=${query}`);
      setResults(res.data);
    } catch (err) {
      toast.error('No results found or error fetching');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">Import from OpenFDA</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex space-x-2 mb-4">
          <input 
            type="text" 
            placeholder="Search drug generic or brand name..." 
            className="flex-1 rounded-lg border-slate-300 border p-2"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={loading} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-lg">
          {results.length === 0 && !loading && (
            <div className="p-4 text-center text-slate-500 text-sm">No results to display. Search to find medicines.</div>
          )}
          {results.map((r, i) => (
            <div key={i} className="p-3 border-b border-slate-100 hover:bg-slate-50 flex justify-between items-center">
              <div>
                <div className="font-medium text-slate-900">{r.name}</div>
                <div className="text-xs text-slate-500">{r.manufacturer}</div>
              </div>
              <button onClick={() => onSelect(r)} className="text-sm bg-primary-50 text-primary-600 px-3 py-1 rounded hover:bg-primary-100">Select</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
