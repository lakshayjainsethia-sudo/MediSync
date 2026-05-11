import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Calendar, Users, Shield } from 'lucide-react'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-slate-900 mb-6">
            Your Health, Our Priority
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Book appointments with trusted doctors, manage your medical records, and take control of your healthcare journey.
          </p>
          {!user && (
            <Link
              to="/register"
              className="inline-block px-8 py-3 bg-primary-600 text-white rounded-lg text-lg font-semibold hover:bg-primary-700 transition"
            >
              Get Started
            </Link>
          )}
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <Calendar className="h-12 w-12 text-primary-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Easy Booking</h3>
            <p className="text-slate-600">
              Book appointments with doctors in just a few clicks. View available time slots and choose what works for you.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <Users className="h-12 w-12 text-primary-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Trusted Doctors</h3>
            <p className="text-slate-600">
              Connect with verified and experienced healthcare professionals. All doctors are carefully vetted.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <Shield className="h-12 w-12 text-primary-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Secure & Private</h3>
            <p className="text-slate-600">
              Your medical information is encrypted and secure. We prioritize your privacy and data protection.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

