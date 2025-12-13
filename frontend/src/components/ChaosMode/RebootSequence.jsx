import React, { useState, useEffect } from 'react';
import { audioManager } from '../../utils/audioManager';

const RebootSequence = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [log, setLog] = useState([]);

  const steps = [
    "Initiating emergency reboot sequence...",
    "Shutting down navigation systems...",
    "Dumping corrupted memory cache...",
    "Reinitializing GPS modules...",
    "Calibrating IMU sensors...",
    "Establishing satellite link...",
    "Verifying system integrity...",
    "Loading emergency protocols...",
    "System reboot complete!"
  ];

  useEffect(() => {
    audioManager.loadAudio('reboot', '/src/assets/audio/reboot_sound.mp3');
    audioManager.play('reboot');
    audioManager.setVolume('reboot', 0.3);

    const timer = setInterval(() => {
      if (step < steps.length) {
        setLog(prev => [...prev, `> ${steps[step]}`]);
        setStep(prev => prev + 1);
      } else {
        clearInterval(timer);
        setTimeout(() => {
          onComplete?.();
        }, 2000);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      audioManager.stop('reboot');
    };
  }, [step, onComplete]);

  return (
    <div className="fixed inset-0 z-[10001] bg-black flex items-center justify-center">
      <div className="w-full max-w-2xl mx-4">
        <div className="bg-gray-900 border-2 border-green-500 rounded-lg overflow-hidden">
          <div className="bg-green-900 px-4 py-2 border-b border-green-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="ml-4 text-green-300 font-mono font-bold">
                STELLARROUTE EMERGENCY REBOOT TERMINAL
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-black h-96 overflow-y-auto font-mono">
            <div className="text-green-400 text-sm space-y-1">
              <div className="text-yellow-300 mb-4">
                ╔══════════════════════════════════════════╗<br />
                ║   CRITICAL SYSTEM FAILURE DETECTED      ║<br />
                ║   INITIATING REBOOT SEQUENCE            ║<br />
                ╚══════════════════════════════════════════╝
              </div>
              
              {log.map((line, index) => (
                <div 
                  key={index} 
                  className={`${index === log.length - 1 ? 'text-green-300 animate-pulse' : 'text-green-500'}`}
                >
                  {line}
                  {index === log.length - 1 && (
                    <span className="inline-block w-2 h-4 ml-1 bg-green-500 animate-blink"></span>
                  )}
                </div>
              ))}
              
              <div className="mt-8 text-gray-500">
                {step < steps.length ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                    <div>Processing... [{step}/{steps.length}]</div>
                  </div>
                ) : (
                  <div className="text-green-300 font-bold text-lg">
                    ✓ REBOOT SUCCESSFUL - SYSTEM RESTORED
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-gray-900 px-4 py-2 text-xs text-gray-400 border-t border-gray-700">
            Time: {new Date().toLocaleTimeString()} | Status: {step < steps.length ? 'REBOOTING' : 'OPERATIONAL'}
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s infinite;
        }
      `}</style>
    </div>
  );
};

export default RebootSequence;