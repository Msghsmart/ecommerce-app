import { createContext, useContext, useState } from 'react'

// The shape of a product we store in the cart
interface CartProduct {
  id: number
  name: string
  price: number
  stock: number
}

// One entry in the cart: a product + how many the user wants
interface CartItem {
  product: CartProduct
  quantity: number
}

// What the context exposes to the rest of the app
interface CartContextType {
  items: CartItem[]
  addToCart: (product: CartProduct) => void
  removeFromCart: (productId: number) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextType | null>(null)

const STORAGE_KEY = 'cart_items'

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Initialize from localStorage so the cart survives a page refresh
  const [items, setItems] = useState<CartItem[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  })

  // Helper: save to state AND localStorage at the same time
  function save(next: CartItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setItems(next)
  }

  function addToCart(product: CartProduct) {
    setItems(current => {
      // If the product is already in the cart, just bump its quantity
      const existing = current.find(item => item.product.id === product.id)
      let next: CartItem[]

      if (existing) {
        next = current.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      } else {
        // Otherwise add it as a new entry with quantity 1
        next = [...current, { product, quantity: 1 }]
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function removeFromCart(productId: number) {
    const next = items.filter(item => item.product.id !== productId)
    save(next)
  }

  function clearCart() {
    save([])
  }

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

// Custom hook — any component can do: const { items, addToCart } = useCart()
export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
