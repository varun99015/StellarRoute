import React, { useEffect, useState } from 'react';
import './ChaosOverlay.css';
import { audioManager } from '../../utils/audioManager';

const ChaosOverlay = ({ intensity = 3 }) => {
  const [vhslines, setVhsLines] = useState([]);
  const [matrixChars, setMatrixChars] = useState([]);

  // Initialize audio
  useEffect(() => {
    // Load audio files (update paths as needed)
    audioManager.loadAudio('siren', '/src/assets/audio/emergency_siren.mp3');
    audioManager.loadAudio('static', '/src/assets/audio/radio_static.mp3');
    audioManager.loadAudio('geiger', '/src/assets/audio/geiger_counter.mp3');
    audioManager.loadAudio('ebs', '/src/assets/audio/ebs_tone.mp3');

    // Play emergency sounds
    audioManager.play('siren');
    audioManager.setVolume('siren', 0.2);
    
    // Play intermittent static
    const staticInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        audioManager.play('static');
        audioManager.setVolume('static', 0.1);
      }
    }, 3000);

    // Play geiger counter randomly
    const geigerInterval = setInterval(() => {
      if (Math.random() > 0.8) {
        audioManager.play('geiger');
        audioManager.setVolume('geiger', 0.15);
      }
    }, 5000);

    // Create VHS tear effects
    const vhsInterval = setInterval(() => {
      setVhsLines(prev => {
        const newLine = {
          id: Date.now(),
          top: `${Math.random() * 100}%`,
          delay: `${Math.random() * 2}s`,
          duration: `${0.5 + Math.random() * 1}s`
        };
        const updated = [...prev, newLine].slice(-5);
        return updated;
      });
    }, 800);

    // Create Matrix rain
    const matrixInterval = setInterval(() => {
      if (intensity >= 4) {
        setMatrixChars(prev => {
          const newChar = {
            id: Date.now(),
            left: `${Math.random() * 100}%`,
            char: String.fromCharCode(0x30A0 + Math.random() * 96),
            delay: `${Math.random() * 2}s`,
            duration: `${1 + Math.random() * 2}s`
          };
          const updated = [...prev, newChar].slice(-20);
          return updated;
        });
      }
    }, 100);

    // Play EBS tone occasionally
    const ebsInterval = setInterval(() => {
      if (Math.random() > 0.9) {
        audioManager.play('ebs');
        audioManager.setVolume('ebs', 0.25);
      }
    }, 10000);

    return () => {
      clearInterval(staticInterval);
      clearInterval(geigerInterval);
      clearInterval(vhsInterval);
      clearInterval(matrixInterval);
      clearInterval(ebsInterval);
      audioManager.stopAll();
    };
  }, [intensity]);

  // Remove old VHS lines
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setVhsLines(prev => prev.filter(line => 
        Date.now() - line.id < 2000
      ));
      setMatrixChars(prev => prev.filter(char => 
        Date.now() - char.id < 3000
      ));
    }, 1000);

    return () => clearInterval(cleanupInterval);
  }, []);

  return (
    <div className="chaos-overlay">
      {/* VHS Tear Lines */}
      {vhslines.map(line => (
        <div
          key={line.id}
          className="vhs-tear"
          style={{
            top: line.top,
            animation: `vhs-tear ${line.duration} ease-out ${line.delay}`,
            opacity: 0.3 + Math.random() * 0.4
          }}
        />
      ))}

      {/* Matrix Rain (only at high intensity) */}
      {intensity >= 4 && matrixChars.map(char => (
        <div
          key={char.id}
          className="matrix-char"
          style={{
            left: char.left,
            top: '-20px',
            animation: `matrix-rain ${char.duration} linear ${char.delay}`,
            opacity: 0.3 + Math.random() * 0.7
          }}
        >
          {char.char}
        </div>
      ))}

      {/* Screen Tint based on intensity */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundColor: intensity >= 4 ? 'rgba(255, 0, 0, 0.05)' : 
                         intensity >= 3 ? 'rgba(255, 100, 0, 0.03)' : 
                         'rgba(255, 200, 0, 0.02)',
          pointerEvents: 'none'
        }}
      />

      {/* Scanlines */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(
            to bottom,
            transparent 50%,
            rgba(0, 255, 255, 0.03) 50%
          )`,
          backgroundSize: '100% 4px',
          opacity: 0.3
        }}
      />
    </div>
  );
};

export default ChaosOverlay;