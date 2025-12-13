import React, { useState, useEffect } from 'react';
import { audioManager } from '../../utils/audioManager';

const CountdownTimer = () => {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [isCritical, setIsCritical] = useState(false);

  useEffect(() => {
    audioManager.loadAudio('mission_control', '/src/assets/audio/mission_control.mp3');
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (timeLeft === 60) {
      audioManager.play('mission_control');
      audioManager.setVolume('mission_control', 0.4);
    }
    
    if (timeLeft <= 30) {
      setIsCritical(true);
    } else {
      setIsCritical(false);
    }
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`fixed top-24 right-4 z-[9999] ${isCritical ? 'animate-pulse' : ''}`}>
      <div className={`p-4 rounded-lg border-2 text-center min-w-[160px] ${
        isCritical 
          ? 'bg-red-900/90 border-red-600' 
          : 'bg-gray-900/90 border-yellow-600'
      }`}>
        <div className="text-xs text-gray-300 mb-1">
          {isCritical ? '🚨 CRITICAL COUNTDOWN' : 'SYSTEM STABILITY'}
        </div>
        
        <div className={`text-3xl font-mono font-bold mb-2 ${
          isCritical ? 'text-red-400' : 'text-yellow-300'
        }`}>
          {formatTime(timeLeft)}
        </div>
        
        <div className="text-xs text-gray-400">
          {isCritical 
            ? 'IMMINENT SYSTEM FAILURE' 
            : timeLeft > 180 
              ? 'Stable for now...' 
              : 'Warning: Systems degrading'
          }
        </div>
        
        {isCritical && (
          <div className="mt-2 text-xs text-red-300 animate-pulse">
            TAKE COVER! 🔊
          </div>
        )}
        
        {/* Progress bar */}
        <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full ${isCritical ? 'bg-red-500' : 'bg-yellow-500'} transition-all duration-1000`}
            style={{ width: `${(timeLeft / 300) * 100}%` }}
          />
        </div>
        
        <div className="mt-2 text-[10px] text-gray-500">
          Estimated until complete system meltdown
        </div>
      </div>
    </div>
  );
};

export default CountdownTimer;