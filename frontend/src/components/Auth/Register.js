import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Video, AlertCircle, CheckCircle } from 'lucide-react';

const Register = ({ onSwitchToLogin, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    full_name: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await register(
      formData.email,
      formData.password,
      formData.username,
      formData.full_name
    );
    
    setLoading(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-lg">
            <Video className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">SwanyBot Pro</h1>
            <p className="text-sm text-purple-300">Create your account</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-200">{error}</span>
          </div>
        )}

        {/* Benefits */}
        <div className="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-sm text-green-300 font-semibold">Get 100 free credits!</span>
          </div>
          <ul className="text-xs text-green-200 space-y-1 ml-7">
            <li>• AI-powered chat assistant</li>
            <li>• Multi-platform streaming</li>
            <li>• Team collaboration</li>
          </ul>
        </div>

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full bg-white/10 rounded-lg px-4 py-3 border border-white/20 focus:border-purple-500 focus:outline-none text-white"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              className="w-full bg-white/10 rounded-lg px-4 py-3 border border-white/20 focus:border-purple-500 focus:outline-none text-white"
              placeholder="username"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Full Name (Optional)</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="w-full bg-white/10 rounded-lg px-4 py-3 border border-white/20 focus:border-purple-500 focus:outline-none text-white"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full bg-white/10 rounded-lg px-4 py-3 border border-white/20 focus:border-purple-500 focus:outline-none text-white"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="w-full bg-white/10 rounded-lg px-4 py-3 border border-white/20 focus:border-purple-500 focus:outline-none text-white"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 rounded-lg hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Switch to Login */}
        <div className="mt-6 text-center">
          <p className="text-gray-300">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-purple-400 hover:text-purple-300 font-semibold"
            >
              Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;