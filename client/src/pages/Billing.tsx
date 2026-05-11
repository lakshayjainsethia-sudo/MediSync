import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { billingApi } from '../utils/api'
import { Billing as BillingType } from '../types'
import { toast } from 'react-toastify'
import { Receipt, Calendar, Search, CheckCircle, Clock, XCircle } from 'lucide-react'
import Card, { CardContent } from '../components/ui/Card'
import Button from '../components/ui/Button'
import PaymentModal from '../components/billing/PaymentModal'
import { format } from 'date-fns'

export default function Billing() {
  const { user } = useAuth()
  const [bills, setBills] = useState<BillingType[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBill, setSelectedBill] = useState<BillingType | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchBills()
  }, [])

  const fetchBills = async () => {
    try {
      setLoading(true)
      const response = await billingApi.getMine()
      setBills(response.data)
    } catch (error) {
      console.error('Failed to fetch bills:', error)
      toast.error('Failed to load bills')
    } finally {
      setLoading(false)
    }
  }

  const filteredBills = bills.filter(bill =>
    bill.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />
      case 'partial':
        return <Clock className="h-5 w-5 text-blue-600" />
      default:
        return <XCircle className="h-5 w-5 text-red-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700'
      case 'pending':
        return 'bg-yellow-100 text-yellow-700'
      case 'partial':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-red-100 text-red-700'
    }
  }

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
          <h1 className="text-3xl font-bold text-slate-900">Billing</h1>
          <p className="text-slate-600 mt-1">View and manage invoices</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Bills List */}
        {filteredBills.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No bills found</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredBills.map((bill) => {
              const patient = typeof bill.patient === 'object' ? bill.patient : null
              
              return (
                <Card key={bill._id} hover>
                  <CardContent>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          {bill.invoiceNumber}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-slate-600">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {format(new Date(bill.createdAt || ''), 'MMM dd, yyyy')}
                          </div>
                          {patient && user?.role !== 'patient' && (
                            <div className="flex items-center">
                              <span>{patient.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(bill.paymentStatus)}
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(bill.paymentStatus)}`}>
                          {bill.paymentStatus}
                        </span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-slate-600">Subtotal:</span>
                        <span className="font-medium">${bill.subtotal.toFixed(2)}</span>
                      </div>
                      {bill.tax > 0 && (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-slate-600">Tax:</span>
                          <span className="font-medium">${bill.tax.toFixed(2)}</span>
                        </div>
                      )}
                      {bill.discount > 0 && (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-slate-600">Discount:</span>
                          <span className="font-medium text-green-600">-${bill.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-lg font-semibold text-slate-900">Total:</span>
                        <span className="text-lg font-bold text-primary-600">${bill.total.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Items:</p>
                      <div className="space-y-1">
                        {bill.items.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span className="text-slate-600">{item.description} (x{item.quantity})</span>
                            <span className="font-medium">${item.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedBill(bill)
                        }}
                      >
                        View Details
                      </Button>
                      {bill.paymentStatus !== 'paid' && (user?.role === 'admin' || user?.role === 'receptionist') && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedBill(bill)
                            setShowPaymentModal(true)
                          }}
                        >
                          Record Payment
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <PaymentModal
          bill={selectedBill}
          onClose={() => {
            setShowPaymentModal(false)
            setSelectedBill(null)
          }}
          onSuccess={() => {
            fetchBills()
            setShowPaymentModal(false)
            setSelectedBill(null)
          }}
        />
      )}
    </div>
  )
}

