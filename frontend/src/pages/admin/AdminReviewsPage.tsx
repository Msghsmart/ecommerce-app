import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface Review {
  id: number;
  userId: number;
  username: string;
  productId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-400">
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

export default function AdminReviewsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [productIdFilter, setProductIdFilter] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/");
      return;
    }
    fetchReviews();
  }, [user]);

  // Admin has no "get all reviews" endpoint, so we fetch by productId
  async function fetchReviews() {
    if (!productIdFilter) {
      setReviews([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const res = await fetch(`/api/reviews/product/${productIdFilter}`);
    const data = await res.json();

    if (!res.ok) {
      setMessage(`Error: ${data.error}`);
      setLoading(false);
      return;
    }

    setReviews(data.reviews);
    setLoading(false);
  }

  async function handleDelete(reviewId: number) {
    setMessage("");

    const res = await fetch(`/api/reviews/${reviewId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${user!.token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(`Error: ${data.error}`);
      return;
    }

    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    setMessage("Review deleted.");
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin — Reviews</h1>

      {/* Filter by product ID */}
      <div className="flex gap-2 mb-6">
        <input
          type="number"
          value={productIdFilter}
          onChange={(e) => setProductIdFilter(e.target.value)}
          placeholder="Enter Product ID..."
          className="border rounded px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={fetchReviews}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
        >
          Load Reviews
        </button>
      </div>

      {message && (
        <p
          className={`mb-4 text-sm font-medium ${message.startsWith("Error") ? "text-red-500" : "text-green-600"}`}
        >
          {message}
        </p>
      )}

      {!productIdFilter ? (
        <p className="text-gray-400 text-sm">Enter a product ID to view its reviews.</p>
      ) : loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : reviews.length === 0 ? (
        <p className="text-gray-500">No reviews for this product.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="border rounded-lg p-4 bg-white shadow-sm flex items-start justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-700">
                    {review.username}
                  </span>
                  <span className="text-xs text-gray-400">
                    (User #{review.userId})
                  </span>
                  <Stars rating={review.rating} />
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-500">{review.comment}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(review.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(review.id)}
                className="text-red-500 hover:text-red-700 text-sm font-medium shrink-0"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
