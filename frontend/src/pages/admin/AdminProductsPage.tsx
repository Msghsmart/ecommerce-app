import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
}

const emptyForm = { name: "", description: "", price: "", stock: "", category: "" };

export default function AdminProductsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/");
      return;
    }
    fetchProducts();
  }, [user]);

  async function fetchProducts() {
    const res = await fetch("/api/products?limit=100");
    const data = await res.json();
    setProducts(data.data);
    setLoading(false);
  }

  function handleEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      stock: String(product.stock),
      category: product.category,
    });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const body = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      stock: parseInt(form.stock),
      category: form.category,
    };

    const url = editingId ? `/api/products/${editingId}` : "/api/products";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user!.token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(`Error: ${data.error}`);
      return;
    }

    setMessage(editingId ? "Product updated." : "Product created.");
    setEditingId(null);
    setForm(emptyForm);
    fetchProducts();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this product?")) return;

    const res = await fetch(`/api/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${user!.token}` },
    });

    if (res.ok) {
      setMessage("Product deleted.");
      fetchProducts();
    } else {
      const data = await res.json();
      setMessage(`Error: ${data.error}`);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin — Products</h1>

      {/* Form */}
      <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
        <h2 className="font-semibold mb-3">{editingId ? "Edit Product" : "Add Product"}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <input
            placeholder="Name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
            className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Category"
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Price"
            type="number"
            step="0.01"
            value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })}
            required
            className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Stock"
            type="number"
            value={form.stock}
            onChange={e => setForm({ ...form, stock: e.target.value })}
            className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Description"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="border rounded px-3 py-2 text-sm col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="col-span-2 flex gap-2">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            >
              {editingId ? "Update" : "Create"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="border px-4 py-2 rounded text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {message && (
        <p className={`mb-4 text-sm font-medium ${message.startsWith("Error") ? "text-red-500" : "text-green-600"}`}>
          {message}
        </p>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Category</th>
                <th className="text-left px-4 py-2">Price</th>
                <th className="text-left px-4 py-2">Stock</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{product.name}</td>
                  <td className="px-4 py-2 text-gray-500">{product.category}</td>
                  <td className="px-4 py-2">${Number(product.price).toFixed(2)}</td>
                  <td className="px-4 py-2">{product.stock}</td>
                  <td className="px-4 py-2 flex gap-2 justify-end">
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="text-red-500 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
