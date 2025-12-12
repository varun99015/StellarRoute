export const DEMO_COORDINATES = {
  SAN_FRANCISCO: [37.7749, -122.4194],
  OAKLAND: [37.8044, -122.2712],
  BERKELEY: [37.8716, -122.2727],
  SAN_JOSE: [37.3382, -121.8863],
}

export const SCENARIOS = {
  NORMAL: 'normal',
  MODERATE: 'moderate',
  SEVERE: 'severe'
}

export const SCENARIO_CONFIG = {
  normal: { label: 'Normal', kp: 2, color: 'bg-green-100' },
  moderate: { label: 'Moderate', kp: 5, color: 'bg-yellow-100' },
  severe: { label: 'Severe', kp: 8, color: 'bg-red-100' }
}

export const RISK_LEVELS = {
  low: { label: 'Low', color: '#4CAF50', bg: 'bg-risk-low', text: 'text-risk-low' },
  medium: { label: 'Medium', color: '#FFC107', bg: 'bg-risk-medium', text: 'text-risk-medium' },
  high: { label: 'High', color: '#F44336', bg: 'bg-risk-high', text: 'text-risk-high' }
}