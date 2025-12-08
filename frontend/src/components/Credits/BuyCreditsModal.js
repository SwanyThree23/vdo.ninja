import React, { useState, useEffect } from 'react';
import { X, Coins, Check } from 'lucide-react';
import { paymentAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const BuyCreditsModal = ({ isOpen, onClose }) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const { refreshCredits } = useAuth();

  useEffect(() => {
    if (isOpen) {
      loadPackages();
    }
  }, [isOpen]);

  const loadPackages = async () => {
    try {
      const response = await paymentAPI.getPackages();
      const pkgs = Object.entries(response.data.packages).map(([key, value]) => ({
        id: key,
        ...value
      }));
      setPackages(pkgs);
    } catch (error) {
      console.error('Failed to load packages:', error);
    }
  };

  const handlePurchase = async (packageId) => {
    setLoading(true);
    try {
      // In production, integrate with Stripe
      alert('Stripe integration required. Add your Stripe keys to enable payments.');
      // const response = await paymentAPI.createIntent(packageId);
      // Process payment with Stripe
    } catch (error) {
      alert('Payment failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Coins className="w-8 h-8 text-yellow-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">Buy Credits</h2>
              <p className="text-sm text-gray-300">Choose a package that suits your needs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Packages */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="bg-white/5 rounded-xl p-6 border border-purple-500/30 hover:border-purple-500 transition"
            >
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
                <div className="text-4xl font-bold text-purple-400 mb-1">{pkg.credits}</div>
                <div className="text-sm text-gray-300">Credits</div>
              </div>

              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-white">
                  ${(pkg.amount / 100).toFixed(2)}
                </div>
                <div className="text-sm text-gray-400">One-time payment</div>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>AI Chat Messages</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>Video Generation</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>Music Generation</span>
                </div>
              </div>

              <button
                onClick={() => handlePurchase(pkg.id)}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 rounded-lg hover:scale-105 transition disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-200">
            💡 <strong>Note:</strong> Credits never expire and can be used for all AI features.
            Stripe integration required for actual payments.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BuyCreditsModal;