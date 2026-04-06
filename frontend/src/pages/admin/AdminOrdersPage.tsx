import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  userId: number;
  total: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/");
      return;
    }
    fetchOrders();
  }, [user]);

  async function fetchOrders() {
    const res = await fetch("/api/orders/all", {
      headers: { Authorization: `Bearer ${user!.token}` },
    });
    const data = await res.json();
    setOrders(data);
    setLoading(false);
  }

  async function handleStatusChange(orderId: number, status: string) {
    setMessage("");

    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user!.token}`,
      },
      body: JSON.stringify({ status }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(`Error: ${data.error}`);
      return;
    }

    setOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, status: data.status } : o))
    );
    setMessage(`Order #${orderId} updated to "${status}".`);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin — Orders</h1>

      {message && (
        <p className={`mb-4 text-sm font-medium ${message.startsWith("Error") ? "text-red-500" : "text-green-600"}`}>
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-500">No orders yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map(order => (
            <div key={order.id} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold">Order #{order.id}</p>
                  <p className="text-xs text-gray-400">User ID: {order.userId}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded font-medium capitalize ${statusColors[order.status] || "bg-gray-100 text-gray-600"}`}>
                    {order.status}
                  </span>
                  <p className="font-bold text-blue-600">${Number(order.total).toFixed(2)}</p>
                </div>
              </div>

              {/* Items */}
              <table className="w-full text-sm mb-3">
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

              {/* Status updater */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Update status:</label>
                <select
                  defaultValue={order.status}
                  onChange={e => handleStatusChange(order.id, e.target.value)}
                  className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {validStatuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
