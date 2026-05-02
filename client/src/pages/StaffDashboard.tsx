import { ClipboardList, CalendarCheck2, ShieldCheck, Activity } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Card, { CardContent, CardHeader } from '../components/ui/Card'
import StatCard from '../components/ui/StatCard'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'

const ROLE_COPY: Record<string, { title: string; description: string }> = {
  nurse: {
    title: 'Nurse Workspace',
    description: 'Monitor patient vitals, assist with appointments, and collaborate with doctors.'
  },
  receptionist: {
    title: 'Reception Desk',
    description: 'Manage patient check-ins, appointments, and front-desk communications.'
  },
  pharmacist: {
    title: 'Pharmacy Console',
    description: 'Track prescriptions, verify treatments, and coordinate with care teams.'
  }
}

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

export default function StaffDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()


  if (!user) {
    return null
  }

  const copy = ROLE_COPY[user.role] ?? {
    title: 'Staff Workspace',
    description: 'Manage day-to-day operations and collaborate with the care team.'
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-primary-600 uppercase tracking-wide">
            Welcome back, {user.name}
          </p>
          <h1 className="text-3xl font-bold text-slate-900">{copy.title}</h1>
          <p className="text-slate-600 max-w-2xl">{copy.description}</p>
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
              {user.role === 'receptionist' && (
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
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

