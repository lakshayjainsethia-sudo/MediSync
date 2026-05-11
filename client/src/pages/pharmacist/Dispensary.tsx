import React, { useState, useEffect, useRef } from 'react';
import { pharmacistApi } from '../../utils/api';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Search, ChevronLeft, ChevronRight, Pill, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import api from '../../utils/api';

export default function Dispensary() {
  // Left Panel State
  const [medicines, setMedicines] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState<'All' | 'Low Stock' | 'Out of Stock'>('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Right Panel State
  const [selectedMedicine, setSelectedMedicine] = useState<any | null>(null);
  const [dispenseQuantity, setDispenseQuantity] = useState(1);
  const [pendingPrescriptions, setPendingPrescriptions] = useState<any[]>([]);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string>('');
  const [dispensing, setDispensing] = useState(false);

  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    fetchMedicines();
  }, [page, category, stockFilter]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      fetchMedicines();
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  useEffect(() => {
    fetchPendingPrescriptions();
  }, []);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      if (searchQuery) params.append('q', searchQuery);
      if (category !== 'All') params.append('category', category);
      if (stockFilter === 'Low Stock') params.append('stock', 'low');
      if (stockFilter === 'Out of Stock') {
         // The backend doesn't have a direct 'out' filter, but we can filter it on client side if needed
         // or we just fetch and filter. For now we fetch with 'low' and filter client side.
         params.append('stock', 'low'); 
      }

      const res = await api.get(`/medicines?${params.toString()}`);
      let data = res.data?.data || [];
      
      if (stockFilter === 'Out of Stock') {
        data = data.filter((m: any) => m.currentStock === 0);
      }

      setMedicines(data);
      setTotalPages(res.data?.pages || 1);
    } catch (err) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingPrescriptions = async () => {
    try {
      const res = await pharmacistApi.getPendingPrescriptions();
      setPendingPrescriptions(res.data || []);
    } catch (err) {
      console.error('Failed to fetch pending prescriptions');
    }
  };

  const refetchSingleMedicine = async (id: string) => {
    try {
      const res = await api.get(`/medicines/${id}`);
      const updatedMed = res.data;
      setMedicines(prev => prev.map(m => m._id === id ? { ...m, ...updatedMed, currentStock: updatedMed.stockQuantity } : m));
      if (selectedMedicine?._id === id) {
        setSelectedMedicine({ ...updatedMed, currentStock: updatedMed.stockQuantity });
      }
    } catch (err) {
      console.error('Failed to refetch medicine', err);
    }
  };

  const handleQuickDispenseClick = (med: any) => {
    setSelectedMedicine(med);
    setDispenseQuantity(1);
    setSelectedPrescriptionId('');
  };

  const handleDispense = async () => {
    if (!selectedMedicine) return;
    if (dispenseQuantity < 1 || dispenseQuantity > selectedMedicine.currentStock) {
      toast.error('Invalid quantity');
      return;
    }

    setDispensing(true);
    try {
      if (selectedPrescriptionId) {
        // Linked dispense
        await pharmacistApi.dispensePrescription(selectedPrescriptionId, {
          medicinesToDispense: [{ medicineId: selectedMedicine._id, quantity: dispenseQuantity }]
        });
        toast.success(`Dispensed ${dispenseQuantity} units of ${selectedMedicine.name}`);
        // Optimistic update
        const newStock = selectedMedicine.currentStock - dispenseQuantity;
        setMedicines(prev => prev.map(m => m._id === selectedMedicine._id ? { ...m, currentStock: newStock } : m));
        
        if (newStock <= selectedMedicine.minimumThreshold) {
          toast.warning(`⚠ Stock now low — ${newStock} units remaining`);
        }
        
        // Targeted refetch
        await refetchSingleMedicine(selectedMedicine._id);
        
        setSelectedMedicine(null);
        // Remove from pending prescriptions list
        setPendingPrescriptions(prev => prev.filter(p => p._id !== selectedPrescriptionId));
        setSelectedPrescriptionId('');
      } else {
        // Standalone dispense
        await api.patch(`/medicines/${selectedMedicine._id}/standalone-dispense`, {
          quantity: dispenseQuantity
        });
        toast.success(`Dispensed ${dispenseQuantity} units of ${selectedMedicine.name}`);
        
        const newStock = selectedMedicine.currentStock - dispenseQuantity;
        if (newStock <= selectedMedicine.minimumThreshold) {
          toast.warning(`⚠ Stock now low — ${newStock} units remaining`);
        }

        // Optimistic update
        setMedicines(prev => prev.map(m => m._id === selectedMedicine._id ? { ...m, currentStock: newStock } : m));
        
        // Targeted refetch
        await refetchSingleMedicine(selectedMedicine._id);
        
        setSelectedMedicine(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to dispense medicine');
    } finally {
      setDispensing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6">
        
        {/* LEFT PANEL */}
        <div className="w-full md:w-[60%] flex flex-col space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Pill className="text-primary-600 h-6 w-6" /> Dispensary
            </h1>
          </div>

          <Card className="p-4 bg-white shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search medicine..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Tablet">Tablet</option>
                <option value="Syrup">Syrup</option>
                <option value="Injection">Injection</option>
                <option value="Capsule">Capsule</option>
                <option value="Ointment">Ointment</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {['All', 'Low Stock', 'Out of Stock'].map(f => (
                <button
                  key={f}
                  onClick={() => setStockFilter(f as any)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    stockFilter === f 
                      ? 'bg-primary-100 text-primary-700 border border-primary-300' 
                      : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-500">Loading inventory...</div>
            ) : medicines.length === 0 ? (
              <div className="py-12 text-center text-slate-500">No medicines found.</div>
            ) : (
              <div className="space-y-3">
                {medicines.map((med) => {
                  const percent = Math.min(100, (med.currentStock / (med.minimumThreshold * 3)) * 100);
                  const isOut = med.currentStock === 0;
                  const isLow = !isOut && med.currentStock <= med.minimumThreshold;
                  
                  return (
                    <div key={med._id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl border border-slate-200 hover:shadow-md transition-shadow bg-white">
                      <div className="flex-1 w-full mb-3 sm:mb-0 pr-4">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold text-slate-800">{med.name}</h3>
                          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{med.category}</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">Unit: {med.unit || 'units'}</p>
                        
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1">
                          <div 
                            className={`h-1.5 rounded-full ${isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                        <p className={`text-xs font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-600'}`}>
                          {med.currentStock} units {isLow && '- Low stock'} {isOut && '- Out of stock'}
                        </p>
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full sm:w-auto border-primary-200 text-primary-700 hover:bg-primary-50 whitespace-nowrap"
                        onClick={() => handleQuickDispenseClick(med)}
                      >
                        Quick Dispense
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
                <Button 
                  size="sm" 
                  variant="outline" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <span className="text-sm text-slate-600 font-medium">Page {page} of {totalPages}</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-full md:w-[40%] flex flex-col">
          <div className="sticky top-6">
            {!selectedMedicine ? (
              <Card className="p-8 text-center flex flex-col items-center justify-center min-h-[400px] border-dashed border-2 bg-slate-50/50">
                <div className="h-20 w-20 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mb-6">
                  <Pill className="h-10 w-10" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-2">Ready to Dispense</h3>
                <p className="text-slate-500 text-sm max-w-[250px]">
                  Select a medicine from the list to dispense or link it to a pending prescription.
                </p>
              </Card>
            ) : (
              <Card className="overflow-hidden border-2 border-primary-100 shadow-lg">
                <div className="bg-primary-50 p-6 border-b border-primary-100">
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="text-2xl font-bold text-slate-800">{selectedMedicine.name}</h2>
                    <button onClick={() => setSelectedMedicine(null)} className="text-slate-400 hover:text-slate-600">
                      <XCircle className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {selectedMedicine.currentStock === 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <AlertCircle className="h-3 w-3 mr-1" /> Out of Stock
                      </span>
                    ) : selectedMedicine.currentStock <= selectedMedicine.minimumThreshold ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        <AlertCircle className="h-3 w-3 mr-1" /> Low Stock ({selectedMedicine.currentStock})
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        <CheckCircle className="h-3 w-3 mr-1" /> In Stock ({selectedMedicine.currentStock})
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {selectedMedicine.currentStock === 0 ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium text-center">
                      Out of stock — cannot dispense
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Quantity to Dispense</label>
                        <input
                          type="number"
                          min="1"
                          max={selectedMedicine.currentStock}
                          value={dispenseQuantity}
                          onChange={(e) => setDispenseQuantity(parseInt(e.target.value) || 1)}
                          className="w-full text-lg p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                        />
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Link to Prescription (optional)</label>
                        <select
                          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm text-slate-700"
                          value={selectedPrescriptionId}
                          onChange={(e) => setSelectedPrescriptionId(e.target.value)}
                        >
                          {pendingPrescriptions.length === 0 ? (
                            <option value="">No pending prescriptions — dispense as standalone</option>
                          ) : (
                            <>
                              <option value="">Standalone Dispense (No Prescription)</option>
                              {pendingPrescriptions.map(p => {
                                const minAgo = Math.floor((Date.now() - new Date(p.completedAt || p.date).getTime()) / 60000);
                                return (
                                  <option key={p._id} value={p._id}>
                                    {p.patient?.name} — Dr. {p.doctor?.name} — {minAgo > 0 ? `${minAgo} mins ago` : 'Just now'}
                                  </option>
                                );
                              })}
                            </>
                          )}
                        </select>
                      </div>

                      <Button
                        onClick={handleDispense}
                        disabled={dispensing}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 text-lg font-bold shadow-md shadow-emerald-600/20"
                      >
                        {dispensing ? 'Processing...' : (selectedPrescriptionId ? 'Dispense to Patient' : 'Standalone Dispense')}
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
