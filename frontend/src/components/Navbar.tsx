import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [adminOpen, setAdminOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAdminOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold tracking-tight">
        ShopApp
      </Link>

      <div className="flex items-center gap-4">
        <Link to="/" className="hover:text-gray-300">
          Products
        </Link>

        {user ? (
          <>
            <Link to="/orders" className="hover:text-gray-300">
              My Orders
            </Link>

            {user.role === 'admin' && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setAdminOpen(o => !o)}
                  className="hover:text-gray-300 flex items-center gap-1"
                >
                  Admin
                  <span className="text-xs">{adminOpen ? '▲' : '▼'}</span>
                </button>

                {adminOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white text-gray-800 rounded shadow-lg z-10">
                    <Link
                      to="/admin/products"
                      onClick={() => setAdminOpen(false)}
                      className="block px-4 py-2 text-sm hover:bg-gray-100"
                    >
                      Manage Products
                    </Link>
                    <Link
                      to="/admin/orders"
                      onClick={() => setAdminOpen(false)}
                      className="block px-4 py-2 text-sm hover:bg-gray-100"
                    >
                      Manage Orders
                    </Link>
                  </div>
                )}
              </div>
            )}

            <span className="text-gray-400 text-sm">Hi, {user.username}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:text-gray-300">
              Login
            </Link>
            <Link
              to="/register"
              className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
