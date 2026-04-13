import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
}

interface Review {
  id: number;
  userId: number;
  username: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface ReviewData {
  reviews: Review[];
  average: number | null;
  count: number;
}

// Renders filled and empty stars for a given rating (1–5)
function Stars({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <span className="text-yellow-400 text-lg">
      {"★".repeat(filled)}
      {"☆".repeat(5 - filled)}
    </span>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [addedToCart, setAddedToCart] = useState(false);

  // Load reviews separately so we can refresh after submit
  async function loadReviews() {
    const res = await fetch(`/api/reviews/product/${id}`);
    const data = await res.json();
    setReviewData(data);
  }

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/products/${id}`);
      const data = await res.json();
      setProduct(data);
      await loadReviews();
    }
    load();
  }, [id]);

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate("/login");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({ productId: Number(id), rating, comment }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setMessage(`Error: ${data.error}`);
    } else {
      setComment("");
      setRating(5);
      setMessage("Review submitted!");
      await loadReviews();
    }
  }

  function handleAddToCart() {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!product) return;
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 1000);
  }

  if (!product) return <div className="p-6 text-gray-500">Loading...</div>;

  return (
    <div className="p-6 max-w-2xl">
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-blue-600 hover:underline mb-4 block"
      >
        ← Back to Products
      </button>

      {/* Product card */}
      <div className="border rounded-lg p-5 bg-white shadow-sm mb-6">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-800">{product.name}</h1>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
            {product.category}
          </span>
        </div>
        <p className="text-gray-500 mb-4">{product.description}</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-blue-600">
              ${Number(product.price).toFixed(2)}
            </p>
            <p className="text-xs text-gray-400">{product.stock} in stock</p>
            {reviewData && reviewData.average !== null && (
              <div className="flex items-center gap-2 mt-1">
                <Stars rating={reviewData.average} />
                <span className="text-sm text-gray-500">
                  {reviewData.average.toFixed(1)} ({reviewData.count}{" "}
                  {reviewData.count === 1 ? "review" : "reviews"})
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded text-sm"
          >
            {product.stock === 0
              ? "Out of Stock"
              : addedToCart
                ? "Added!"
                : "Add to Cart"}
          </button>
        </div>
      </div>

      {/* Reviews list */}
      <h2 className="text-lg font-bold mb-3">
        Reviews ({reviewData?.count ?? 0})
      </h2>

      {reviewData && reviewData.reviews.length > 0 ? (
        <div className="flex flex-col gap-3 mb-6">
          {reviewData.reviews.map((review) => (
            <div
              key={review.id}
              className="border rounded-lg p-4 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-700">
                  {review.username}
                </span>
                <Stars rating={review.rating} />
              </div>
              {review.comment && (
                <p className="text-sm text-gray-500">{review.comment}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {new Date(review.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm mb-6">No reviews yet.</p>
      )}

      {/* Submit review form */}
      {user ? (
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <h3 className="font-semibold mb-3">Write a Review</h3>
          <form onSubmit={handleSubmitReview} className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Rating</label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="border rounded px-3 py-1.5 text-sm"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-1">
                Comment (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Share your thoughts..."
                className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded text-sm"
              >
                {submitting ? "Submitting..." : "Submit Review"}
              </button>
              {message && (
                <p
                  className={`text-sm ${message.startsWith("Error") ? "text-red-500" : "text-green-600"}`}
                >
                  {message}
                </p>
              )}
            </div>
          </form>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          <button
            onClick={() => navigate("/login")}
            className="text-blue-600 hover:underline"
          >
            Log in
          </button>{" "}
          to write a review.
        </p>
      )}
    </div>
  );
}
