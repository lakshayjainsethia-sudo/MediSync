import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Eye, IndianRupee, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import BillingForm from './BillingForm';
import { useNavigate } from 'react-router-dom';

export default function BillingList() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [paymentModal, setPaymentModal] = useState<any>(null);
  const navigate = useNavigate();

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`http://localhost:5000/api/billing?status=${statusFilter}`, {
        withCredentials: true
      });
      setBills(res.data);
    } catch (err) {
      console.error('Failed to fetch bills', err);
      toast.error('Failed to load billing records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [statusFilter]);

  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal) return;

    // Optimistic Update
    const prevBills = [...bills];
    setBills(prevBills.map(b => b._id === paymentModal.id ? { ...b, status: 'Paid', paymentMethod: paymentModal.method } : b));
    setPaymentModal(null);

    try {
      await axios.patch(`http://localhost:5000/api/billing/${paymentModal.id}/status`, {
        status: 'Paid',
        paymentMethod: paymentModal.method
      }, { withCredentials: true });
      toast.success('Payment recorded successfully');
    } catch (err) {
      console.error('Failed to mark paid', err);
      toast.error('Failed to record payment. Rolling back.');
      setBills(prevBills);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Draft': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Draft</span>;
      case 'Unpaid': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Unpaid</span>;
      case 'Paid': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Paid</span>;
      default: return null;
    }
  };

  if (showAddForm) {
    return <BillingForm onBack={() => { setShowAddForm(false); fetchBills(); }} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <IndianRupee className="text-emerald-600" /> Billing Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage patient invoices and payments</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition"
        >
          <Plus size={16} /> Create New Bill
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50">
          <div className="relative w-full sm:w-64">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
             <input 
               type="text" 
               placeholder="Search by Bill No..." 
               className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
             />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
             <div className="p-8 text-center text-gray-500">Loading bills...</div>
          ) : bills.length === 0 ? (
             <div className="p-8 text-center text-gray-500">No bills found matching your criteria.</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Bill No</th>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Doctor</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bills.map((bill) => (
                  <tr key={bill._id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4 font-mono font-medium text-gray-900">{bill.billNumber || bill.invoiceNumber || 'Pending'}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{bill.patient?.name}</div>
                      <div className="text-xs text-gray-500">{bill.patient?.email}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">Dr. {bill.doctor?.name || 'Doctor'}</td>
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                      {format(new Date(bill.createdAt), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900 whitespace-nowrap">
                      ₹{bill.totalAmount?.toLocaleString('en-IN') || 0}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(bill.status || bill.paymentStatus)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          title="View Invoice"
                          onClick={() => navigate(`/billing/${bill._id}`)}
                          className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 transition"
                        >
                          <Eye size={16} />
                        </button>

                        {(bill.status === 'Unpaid' || bill.paymentStatus === 'Unpaid') && (
                          <button
                            title="Mark as Paid"
                            onClick={() => setPaymentModal({ id: bill._id, method: 'Cash' })}
                            className="bg-emerald-500 font-medium text-white px-3 py-1.5 text-xs rounded shadow-sm hover:bg-emerald-600 transition tracking-wide"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Payment Confirmation Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-emerald-50/50">
               <h3 className="font-bold text-gray-800">Confirm Payment</h3>
            </div>
            <form onSubmit={handleMarkPaid}>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select 
                    value={paymentModal.method}
                    onChange={e => setPaymentModal({ ...paymentModal, method: e.target.value })}
                    className="w-full text-sm border-gray-300 rounded-lg focus:ring-emerald-500 py-2 border outline-none px-3"
                    required
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Insurance">Insurance</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  Confirming will permanently mark this bill as paid and lock further modifications.
                </p>
              </div>
              <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                <button 
                  type="button" 
                  onClick={() => setPaymentModal(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >Cancel</button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm"
                >Confirm Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
