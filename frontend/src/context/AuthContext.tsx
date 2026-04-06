import { createContext, useContext, useState } from 'react'

// Shape of the logged-in user
interface User {
  id: number
  username: string
  role: 'customer' | 'admin'
  token: string
}

// Shape of what the context provides to the rest of the app
interface AuthContextType {
  user: User | null
  login: (user: User) => void
  logout: () => void
}

// Create the context with a default of null
const AuthContext = createContext<AuthContextType | null>(null)

const STORAGE_KEY = 'auth_user'

// Provider wraps the whole app and holds the user state
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  })

  function login(user: User) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    setUser(user)
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook so any component can do: const { user } = useAuth()
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
