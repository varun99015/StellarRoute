import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { errorMessages } from '../../utils/errorMessages';

const ErrorPopups = () => {
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    const addError = () => {
      if (errors.length < 5) { // Limit to 5 errors on screen
        const newError = {
          id: Date.now(),
          message: errorMessages[Math.floor(Math.random() * errorMessages.length)],
          type: Math.random() > 0.5 ? 'error' : 'warning',
          x: Math.random() * 70 + 10, // 10% to 80%
          y: Math.random() * 70 + 10  // 10% to 80%
        };
        setErrors(prev => [...prev, newError]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
          setErrors(prev => prev.filter(e => e.id !== newError.id));
        }, 5000);
      }
    };

    const interval = setInterval(addError, 2000);
    return () => clearInterval(interval);
  }, [errors.length]);

  const removeError = (id) => {
    setErrors(prev => prev.filter(error => error.id !== id));
  };

  return (
    <>
      {errors.map(error => (
        <div
          key={error.id}
          className={`fixed z-[10000] p-4 rounded-lg shadow-lg border-2 min-w-[300px] max-w-[400px] animate__animated animate__fadeInUp ${
            error.type === 'error' 
              ? 'bg-red-900/90 border-red-600' 
              : 'bg-yellow-900/90 border-yellow-600'
          }`}
          style={{
            left: `${error.x}%`,
            top: `${error.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-6 h-6 mt-0.5 ${
              error.type === 'error' ? 'text-red-300' : 'text-yellow-300'
            }`} />
            <div className="flex-1">
              <div className={`font-bold mb-1 ${
                error.type === 'error' ? 'text-red-200' : 'text-yellow-200'
              }`}>
                {error.type === 'error' ? 'SYSTEM ERROR' : 'WARNING'}
              </div>
              <div className="text-sm text-white">
                {error.message}
              </div>
            </div>
            <button
              onClick={() => removeError(error.id)}
              className="text-gray-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Timestamp: {new Date(error.id).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </>
  );
};

export default ErrorPopups;