import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf, Phone, Mail, MapPin, Share2, Globe, Link2, ExternalLink } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-forest-950 border-t border-forest-800/50 mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-saffron-500 to-saffron-600 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-white">Silicon</span>
                <span className="font-bold gradient-text">Sahaaya</span>
              </div>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">
              AI-powered civic grievance platform for Bengaluru. Making our city cleaner, safer, and smarter — one complaint at a time.
            </p>
            <div className="flex gap-3 mt-4">
              {[Share2, Globe, Link2].map((Icon, i) => (
                <button key={i} className="w-8 h-8 rounded-lg bg-forest-800/50 hover:bg-saffron-500/20 border border-forest-700/50 flex items-center justify-center text-white/50 hover:text-saffron-400 transition-colors">
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { to: '/', label: 'Home' },
                { to: '/submit', label: 'Submit Complaint' },
                { to: '/track', label: 'Track Complaint' },
                { to: '/chatbot', label: 'AI Assistant' },
                { to: '/profile', label: 'My Profile' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-white/50 hover:text-saffron-400 text-sm transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Departments */}
          <div>
            <h4 className="font-semibold text-white mb-4">Departments</h4>
            <ul className="space-y-2 text-sm text-white/50">
              <li>BBMP — Roads & Infra</li>
              <li>BBMP — Solid Waste Mgmt</li>
              <li>BWSSB — Water & Sewage</li>
              <li>BESCOM — Electricity</li>
              <li>BBMP — Parks & Gardens</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white mb-4">Contact & Helpline</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-white/50">
                <Phone className="w-4 h-4 text-saffron-500 mt-0.5 shrink-0" />
                <div>
                  <p>Helpline: <span className="text-saffron-400 font-medium">1800-425-2225</span></p>
                  <p>BBMP: 080-2297-2222</p>
                  <p>BWSSB: 080-2214-7111</p>
                  <p>BESCOM: 1912</p>
                </div>
              </li>
              <li className="flex items-start gap-2 text-sm text-white/50">
                <Mail className="w-4 h-4 text-saffron-500 mt-0.5 shrink-0" />
                <span>support@siliconsahaaya.in</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-white/50">
                <MapPin className="w-4 h-4 text-saffron-500 mt-0.5 shrink-0" />
                <span>BBMP Head Office, Hudson Circle, Bengaluru — 560002</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-forest-800/50 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} SiliconSahaaya. Powered by BBMP Bengaluru. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-white/30">
            <span>Version 1.0.0</span>
            <span>•</span>
            <span>Built with ❤️ for Bengaluru</span>
            <span>•</span>
            <a href="#" className="hover:text-white transition-colors flex items-center gap-1">
              API Docs <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
