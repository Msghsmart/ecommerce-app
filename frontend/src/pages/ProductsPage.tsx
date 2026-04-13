import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNavigate, Link } from "react-router-dom";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface RatingSummary {
  average: number | null;
  count: number;
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <span className="text-yellow-400">
      {"★".repeat(filled)}
      {"☆".repeat(5 - filled)}
    </span>
  );
}

export default function ProductsPage() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [ratings, setRatings] = useState<Record<number, RatingSummary>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addedId, setAddedId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "9" });
      if (search) params.set("search", search);

      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();

      setProducts(data.data);
      setPagination(data.pagination);
      setLoading(false);

      // Fetch ratings for all visible products in parallel
      const ratingResults = await Promise.all(
        data.data.map((p: Product) =>
          fetch(`/api/reviews/product/${p.id}`).then((r) => r.json())
        )
      );
      const ratingMap: Record<number, RatingSummary> = {};
      data.data.forEach((p: Product, i: number) => {
        ratingMap[p.id] = {
          average: ratingResults[i].average,
          count: ratingResults[i].count,
        };
      });
      setRatings(ratingMap);
    }
    load();
  }, [page, search]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  function handleAddToCart(product: Product) {
    if (!user) {
      navigate("/login");
      return;
    }

    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
    });

    // Briefly show "Added!" on the button, then reset
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1000);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Products</h1>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
            onClick={() => {
              setSearch("");
              setPage(1);
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </form>

      {/* Grid */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : products.length === 0 ? (
        <p className="text-gray-500">No products found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-2"
            >
              <div className="flex items-start justify-between">
                <Link
                  to={`/products/${product.id}`}
                  className="font-semibold text-gray-800 hover:text-blue-600 hover:underline"
                >
                  {product.name}
                </Link>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                  {product.category}
                </span>
              </div>
              <p className="text-sm text-gray-500 flex-1">
                {product.description}
              </p>
              <div className="flex items-center justify-between mt-2">
                <div>
                  <p className="text-lg font-bold text-blue-600">
                    ${Number(product.price).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {product.stock} in stock
                  </p>
                  {ratings[product.id]?.average !== null &&
                    ratings[product.id]?.average !== undefined && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Stars rating={ratings[product.id].average!} />
                        <span className="text-xs text-gray-400">
                          ({ratings[product.id].count})
                        </span>
                      </div>
                    )}
                </div>
                <button
                  onClick={() => handleAddToCart(product)}
                  disabled={product.stock === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded text-sm"
                >
                  {product.stock === 0
                    ? "Out of Stock"
                    : addedId === product.id
                      ? "Added!"
                      : "Add to Cart"}
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
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-100"
          >
            Prev
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page === pagination.totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-100"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
