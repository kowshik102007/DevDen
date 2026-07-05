import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, SlidersHorizontal, ArrowUpDown, RefreshCw, X } from 'lucide-react';
import { GigCard } from '../../components/cards/GigCard';

export const Marketplace = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialCategory = queryParams.get('category') || '';
  
  // State
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Categories list
  const categoriesList = [
    "Artificial Intelligence",
    "Web Development",
    "Graphic Design",
    "Video Editing",
    "Content Writing",
    "Digital Marketing"
  ];

  // Fetch data
  const fetchGigs = async () => {
    setLoading(true);
    try {
      const url = new URL('http://localhost:5000/api/services');
      if (search) url.searchParams.append('search', search);
      if (category) url.searchParams.append('category', category);
      if (minPrice) url.searchParams.append('min_price', minPrice);
      if (maxPrice) url.searchParams.append('max_price', maxPrice);
      url.searchParams.append('sort_by', sortBy);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setGigs(data);
      }
    } catch (err) {
      console.error("Error loading services:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGigs();
  }, [category, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchGigs();
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
    // Fetch reset
    setTimeout(() => {
      fetchGigs();
    }, 50);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Search Header */}
      <div className="space-y-4 text-center md:text-left">
        <h1 className="text-3xl font-extrabold text-white font-sans">Explore Marketplace</h1>
        <p className="text-gray-400 text-sm">Discover custom RAG chatbots, full stack SaaS templates, logos, guidelines and editing.</p>
        
        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto md:mx-0 flex gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 text-gray-500" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services (e.g. chatbot, figma, design)..."
              className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 pl-11 pr-4 text-sm text-white transition"
            />
          </div>
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition shadow-glow hover:shadow-indigo-500/50"
          >
            Find
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <div className="glass-panel p-6 space-y-6 self-start">
          <div className="flex items-center justify-between border-b border-darkBorder pb-3">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <SlidersHorizontal size={16} /> Filters
            </h3>
            <button onClick={clearFilters} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
              Clear All
            </button>
          </div>

          {/* Category selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-lg p-2.5 text-sm text-gray-300 transition"
            >
              <option value="">All Categories</option>
              {categoriesList.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Price Range selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Price Range (₹)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min"
                className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-lg p-2 text-sm text-white text-center"
              />
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max"
                className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-lg p-2 text-sm text-white text-center"
              />
            </div>
            <button 
              onClick={fetchGigs}
              className="w-full bg-slate-800 hover:bg-slate-700 transition font-bold py-1.5 rounded text-xs text-indigo-400 border border-indigo-500/20"
            >
              Apply price
            </button>
          </div>

          {/* Sort By */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-lg p-2.5 text-sm text-gray-300 transition"
            >
              <option value="newest">Newest Listings</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Gigs List Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">
              Showing {gigs.length} {gigs.length === 1 ? 'service' : 'services'} available
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="h-80 rounded-xl bg-darkCard/40 animate-pulse border border-darkBorder/30" />
              ))}
            </div>
          ) : gigs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {gigs.map((gig) => (
                <GigCard key={gig.id} gig={gig} />
              ))}
            </div>
          ) : (
            <div className="p-16 text-center glass-panel max-w-lg mx-auto space-y-4">
              <SlidersHorizontal size={40} className="mx-auto text-indigo-500" />
              <h4 className="text-lg font-bold text-white">No Services Found</h4>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                No matching results were found. Try adjusting search filters or clear keyword search queries.
              </p>
              <button 
                onClick={clearFilters}
                className="bg-indigo-600 hover:bg-indigo-500 font-bold px-4 py-2 rounded-lg text-xs text-white"
              >
                Reset all searches
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Marketplace;
