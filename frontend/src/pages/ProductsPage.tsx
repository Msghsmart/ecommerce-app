import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

interface Product {
  id: number
  name: string
  description: string
  price: number
  stock: number
  category: string
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function ProductsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [products, setProducts] = useState<Product[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [orderingId, setOrderingId] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchProducts()
  }, [page, search])

  async function fetchProducts() {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '9' })
    if (search) params.set('search', search)

    const res = await fetch(`/api/products?${params}`)
    const data = await res.json()

    setProducts(data.data)
    setPagination(data.pagination)
    setLoading(false)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    fetchProducts()
  }

  async function handleOrder(product: Product) {
    if (!user) {
      navigate('/login')
      return
    }

    setOrderingId(product.id)
    setMessage('')

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }] }),
    })

    const data = await res.json()
    setOrderingId(null)

    if (!res.ok) {
      setMessage(`Error: ${data.error}`)
    } else {
      setMessage(`Order #${data.id} placed for ${product.name}!`)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Products</h1>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or category..."
          className="border rounded px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setPage(1) }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </form>

      {/* Flash message */}
      {message && (
        <p className={`mb-4 text-sm font-medium ${message.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
          {message}
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : products.length === 0 ? (
        <p className="text-gray-500">No products found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => (
            <div key={product.id} className="border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <h2 className="font-semibold text-gray-800">{product.name}</h2>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                  {product.category}
                </span>
              </div>
              <p className="text-sm text-gray-500 flex-1">{product.description}</p>
              <div className="flex items-center justify-between mt-2">
                <div>
                  <p className="text-lg font-bold text-blue-600">${Number(product.price).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{product.stock} in stock</p>
                </div>
                <button
                  onClick={() => handleOrder(product)}
                  disabled={orderingId === product.id || product.stock === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded text-sm"
                >
                  {orderingId === product.id ? 'Ordering...' : product.stock === 0 ? 'Out of Stock' : 'Buy Now'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-100"
          >
            Prev
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page === pagination.totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-100"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
