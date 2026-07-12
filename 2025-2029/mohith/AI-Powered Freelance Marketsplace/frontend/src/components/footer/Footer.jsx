import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-darkBg border-t border-darkBorder/40 pt-16 pb-8 px-6 text-gray-400 mt-auto">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
        <div className="space-y-4">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-indigo-500">Skill</span>
            <span className="text-cyan-400">Bridge</span>
          </span>
          <p className="text-sm leading-relaxed">
            The next-generation, AI-driven freelance platform integrating identity trust, payments, wallet clearing, and automated resume diagnostics.
          </p>
          <div className="flex items-center gap-4 text-gray-500">
            <a href="#" className="hover:text-white transition" aria-label="Twitter">
              <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="#" className="hover:text-white transition" aria-label="GitHub">
              <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
              </svg>
            </a>
            <a href="#" className="hover:text-white transition" aria-label="LinkedIn">
              <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </a>
            <a href="#" className="hover:text-white transition" aria-label="Contact support"><MessageCircle size={18} /></a>
          </div>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Top Categories</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/marketplace?category=Artificial+Intelligence" className="hover:text-indigo-400 transition">Artificial Intelligence</Link></li>
            <li><Link to="/marketplace?category=Web+Development" className="hover:text-indigo-400 transition">Web Development</Link></li>
            <li><Link to="/marketplace?category=Graphic+Design" className="hover:text-indigo-400 transition">Graphic Design</Link></li>
            <li><Link to="/marketplace?category=Video+Editing" className="hover:text-indigo-400 transition">Video Editing</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Resources</h4>
          <ul className="space-y-2.5 text-sm">
            <li><a href="#" className="hover:text-indigo-400 transition">ATS Resume Help</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition">Payment Escrow Rules</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition">Support Center FAQs</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition">API Documentation</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">System Safety</h4>
          <p className="text-sm leading-relaxed mb-4">
            Security audit logs, role authentication layers, and sandbox payment integrations are active.
          </p>
          <div className="text-xs text-indigo-400 font-semibold uppercase bg-indigo-950/40 border border-indigo-900/50 py-1.5 px-3 rounded-lg inline-block">
            SSL & Escrow Protected
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-darkBorder/30 text-center text-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <p>&copy; {new Date().getFullYear()} SkillBridge. Built for portfolio excellence.</p>
        <div className="flex gap-6">
          <a href="#" className="hover:underline">Privacy Policy</a>
          <a href="#" className="hover:underline">Terms of Service</a>
          <a href="#" className="hover:underline">Cookie Policy</a>
        </div>
      </div>
    </footer>
  );
};
export default Footer;
