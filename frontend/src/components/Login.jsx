import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const setAuth = useAuthStore(state => state.setAuth);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/api/auth/token', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      setAuth(response.data.access_token, response.data.user);
      navigate('/');
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  const fillDemo = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(to bottom, #3a5568 0%, #a87040 100%)' }}
    >
      {/* Logo */}
      <h1 className="text-4xl text-white mb-8 tracking-tight select-none">
        <span className="font-light">sky</span><span className="font-bold">Claude</span>
      </h1>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-semibold text-slate-800 mb-1">Sign in</h2>
        <p className="text-slate-500 mb-6 text-sm">Access your analytics workspace</p>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none transition-all text-slate-800 placeholder:text-slate-400"
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none transition-all text-slate-800 placeholder:text-slate-400"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full text-white font-semibold py-3 rounded-lg transition-colors mt-2"
            style={{ backgroundColor: '#e87030' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#d06020'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#e87030'}
          >
            Sign in
          </button>
        </form>

        <div className="pt-6 border-t border-slate-100">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Demo accounts</h3>
          <div className="space-y-2">
            {[
              { label: 'System Administrator', email: 'admin@genviz.com', badge: 'Full access' },
              { label: 'Business Analyst',     email: 'analyst@genviz.com', badge: 'Standard' },
              { label: 'Limited Analyst',      email: 'viewer@genviz.com',  badge: 'Read-only' },
            ].map(({ label, email: demoEmail, badge }) => (
              <div
                key={demoEmail}
                className="flex justify-between items-center p-3 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => fillDemo(demoEmail, 'password')}
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                  <p className="text-xs text-slate-400">{demoEmail}</p>
                </div>
                <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{badge}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
