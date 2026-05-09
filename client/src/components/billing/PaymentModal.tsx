import { useState } from 'react'
import { billingApi } from '../../utils/api'
import { Billing } from '../../types'
import { toast } from 'react-toastify'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Button from '../ui/Button'

interface PaymentModalProps {
  bill: Billing
  onClose: () => void
  onSuccess: () => void
}

export default function PaymentModal({ bill, onClose, onSuccess }: PaymentModalProps) {
  const [formData, setFormData] = useState({
    amount: bill.total - (bill.payments?.reduce((sum, p) => sum + p.amount, 0) || 0),
    method: 'cash' as 'cash' | 'card' | 'insurance' | 'online' | 'other',
    transactionId: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.amount <= 0) {
      toast.error('Payment amount must be greater than 0')
      return
    }

    if (formData.amount > bill.total) {
      toast.error('Payment amount cannot exceed total bill amount')
      return
    }

    setLoading(true)
    try {
      await billingApi.recordPayment(bill._id, {
        amount: formData.amount,
        method: formData.method,
        transactionId: formData.transactionId || undefined
      })
      toast.success('Payment recorded successfully')
      onSuccess()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to record payment')
    } finally {
      setLoading(false)
    }
  }

  const remainingBalance = bill.total - (bill.payments?.reduce((sum, p) => sum + p.amount, 0) || 0)

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Record Payment"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Invoice Number:</span>
            <span className="font-medium">{bill.invoiceNumber}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Total Amount:</span>
            <span className="font-medium">₹{bill.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Already Paid:</span>
            <span className="font-medium">₹{(bill.payments?.reduce((sum, p) => sum + p.amount, 0) || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="text-sm font-semibold text-gray-900">Remaining Balance:</span>
            <span className="text-lg font-bold text-primary-600">₹{remainingBalance.toFixed(2)}</span>
          </div>
        </div>

        <Input
          label="Payment Amount"
          type="number"
          step="0.01"
          min="0.01"
          max={remainingBalance}
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
          <select
            value={formData.method}
            onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            required
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="insurance">Insurance</option>
            <option value="online">Online</option>
            <option value="other">Other</option>
          </select>
        </div>

        <Input
          label="Transaction ID (Optional)"
          type="text"
          value={formData.transactionId}
          onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
          placeholder="Enter transaction ID if applicable"
        />

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  )
}



