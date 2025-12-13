// laptop_map_control.js
import { FIREBASE_CONFIG, DB_IMU_PATH, INITIAL_COORDS } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Leaflet
import L from 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet-src.esm.js';

// init firebase
const app = initializeApp(FIREBASE_CONFIG);
const db = getDatabase(app);
const imuRef = ref(db, DB_IMU_PATH);

// UI elements
const dbstatusEl = document.getElementById('dbstatus');
const speedEl = document.getElementById('speed');
const headingEl = document.getElementById('heading');
const lastupdateEl = document.getElementById('lastupdate');

// Map init
const map = L.map('map').setView([INITIAL_COORDS.lat, INITIAL_COORDS.lng], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

let marker = L.marker([INITIAL_COORDS.lat, INITIAL_COORDS.lng]).addTo(map);
let path = L.polyline([[INITIAL_COORDS.lat, INITIAL_COORDS.lng]], { color: 'cyan' }).addTo(map);

// Simulation state for dead-reckoning
let sim = {
  lat: INITIAL_COORDS.lat,
  lng: INITIAL_COORDS.lng,
  heading: 0,   // degrees
  speed: 0,     // m/s
  lastTs: null
};

// smoothing params (exponential moving average)
const POS_ALPHA = 0.35;
const HEAD_ALPHA = 0.4;
const SPEED_ALPHA = 0.5;

// Map click sets start
map.on('click', (e) => {
  sim.lat = e.latlng.lat;
  sim.lng = e.latlng.lng;
  sim.heading = 0;
  sim.speed = 0;
  marker.setLatLng([sim.lat, sim.lng]);
  path.setLatLngs([[sim.lat, sim.lng]]);
});

// Interpret IMU -> control mapping
// We will map device beta (front/back tilt) to forward speed, gamma (left/right tilt) to steering
// On mobile: beta ~ -180..180 (forward/back), gamma ~ -90..90 (left/right)
function imuToControl(imu) {
  const orient = imu.orient || {};
  const beta = orient.beta ?? 0;
  const gamma = orient.gamma ?? 0;
  // Map beta tilt to speed: small tilt -> 0, strong forward tilt (positive or negative depending on device) -> up to 3 m/s
  const maxSpeed = 3.0; // m/s (tweak)
  let speed = Math.abs(beta) > 6 ? Math.min(maxSpeed, Math.abs(beta) / 60) : 0;
  // Map gamma to heading change rate (deg per second)
  const maxTurnRate = 80; // deg/s
  let steer = Math.abs(gamma) > 4 ? (gamma / 90) * maxTurnRate : 0;
  return { speed, steer }; // steer aligns/sign with gamma
}

// convert meters displacement to lat/lng delta (approximate, valid for small distances)
function metersToLatLng(lat, metersNorth, metersEast) {
  const R = 6378137; // Earth radius in meters
  const dLat = metersNorth / R;
  const dLng = metersEast / (R * Math.cos(Math.PI * lat / 180));
  const newLat = lat + (dLat * 180 / Math.PI);
  const newLng = sim.lng + (dLng * 180 / Math.PI);
  return { lat: newLat, lng: newLng };
}

// Apply low-pass filter for smoother UI
function ema(prev, curr, alpha) {
  if (prev === null || prev === undefined) return curr;
  return prev * (1 - alpha) + curr * alpha;
}

// When IMU updates in DB, compute controls and advance simulated vehicle
onValue(imuRef, (snap) => {
  const data = snap.val();
  if (!data) {
    dbstatusEl.textContent = 'NO DATA';
    return;
  }
  dbstatusEl.textContent = 'CONNECTED';
  lastupdateEl.textContent = new Date(data.ts).toLocaleTimeString();

  // Compute time delta
  const now = data.ts || Date.now();
  const dt = sim.lastTs ? Math.max(0.02, (now - sim.lastTs) / 1000) : 0.05;
  sim.lastTs = now;

  // Map imu -> control
  const { speed: rawSpeed, steer: rawSteer } = imuToControl(data);

  // Smooth speed & heading rate
  sim.speed = ema(sim.speed, rawSpeed, SPEED_ALPHA);

  // Update heading: add steer*dt (note: gamma sign direct maps)
  const newHeading = ema(sim.heading, sim.heading + rawSteer * dt, HEAD_ALPHA);
  sim.heading = (newHeading + 360) % 360;

  // Move forward by distance = speed * dt
  const dist = sim.speed * dt; // meters
  // Convert heading to meters north/east
  const headingRad = (sim.heading * Math.PI) / 180;
  const dNorth = dist * Math.cos(headingRad);
  const dEast = dist * Math.sin(headingRad);

  // Approx convert to lat/lng (small displacement)
  const R = 6378137;
  const dLat = (dNorth / R) * (180 / Math.PI);
  const dLng = (dEast / (R * Math.cos(Math.PI * sim.lat / 180))) * (180 / Math.PI);

  // Apply small smoothing to position update
  sim.lat = ema(sim.lat, sim.lat + dLat, POS_ALPHA);
  sim.lng = ema(sim.lng, sim.lng + dLng, POS_ALPHA);

  // Update UI & marker
  speedEl.textContent = sim.speed.toFixed(2);
  headingEl.textContent = Math.round(sim.heading);

  marker.setLatLng([sim.lat, sim.lng]);
  path.addLatLng([sim.lat, sim.lng]);

  // Optionally pan map to follow marker (comment/uncomment)
  map.panTo([sim.lat, sim.lng], { animate: false });
});
