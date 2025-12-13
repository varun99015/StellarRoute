import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Wifi, Satellite } from 'lucide-react';

const SystemStatusHUD = () => {
  const [cpuUsage, setCpuUsage] = useState(30);
  const [ramUsage, setRamUsage] = useState(45);
  const [networkStrength, setNetworkStrength] = useState(80);
  const [satelliteSignal, setSatelliteSignal] = useState(70);

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(prev => Math.min(100, Math.max(0, prev + (Math.random() * 20 - 10))));
      setRamUsage(prev => Math.min(100, Math.max(0, prev + (Math.random() * 15 - 7.5))));
      setNetworkStrength(prev => Math.min(100, Math.max(0, prev + (Math.random() * 30 - 15))));
      setSatelliteSignal(prev => Math.min(100, Math.max(0, prev + (Math.random() * 40 - 20))));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const Gauge = ({ value, color, label, icon: Icon }) => (
    <div className="flex items-center gap-3 p-3 bg-black/60 rounded-lg backdrop-blur-sm">
      <Icon className={`w-5 h-5 ${color}`} />
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-300">{label}</span>
          <span className="font-bold">{Math.round(value)}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full ${color} transition-all duration-300`}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-64 space-y-2">
      <div className="text-center text-xs text-red-400 font-bold mb-2 bg-black/60 py-1 rounded">
        SYSTEM STATUS - CHAOS MODE
      </div>
      
      <Gauge 
        value={cpuUsage} 
        color="text-red-400 bg-red-500" 
        label="CPU LOAD" 
        icon={Cpu} 
      />
      
      <Gauge 
        value={ramUsage} 
        color="text-yellow-400 bg-yellow-500" 
        label="MEMORY USAGE" 
        icon={HardDrive} 
      />
      
      <Gauge 
        value={networkStrength} 
        color="text-blue-400 bg-blue-500" 
        label="NETWORK" 
        icon={Wifi} 
      />
      
      <Gauge 
        value={satelliteSignal} 
        color="text-green-400 bg-green-500" 
        label="SATELLITES" 
        icon={Satellite} 
      />

      {/* Signal Bars Visualization */}
      <div className="p-3 bg-black/60 rounded-lg backdrop-blur-sm">
        <div className="text-xs text-gray-300 mb-2">GPS SIGNAL STRENGTH</div>
        <div className="signal-bars">
          {[1, 2, 3, 4, 5].map(bar => (
            <div
              key={bar}
              className="signal-bar"
              style={{
                height: `${Math.max(5, Math.random() * 20)}px`,
                background: satelliteSignal > bar * 20 ? '#00ff00' : '#ff0000',
                opacity: Math.random() > 0.3 ? 1 : 0.3
              }}
            />
          ))}
        </div>
        <div className="text-[10px] text-gray-400 mt-2 text-center">
          {satelliteSignal > 50 ? 'Signal unstable' : 'Signal lost'}
        </div>
      </div>

      {/* OVERLOAD Warning */}
      {(cpuUsage > 90 || ramUsage > 85) && (
        <div className="text-center text-xs text-red-400 font-bold animate-pulse bg-black/80 py-1 rounded">
          ⚠️ SYSTEM OVERLOAD DETECTED
        </div>
      )}
    </div>
  );
};

export default SystemStatusHUD;