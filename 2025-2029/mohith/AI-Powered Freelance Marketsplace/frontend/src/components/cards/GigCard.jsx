import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export const GigCard = ({ gig }) => {
  // Safe extraction of values
  const { id, title, price, category, freelancer_name, freelancer_title, freelancer_rating, images } = gig;
  
  // Use a neat gradient or visual canvas if no images exist
  const cardImage = (images && images.length > 0) ? images[0] : null;

  return (
    <motion.div 
      whileHover={{ y: -6 }}
      className="glass-panel overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-cyanGlow"
    >
      {/* Gig Image / Banner */}
      <Link to={`/service/${id}`} className="relative h-44 w-full block overflow-hidden bg-slate-900">
        {cardImage ? (
          <img 
            src={cardImage} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              // Fallback
              e.target.style.display = 'none';
              e.target.parentNode.classList.add('bg-gradient-to-tr', 'from-indigo-900', 'to-slate-950');
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-cyan-950 flex flex-col justify-between p-4">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest bg-cyan-950/80 border border-cyan-800/40 px-2 py-0.5 rounded self-start">
              {category}
            </span>
            <div className="text-sm font-semibold text-gray-300 drop-shadow-md">
              SkillBridge Verified Service
            </div>
          </div>
        )}
      </Link>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          {/* Category tag for layouts with images */}
          {cardImage && (
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider block">
              {category}
            </span>
          )}

          {/* Title */}
          <Link to={`/service/${id}`} className="block">
            <h3 className="text-base font-semibold text-white group-hover:text-cyan-300 transition line-clamp-2 leading-snug">
              {title}
            </h3>
          </Link>
          
          {/* Freelancer Bio summary */}
          <div className="flex items-center gap-2 pt-2">
            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xxs font-bold uppercase">
              {freelancer_name ? freelancer_name[0] : 'F'}
            </div>
            <div>
              <p className="text-xs text-gray-300 font-medium flex items-center gap-1">
                {freelancer_name} 
                <ShieldCheck size={12} className="text-indigo-400 fill-indigo-950" />
              </p>
              <p className="text-xxs text-gray-500 truncate max-w-[170px]">{freelancer_title || 'Expert Partner'}</p>
            </div>
          </div>
        </div>

        {/* Rating and Price row */}
        <div className="flex items-center justify-between border-t border-darkBorder/40 mt-5 pt-3">
          <div className="flex items-center gap-1 text-yellow-500">
            <Star size={14} className="fill-yellow-500" />
            <span className="text-xs font-bold text-gray-200">
              {freelancer_rating > 0 ? freelancer_rating.toFixed(2) : "New"}
            </span>
          </div>
          <div>
            <p className="text-xxs text-gray-500 text-right uppercase">Starting at</p>
            <p className="text-sm font-extrabold text-cyan-400">₹{price.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
export default GigCard;
