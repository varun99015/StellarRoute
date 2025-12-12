# 🌟 StellarRoute: Space-Weather Aware Navigation System

**Navigation that survives solar storms.** StellarRoute predicts GPS degradation from solar activity and provides continuous navigation through intelligent rerouting and sensor-fusion fallback.

[![Live Demo](https://img.shields.io/badge/demo-live-green)](http://your-demo-link.com)
[![Backend API](https://img.shields.io/badge/API-online-brightgreen)](http://localhost:8000/docs)
[![Frontend](https://img.shields.io/badge/frontend-react-blue)](http://localhost:3000)

## 🎯 The Problem
**Solar storms disrupt GPS signals**, causing navigation failures in:
- ✈️ Aviation (flight path deviations)
- 🚚 Logistics (fleet tracking loss)
- 🚗 Autonomous vehicles (safety critical)
- 📡 Critical infrastructure (timing synchronization)

**Current navigation systems have no solar-storm protection** — they either fail completely or provide dangerously inaccurate positions during geomagnetic disturbances.

## 💡 Our Solution
StellarRoute provides **three layers of protection**:

### 1️⃣ **Predictive Risk Mapping**
- Fetches real-time space weather data from NOAA/NASA
- Converts Kp-index, solar wind, and geomagnetic data into GPS error estimates
- Generates live risk heatmaps showing areas of GPS degradation

### 2️⃣ **Intelligent Safe Routing**
- A* pathfinding algorithm with risk-based penalties
- Calculates both "normal" (shortest) and "storm-safe" (lowest risk) routes
- Real-time rerouting when solar conditions change

### 3️⃣ **GPS Failure Resilience**
- Simulated IMU (Inertial Measurement Unit) dead reckoning
- Continuous navigation during complete GPS outages
- Automatic resynchronization when GPS returns
✅ Test scenarios documented and working

✅ Performance metrics collected
