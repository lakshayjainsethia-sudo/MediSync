import { useState, useEffect } from 'react'
import { ClipboardList, CalendarCheck2, ShieldCheck, Activity, Trash2, Plus, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { toast } from 'react-toastify'
import Card, { CardContent, CardHeader } from '../components/ui/Card'
import StatCard from '../components/ui/StatCard'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { receptionistApi, billingApi } from '../utils/api'

const QUICK_ACTIONS = [
  {
    title: 'Upcoming Appointments',
    description: 'Review what’s scheduled for today and prepare in advance.',
    icon: <CalendarCheck2 className="h-5 w-5 text-primary-600" />,
    href: '/appointments'
  },
  {
    title: 'Billing Overview',
    description: 'Keep tabs on outstanding invoices and payments.',
    icon: <ClipboardList className="h-5 w-5 text-primary-600" />,
    href: '/billing'
  }
]

export default function ReceptionistDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [billingQueue, setBillingQueue] = useState<any[]>([])
  const [additionalCharges, setAdditionalCharges] = useState<Record<string, any[]>>({})
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchBillingQueue()

    const socket = io('/', { path: '/socket.io' })
    socket.emit('join', 'receptionists')

    socket.on('medicine_bill_ready', (data) => {
      if (data.billingType === 'ConsultationOnly') {
        toast.info(`💰 Ready to bill: ${data.patientName} — Consultation only`)
      } else {
        toast.info(`💰 Ready to bill: ${data.patientName} — Medicine total: ₹${data.medicineSubtotal}`)
      }
      fetchBillingQueue()
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const fetchBillingQueue = async () => {
    try {
      const res = await receptionistApi.getBillingQueue()
      setBillingQueue(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleGenerateFinalBill = async (appointmentId: string) => {
    try {
      const charges = additionalCharges[appointmentId] || []
      const res = await billingApi.generateFinal(
        { appointmentId, additionalCharges: charges }
      )
      
      const billNumber = res.data.bill.invoiceNumber || res.data.bill._id
      const totalAmount = res.data.bill.totalAmount
      
      toast.success(`✓ Bill #${billNumber} generated — ₹${totalAmount}`)
      setBillingQueue(prev => prev.filter(a => a._id !== appointmentId))
      
      navigate(`/billing/${res.data.bill._id}`)
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.message.includes('already generated')) {
        toast.info('Bill was already generated — please check billing list')
        setBillingQueue(prev => prev.filter(a => a._id !== appointmentId))
      } else {
        toast.error(err.response?.data?.message || 'Failed to generate bill')
      }
    }
  }

  const addChargeRow = (appointmentId: string) => {
    const list = additionalCharges[appointmentId] || []
    setAdditionalCharges(prev => ({
      ...prev,
      [appointmentId]: [...list, { description: '', amount: '' }]
    }))
  }

  const updateChargeRow = (appointmentId: string, index: number, field: string, value: string) => {
    const list = [...(additionalCharges[appointmentId] || [])]
    list[index] = { ...list[index], [field]: value }
    setAdditionalCharges(prev => ({
      ...prev,
      [appointmentId]: list
    }))
  }

  const removeChargeRow = (appointmentId: string, index: number) => {
    const list = [...(additionalCharges[appointmentId] || [])]
    list.splice(index, 1)
    setAdditionalCharges(prev => ({
      ...prev,
      [appointmentId]: list
    }))
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-primary-600 uppercase tracking-wide">
            Welcome back, {user.name}
          </p>
          <h1 className="text-3xl font-bold text-slate-900">Reception Desk</h1>
          <p className="text-slate-600 max-w-2xl">Manage patient check-ins, appointments, and front-desk communications.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <StatCard
            title="System Access"
            value="Operational"
            subtitle="Core tools ready to use"
            icon={<ShieldCheck className="h-8 w-8 text-emerald-500 opacity-20" />}
          />
        </div>

        <Card>
          <CardHeader
            title="Quick Actions"
            subtitle="Jump into the most relevant areas while dedicated workflows are coming soon."
          />
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {QUICK_ACTIONS.map((action) => (
                <Card key={action.title} className="border border-gray-100 shadow-sm" padding="lg" hover>
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-primary-50">
                      {action.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{action.title}</h3>
                      <p className="text-sm text-slate-600 mt-1">{action.description}</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(action.href)}>
                        Open
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              <Card className="border border-red-100 shadow-sm bg-red-50/50" padding="lg" hover>
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <Activity className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-red-900">Triage Queue</h3>
                    <p className="text-sm text-slate-600 mt-1">Smart AI routing & emergencies.</p>
                    <Button variant="outline" size="sm" className="mt-3 border-red-200 hover:bg-red-50 text-red-700" onClick={() => navigate('/triage')}>
                      Open Priorities
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* BILLING QUEUE SECTION */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Billing Queue</h2>
          {billingQueue.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-2">
              <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-lg text-slate-500 font-medium">No patients waiting for billing</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {billingQueue.map(apt => {
                const docFee = apt.doctor?.consultationFee || 0;
                const medSub = apt.medicineBill?.subtotal || 0;
                const charges = additionalCharges[apt._id] || [];
                const validChargesTotal = charges.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
                const total = docFee + medSub + validChargesTotal;
                const isExpanded = expandedCards[apt._id] || false;

                const waitMins = Math.floor((Date.now() - new Date(apt.medicineBill?.generatedAt || apt.createdAt).getTime()) / 60000);

                return (
                  <Card key={apt._id} className="p-6 border-l-4 border-l-emerald-500">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Patient Info */}
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{apt.patient?.name}</h3>
                        <p className="text-sm text-slate-600 mt-1">Dr. {apt.doctor?.name} ({apt.doctor?.specialization})</p>
                        <div className="flex items-center text-xs text-amber-600 mt-3 font-medium">
                          <Clock className="w-3 h-3 mr-1" />
                          Waiting {waitMins} mins for billing
                        </div>
                      </div>

                      {/* Bill Preview */}
                      <div className="bg-slate-50 rounded p-4 border border-slate-100 col-span-1 lg:col-span-2">
                        <div className="space-y-2 mb-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Consultation Fee</span>
                            <span className="font-medium">₹{docFee.toLocaleString('en-IN')}</span>
                          </div>
                          
                          {apt.billingType === 'WithMedicines' ? (
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Medicines</span>
                              {apt.medicineBill?.items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-slate-600 pl-2">
                                  <span>{item.medicineName} (x{item.quantity})</span>
                                  <span>₹{item.total.toLocaleString('en-IN')}</span>
                                </div>
                              ))}
                              <div className="flex justify-between font-medium mt-1 pl-2">
                                <span>Medicine Subtotal</span>
                                <span>₹{medSub.toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <span className="text-slate-500 italic text-xs">No medicines prescribed</span>
                            </div>
                          )}

                          {charges.map((charge, idx) => (
                            <div key={idx} className="flex justify-between text-slate-600 pl-2">
                              <span>{charge.description || 'Extra Charge'}</span>
                              <span>₹{(Number(charge.amount) || 0).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-between items-center border-t border-slate-200 pt-3">
                          <span className="text-lg font-bold text-slate-900">Estimated Total</span>
                          <span className="text-xl font-bold text-emerald-600">₹{total.toLocaleString('en-IN')}</span>
                        </div>

                        {/* Additional Charges Collapsible */}
                        <div className="mt-4">
                          <button 
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center"
                            onClick={() => setExpandedCards(prev => ({ ...prev, [apt._id]: !isExpanded }))}
                          >
                            <Plus className="w-4 h-4 mr-1" /> {isExpanded ? 'Hide Extra Charges' : 'Add Extra Charges'}
                          </button>
                          
                          {isExpanded && (
                            <div className="mt-3 space-y-3 bg-white p-3 rounded border border-slate-200">
                              {charges.map((charge, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <input 
                                    type="text" 
                                    placeholder="Description (e.g. X-Ray)" 
                                    value={charge.description}
                                    onChange={(e) => updateChargeRow(apt._id, idx, 'description', e.target.value)}
                                    className="flex-1 text-sm border-gray-300 rounded px-2 py-1"
                                  />
                                  <input 
                                    type="number" 
                                    placeholder="₹ Amount" 
                                    value={charge.amount}
                                    onChange={(e) => updateChargeRow(apt._id, idx, 'amount', e.target.value)}
                                    className="w-24 text-sm border-gray-300 rounded px-2 py-1"
                                  />
                                  <button onClick={() => removeChargeRow(apt._id, idx)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                              <Button variant="outline" size="sm" onClick={() => addChargeRow(apt._id)}>
                                Add Row
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="mt-5 flex justify-end">
                          <Button onClick={() => handleGenerateFinalBill(apt._id)} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">
                            Generate Final Bill →
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
