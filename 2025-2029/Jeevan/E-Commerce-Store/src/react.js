const { useState, useEffect } = React;

const defaultReviews = [
  {
    id: 1,
    stars: 5,
    text: "The Summit Alpine Backpack exceeded all expectations. Carried 20kg effortlessly on a 5-day trek. Highly recommended!",
    author: "Rahul Varma",
    role: "Pro Hiker · Mumbai",
    avatar: "images/compass.png"
  },
  {
    id: 2,
    stars: 5,
    text: "Ordering was seamless. The packaging was eco-friendly and the shipping was incredibly fast. The Trail Running Shoes are my new favorite.",
    author: "Priya Nair",
    role: "Trail Runner · Kerala",
    avatar: "images/compass.png"
  },
  {
    id: 3,
    stars: 5,
    text: "Ordered the Geodesic Basecamp Tent for our expedition. Held up perfectly against heavy winds and rain. 10/10, will always recommend.",
    author: "Anand Krishnan",
    role: "Expedition Leader · Bangalore",
    avatar: "images/compass.png"
  },
  {
    id: 4,
    stars: 4,
    text: "The headlamp is extremely bright and battery lasts ages. Delivery was quick, though I wish they had more color options.",
    author: "Sneha Patel",
    role: "Camper",
    avatar: "images/compass.png"
  },
  {
    id: 5,
    stars: 5,
    text: "As someone who spends a lot of time in extreme cold, the Himalayan Down Jacket is a lifesaver. The insulation is top-tier.",
    author: "Thomas George",
    role: "Mountaineer",
    avatar: "images/compass.png"
  },
  {
    id: 6,
    stars: 5,
    text: "TrailForge is my go-to for upgrading my gear. The Titanium Flask keeps water cold for 24 hours without fail.",
    author: "Ayesha Khan",
    role: "Outdoor Enthusiast",
    avatar: "images/compass.png"
  },
  {
    id: 7,
    stars: 5,
    text: "The eco-friendly packaging is a massive plus. Gear quality is consistently top-notch. Can't recommend them enough for weekend trips.",
    author: "Vikram Singh",
    role: "Eco-Advocate",
    avatar: "images/compass.png"
  }
];

function Testimonials() {
  const [reviews, setReviews] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);

  // Form State
  const [newReviewText, setNewReviewText] = useState("");
  const [newRating, setNewRating] = useState(5);

  useEffect(() => {
    // Load reviews from local storage, merge with defaults
    const storedReviews = JSON.parse(localStorage.getItem('reviews') || '[]');
    setReviews([...defaultReviews, ...storedReviews]);

    // Check if user is logged in
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const handleNext = () => {
    if (currentIndex < reviews.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmitReview = (e) => {
    e.preventDefault();
    if (!newReviewText.trim()) return;

    const newReview = {
      id: Date.now(),
      stars: newRating,
      text: newReviewText,
      author: currentUser.name,
      role: "Verified Explorer",
      avatar: "images/compass.png" // Default avatar
    };

    const storedReviews = JSON.parse(localStorage.getItem('reviews') || '[]');
    storedReviews.push(newReview);
    localStorage.setItem('reviews', JSON.stringify(storedReviews));

    setReviews(prev => [...prev, newReview]);
    setNewReviewText("");
    setCurrentIndex(reviews.length); // jump to new review

    // Using global showToast from script.js
    if (window.showToast) window.showToast("⭐ Review added successfully!");
  };

  return (
    <div className="testimonials reveal visible">
      <h3>What Our Explorers Say 💬</h3>

      <div className="carousel-container">
        <div
          className="carousel-track"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {reviews.map((r, i) => (
            <div className="carousel-item" key={r.id}>
              <div className="testimonial-card">
                <div className="t-stars">{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</div>
                <p className="t-text">"{r.text}"</p>
                <div className="t-author">
                  <img className="t-avatar" src={r.avatar} alt={r.author} />
                  <div>
                    <div className="t-name">{r.author}</div>
                    <div className="t-role">{r.role}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="carousel-controls">
          <button className="carousel-btn" onClick={handlePrev} disabled={currentIndex === 0}>←</button>
          <button className="carousel-btn" onClick={handleNext} disabled={currentIndex === reviews.length - 1}>→</button>
        </div>
      </div>

      {
        currentUser ? (
          <div className="review-form-container">
            <h4>Leave a Review</h4>
            <form onSubmit={handleSubmitReview}>
              <div className="review-form-group">
                <label>Rating</label>
                <div className="star-rating-select">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span
                      key={star}
                      className={star <= newRating ? "active" : ""}
                      onClick={() => setNewRating(star)}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
              <div className="review-form-group">
                <label>Your Review</label>
                <textarea
                  placeholder="Tell us what you loved..."
                  value={newReviewText}
                  onChange={(e) => setNewReviewText(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="cf-submit" style={{ width: 'auto', padding: '0.8rem 2rem' }}>Submit Review</button>
            </form>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--mid)', fontSize: '0.9rem' }}>
            <a href="login.html" style={{ color: 'var(--ember)', fontWeight: 'bold', textDecoration: 'none' }}>Log in</a> to write a review.
          </div>
        )
      }
    </div >
  );
}

const rootElement = document.getElementById('react-testimonials-root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<Testimonials />);
}
