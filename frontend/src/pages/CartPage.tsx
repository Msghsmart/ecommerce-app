import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

export default function CartPage() {
  const { user } = useAuth()
  const { items, removeFromCart, clearCart } = useCart()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Add up all (price × quantity) to get the cart total
  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  )

  async function handleCheckout() {
    if (!user) {
      navigate('/login')
      return
    }

    setLoading(true)
    setMessage('')

    // Build the items array that order-service expects:
    // [{ productId, quantity }, { productId, quantity }, ...]
    const orderItems = items.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
    }))

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({ items: orderItems }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setMessage(`Error: ${data.error}`)
    } else {
      clearCart()
      setMessage(`Order #${data.id} placed successfully!`)
    }
  }

  if (items.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Your Cart</h1>
        {message ? (
          <p className="text-green-600 font-medium">{message}</p>
        ) : (
          <p className="text-gray-500">Your cart is empty.</p>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Your Cart</h1>

      {/* Cart item list */}
      <div className="flex flex-col gap-3 mb-6">
        {items.map(item => (
          <div
            key={item.product.id}
            className="flex items-center justify-between border rounded-lg px-4 py-3 bg-white shadow-sm"
          >
            <div>
              <p className="font-medium text-gray-800">{item.product.name}</p>
              <p className="text-sm text-gray-500">
                ${Number(item.product.price).toFixed(2)} × {item.quantity}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <p className="font-semibold text-blue-600">
                ${(item.product.price * item.quantity).toFixed(2)}
              </p>
              <button
                onClick={() => removeFromCart(item.product.id)}
                className="text-red-400 hover:text-red-600 text-sm"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Total + checkout */}
      <div className="border-t pt-4 flex items-center justify-between">
        <p className="text-lg font-bold">
          Total: <span className="text-blue-600">${total.toFixed(2)}</span>
        </p>
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-5 py-2 rounded text-sm font-medium"
        >
          {loading ? 'Placing order...' : 'Place Order'}
        </button>
      </div>

      {/* Flash message */}
      {message && (
        <p className={`mt-4 text-sm font-medium ${message.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
