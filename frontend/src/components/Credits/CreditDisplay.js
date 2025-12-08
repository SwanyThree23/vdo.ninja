import React from 'react';
import { Coins, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const CreditDisplay = ({ onBuyCredits }) => {
  const { credits } = useAuth();

  return (
    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
      <Coins className="w-5 h-5 text-yellow-400" />
      <div>
        <div className="text-sm font-bold text-white">{credits}</div>
        <div className="text-xs text-gray-300">Credits</div>
      </div>
      <button
        onClick={onBuyCredits}
        className="bg-gradient-to-r from-yellow-500 to-orange-500 p-2 rounded-full hover:scale-110 transition"
        title="Buy Credits"
      >
        <Plus className="w-4 h-4 text-white" />
      </button>
    </div>
  );
};

export default CreditDisplay;