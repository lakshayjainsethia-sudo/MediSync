import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { 
  Bell, 
  User, 
  LogOut, 
  Menu, 
  X,
  Stethoscope
} from 'lucide-react'
import { notificationsApi } from '../../utils/api'
import { Notification } from '../../types'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (user) {
      fetchNotifications()
      fetchUnreadCount()
      const interval = setInterval(() => {
        fetchUnreadCount()
      }, 30000) // Check every 30 seconds
      return () => clearInterval(interval)
    }
  }, [user])

  const fetchNotifications = async () => {
    try {
      const response = await notificationsApi.getAll({ limit: 10 })
      setNotifications(response.data)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    }
  }

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsApi.getUnreadCount()
      setUnreadCount(response.data.count)
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id)
      fetchNotifications()
      fetchUnreadCount()
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const getDashboardPath = () => {
    if (!user) return '/'
    return `/${user.role}/dashboard`
  }

  return (
    <header className="bg-white/70 backdrop-blur-md shadow-sm border-b border-white/50 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <Stethoscope className="h-8 w-8 text-primary-600" />
              <span className="text-2xl font-bold text-primary-600">MediSync</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          {user && (
            <nav className="hidden md:flex items-center space-x-6">
              <Link
                to={getDashboardPath()}
                className="text-gray-700 hover:text-primary-600 transition-colors"
              >
                Dashboard
              </Link>
              {user.role === 'patient' && (
                <>
                  <Link
                    to="/doctors"
                    className="text-gray-700 hover:text-primary-600 transition-colors"
                  >
                    Doctors
                  </Link>
                  <Link
                    to="/appointments"
                    className="text-gray-700 hover:text-primary-600 transition-colors"
                  >
                    Appointments
                  </Link>
                </>
              )}
              {user.role === 'doctor' && (
                <Link
                  to="/appointments"
                  className="text-gray-700 hover:text-primary-600 transition-colors"
                >
                  Appointments
                </Link>
              )}
              {['admin', 'receptionist'].includes(user.role) && (
                <Link
                  to="/billing"
                  className="text-gray-700 hover:text-primary-600 transition-colors"
                >
                  Billing
                </Link>
              )}
              {user.role === 'admin' && (
                <>
                  <Link
                    to="/admin/users"
                    className="text-gray-700 hover:text-primary-600 transition-colors"
                  >
                    Users
                  </Link>
                </>
              )}

            </nav>
          )}

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {/* Notifications */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowNotifications(!showNotifications)
                      setShowUserMenu(false)
                    }}
                    className="relative p-2 text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    <Bell className="h-6 w-6" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={async () => {
                              await notificationsApi.markAllAsRead()
                              fetchNotifications()
                              fetchUnreadCount()
                            }}
                            className="text-sm text-primary-600 hover:text-primary-700"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                      <div className="divide-y divide-gray-200">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center text-gray-500">
                            No notifications
                          </div>
                        ) : (
                          notifications.map((notification) => (
                            <div
                              key={notification._id}
                              className={`p-4 hover:bg-gray-50 cursor-pointer ${
                                !notification.read ? 'bg-primary-50' : ''
                              }`}
                              onClick={() => {
                                if (!notification.read) {
                                  handleMarkAsRead(notification._id)
                                }
                                if (notification.actionUrl) {
                                  navigate(notification.actionUrl)
                                }
                                setShowNotifications(false)
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">
                                    {notification.title}
                                  </p>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {new Date(notification.createdAt || '').toLocaleString()}
                                  </p>
                                </div>
                                {!notification.read && (
                                  <div className="ml-2 h-2 w-2 rounded-full bg-primary-600" />
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowUserMenu(!showUserMenu)
                      setShowNotifications(false)
                    }}
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-gray-700">
                      {user.name}
                    </span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="py-1">
                        <Link
                          to="/profile"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-2" />
                            Profile
                          </div>
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <div className="flex items-center">
                            <LogOut className="h-4 w-4 mr-2" />
                            Logout
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-primary-600 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-primary-600"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && user && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-2">
              <Link
                to={getDashboardPath()}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              {user.role === 'patient' && (
                <>
                  <Link
                    to="/doctors"
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Doctors
                  </Link>
                  <Link
                    to="/appointments"
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Appointments
                  </Link>
                </>
              )}
              {user.role === 'doctor' && (
                <Link
                  to="/appointments"
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Appointments
                </Link>
              )}
              {['admin', 'receptionist'].includes(user.role) && (
                <Link
                  to="/billing"
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Billing
                </Link>
              )}
              {user.role === 'admin' && (
                <>
                  <Link
                    to="/admin/users"
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Users
                  </Link>
                </>
              )}

            </nav>
          </div>
        )}
      </div>

      {/* Click outside to close menus */}
      {(showNotifications || showUserMenu) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowNotifications(false)
            setShowUserMenu(false)
          }}
        />
      )}
    </header>
  )
}


