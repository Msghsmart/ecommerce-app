import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

interface OrderItem {
  id: number
  productId: number
  quantity: number
  price: number
}

interface Order {
  id: number
  total: number
  status: string
  createdAt: string
  items: OrderItem[]
}

export default function OrdersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    fetchOrders()
  }, [user])

  async function fetchOrders() {
    const res = await fetch('/api/orders', {
      headers: { Authorization: `Bearer ${user!.token}` },
    })
    const data = await res.json()
    setOrders(data)
    setLoading(false)
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-500">You haven't placed any orders yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map(order => (
            <div key={order.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold">Order #{order.id}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded font-medium capitalize ${statusColors[order.status] || 'bg-gray-100 text-gray-600'}`}>
                    {order.status}
                  </span>
                  <p className="font-bold text-blue-600">${Number(order.total).toFixed(2)}</p>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b">
                    <th className="pb-1">Product ID</th>
                    <th className="pb-1">Qty</th>
                    <th className="pb-1">Unit Price</th>
                    <th className="pb-1 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map(item => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-1 text-gray-600">#{item.productId}</td>
                      <td className="py-1">{item.quantity}</td>
                      <td className="py-1">${Number(item.price).toFixed(2)}</td>
                      <td className="py-1 text-right">${(Number(item.price) * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
