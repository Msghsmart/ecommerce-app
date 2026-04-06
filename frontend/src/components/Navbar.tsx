import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
