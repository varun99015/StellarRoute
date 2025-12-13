import React, { useState, useEffect } from 'react';
import { newsTickerMessages } from '../../utils/errorMessages';

const BreakingNewsTicker = () => {
  const [messages] = useState([...newsTickerMessages].sort(() => Math.random() - 0.5));
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % messages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="w-full overflow-hidden bg-red-900 border-y-2 border-yellow-400 h-10">
      <div className="flex items-center h-full">
        <div className="px-4 py-1 bg-red-700 text-white font-bold whitespace-nowrap">
          🚨 BREAKING NEWS
        </div>
        <div className="flex-1 overflow-hidden relative h-full">
          <div 
            className="absolute whitespace-nowrap text-yellow-300 font-semibold text-sm md:text-base flex items-center h-full"
            style={{
              animation: `ticker ${messages[currentIndex].length / 10}s linear infinite`
            }}
          >
            {messages[currentIndex]}
          </div>
        </div>
        <div className="px-4 py-1 bg-red-700 text-white font-bold whitespace-nowrap">
          🚨
        </div>
      </div>
      <style jsx>{`
        @keyframes ticker {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
};

export default BreakingNewsTicker;