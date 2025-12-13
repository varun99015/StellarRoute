import React, { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Stars, Sphere, Trail, Float } from "@react-three/drei";
import * as THREE from "three";
import { TextureLoader } from 'three/src/loaders/TextureLoader';

// --- CONFIGURATION ---
const EARTH_RADIUS = 2;
const MAGNETOSPHERE_RADIUS = 3.5;

/**
 * 🌍 EARTH COMPONENT (Photorealistic)
 */
const Earth = () => {
  // Load textures from the /public/textures folder
  const [colorMap, bumpMap, specularMap] = useLoader(TextureLoader, [
    '/textures/earth_daymap.jpg',
    '/textures/earth_bump.jpg',
    '/textures/earth_specular.jpg'
  ]);

  return (
    <group>
      {/* Photorealistic Earth */}
      <Sphere args={[EARTH_RADIUS, 64, 64]}>
        <meshPhongMaterial
          map={colorMap}
          bumpMap={bumpMap}
          bumpScale={0.05}
          specularMap={specularMap}
          specular={new THREE.Color('grey')}
          shininess={5}
        />
      </Sphere>

      {/* Atmospheric Glow */}
      <Sphere args={[EARTH_RADIUS + 0.03, 64, 64]}>
        <meshPhongMaterial
          color="#4299E1"
          transparent
          opacity={0.15}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </Sphere>
    </group>
  );
};

/**
 * 🛡️ MAGNETOSPHERE SHIELD
 */
const Magnetosphere = ({ intensity }) => {
  const shieldRef = useRef();
  
  useFrame((state) => {
    if (shieldRef.current) {
        const t = state.clock.getElapsedTime();
        // Pulse opacity and slightly wobble based on intensity
        shieldRef.current.material.opacity = 0.1 + (Math.sin(t * 2) * 0.05 * (intensity / 4));
        shieldRef.current.rotation.y += 0.001;
    }
  });

  // Color shifts from blue (low) to reddish-orange (high)
  const shieldColor = intensity > 6 ? "#FF4500" : intensity > 4 ? "#FFA500" : "#4299E1";

  return (
    <Sphere ref={shieldRef} args={[MAGNETOSPHERE_RADIUS, 64, 64]}>
      <meshPhongMaterial
        color={shieldColor}
        emissive={shieldColor}
        emissiveIntensity={intensity > 6 ? 0.4 : 0.1}
        transparent
        opacity={0.1}
        wireframe={false} // Solid, transparent shield looks more realistic
        side={THREE.DoubleSide}
        depthWrite={false} // Helps with transparency rendering
      />
    </Sphere>
  );
};

/**
 * ☀️ SOLAR WIND PARTICLES
 */
const SolarWind = ({ count = 100, intensity }) => {
  const particles = useMemo(() => {
    return new Array(count).fill(0).map(() => ({
      x: -20 - Math.random() * 10, // Start far left
      y: (Math.random() - 0.5) * 12,
      z: (Math.random() - 0.5) * 12,
      speed: 0.2 + Math.random() * 0.3,
      scale: 0.5 + Math.random() * 0.5
    }));
  }, [count]);

  const mesh = useRef();

  useFrame((state) => {
    const speedMultiplier = 1 + (intensity / 3);
    
    mesh.current.children.forEach((p, i) => {
        const data = particles[i];
        p.position.x += data.speed * speedMultiplier;
        
        // Reset if they hit the magnetosphere boundary
        if (p.position.x > -MAGNETOSPHERE_RADIUS + 0.5) {
            p.position.x = -20 - Math.random() * 10;
            p.position.y = (Math.random() - 0.5) * 12; 
        }
    });
  });

  // Particle color changes with intensity
  const particleColor = intensity > 6 ? "#FFD700" : "#87CEEB"; // Gold for high, Light Blue for low

  return (
    <group ref={mesh}>
      {particles.map((data, i) => (
        <mesh key={i} position={[data.x, data.y, data.z]} scale={data.scale}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial 
            color={particleColor}
            transparent 
            opacity={0.8} 
          />
          {intensity > 4 && (
             <Trail width={1.5} length={5} color={particleColor} attenuation={(t) => t * t}>
                <mesh />
             </Trail>
          )}
        </mesh>
      ))}
    </group>
  );
};

/**
 * 🎮 MAIN SCENE COMPONENT
 */
const SolarStormGlobe = ({ kpIndex = 3 }) => {
  const [localKp, setLocalKp] = useState(kpIndex);
  const currentKp = kpIndex || localKp;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "black" }}>
      
      {/* HUD */}
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 10, color: "white", fontFamily: "sans-serif", pointerEvents: 'none' }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: "bold", letterSpacing: "1px" }}>SOLAR IMPACT VISUALIZER</h2>
        <div style={{ marginTop: "5px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.8rem", color: "#CBD5E1" }}>Kp INDEX:</span>
            <span style={{ 
                fontSize: "1.2rem", 
                fontWeight: "bold", 
                color: currentKp > 6 ? "#EF4444" : currentKp > 4 ? "#FBBF24" : "#4ADE80" 
            }}>
                {currentKp}
            </span>
        </div>
      </div>

      <Canvas camera={{ position: [0, 0, 10], fov: 40 }} gl={{ antialias: true }}>
        {/* Strong directional light from the LEFT representing the Sun */}
        <directionalLight position={[-10, 0, 0]} intensity={2.5} color="#ffffff" />
        
        {/* Subtle ambient light so the dark side isn't completely black */}
        <ambientLight intensity={0.05} color="#ffffff" />

        {/* Stars background */}
        <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />
        
        <Float speed={0.5} rotationIntensity={0.1} floatIntensity={0.1}>
            {/* Earth is rotated so a continent is facing the "sun" initially */}
            <group rotation={[0, THREE.MathUtils.degToRad(180), 0]}>
                <Earth />
            </group>
            <Magnetosphere intensity={currentKp} />
        </Float>

        <SolarWind count={200} intensity={currentKp} />

        <OrbitControls 
            enableZoom={true} 
            enablePan={false} 
            minDistance={6} 
            maxDistance={20}
            autoRotate={true}
            autoRotateSpeed={0.3} // Slowly rotate to show the whole globe
        />
      </Canvas>
    </div>
  );
};

export default SolarStormGlobe;