import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { audioManager } from '../../utils/audioManager';

const ChaosIntensitySlider = ({ intensity, setIntensity, audioEnabled, setAudioEnabled }) => {
  const intensityLevels = [
    { level: 1, label: 'Mild', color: 'bg-yellow-500', desc: 'Subtle effects' },
    { level: 2, label: 'Moderate', color: 'bg-orange-500', desc: 'Noticeable chaos' },
    { level: 3, label: 'High', color: 'bg-red-500', desc: 'System stress' },
    { level: 4, label: 'EXTREME', color: 'bg-red-700', desc: 'Total meltdown' },
    { level: 5, label: 'ARMAGEDDON', color: 'bg-purple-700', desc: 'Apocalypse mode' }
  ];

  const handleIntensityChange = (newIntensity) => {
    setIntensity(newIntensity);
    
    // Adjust audio based on intensity
    if (audioEnabled) {
      const volume = newIntensity / 5;
      audioManager.setVolume('siren', volume * 0.3);
      audioManager.setVolume('static', volume * 0.2);
    }
  };

  const toggleAudio = () => {
    const newAudioEnabled = !audioEnabled;
    setAudioEnabled(newAudioEnabled);
    
    if (newAudioEnabled) {
      audioManager.unmuteAll();
      audioManager.play('siren');
    } else {
      audioManager.muteAll();
    }
  };

  return (
    <div className="fixed top-20 left-4 z-[9999] bg-black/80 backdrop-blur-sm rounded-lg p-4 w-64 border border-red-500">
      <div className="text-center mb-4">
        <div className="text-red-400 font-bold text-lg">CHAOS INTENSITY</div>
        <div className="text-xs text-gray-400">Control the madness level</div>
      </div>

      <div className="space-y-4">
        {/* Intensity Slider */}
        <div>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={intensity}
            onChange={(e) => handleIntensityChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-500"
          />
          
          <div className="flex justify-between mt-2">
            {intensityLevels.map(({ level, label, color }) => (
              <div key={level} className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${intensity >= level ? color : 'bg-gray-600'}`} />
                <div className="text-xs text-gray-400 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Current Level Display */}
        <div className={`text-center py-2 rounded ${intensityLevels[intensity - 1].color.replace('bg-', 'bg-').replace('-500', '-900')}`}>
          <div className="text-white font-bold text-sm">
            {intensityLevels[intensity - 1].label}
          </div>
          <div className="text-xs text-gray-300">
            {intensityLevels[intensity - 1].desc}
          </div>
        </div>

        {/* Audio Toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={toggleAudio}
            className={`flex items-center gap-2 px-3 py-2 rounded ${audioEnabled ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400'}`}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="text-sm">{audioEnabled ? 'Sound ON' : 'Sound OFF'}</span>
          </button>

          <div className="text-xs text-gray-400">
            Effects: {intensity >= 4 ? 'MAXIMUM' : intensity >= 3 ? 'HIGH' : 'NORMAL'}
          </div>
        </div>

        {/* Effects Active */}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-xs text-center p-2 bg-gray-900/50 rounded">
            <div className="text-green-400">✓ Screen Shake</div>
          </div>
          <div className="text-xs text-center p-2 bg-gray-900/50 rounded">
            <div className={`${intensity >= 2 ? 'text-green-400' : 'text-gray-500'}`}>
              {intensity >= 2 ? '✓ Glitch Effects' : 'Glitch Effects'}
            </div>
          </div>
          <div className="text-xs text-center p-2 bg-gray-900/50 rounded">
            <div className={`${intensity >= 3 ? 'text-green-400' : 'text-gray-500'}`}>
              {intensity >= 3 ? '✓ Error Popups' : 'Error Popups'}
            </div>
          </div>
          <div className="text-xs text-center p-2 bg-gray-900/50 rounded">
            <div className={`${intensity >= 4 ? 'text-green-400' : 'text-gray-500'}`}>
              {intensity >= 4 ? '✓ Matrix Rain' : 'Matrix Rain'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChaosIntensitySlider;