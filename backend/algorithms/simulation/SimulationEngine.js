// SimulationEngine.js
// Location: backend/algorithms/simulation/SimulationEngine.js

const MetricsTracker = require('./MetricsTracker');



// SimulationEngine.js - UPDATED WITH CORRECT PATHS
// Location: backend/algorithms/simulation/SimulationEngine.js

const IMUSimulator = require('../sensor_fusion/IMUSimulator');
const GPSSimulator = require('../sensor_fusion/GPSSimulator');
const DeadReckoning = require('../sensor_fusion/DeadReckoning');
const SensorFusion = require('../sensor_fusion/SensorFusion');



// Routing modules
const EnhancedAStar = require('../routing/EnhancedAStar');
const RouteGenerator = require('../routing/RouteGenerator');

class SimulationEngine {
    constructor(config = {}) {
        this.config = {
            logLevel: config.logLevel || 'info',
            simulationSpeed: config.simulationSpeed || 1.0,
            maxPositionError: config.maxPositionError || 50, // meters
            ...config
        };
        
        this.scenarios = this.initializeScenarios();
        this.data = [];
        this.logs = [];
        this.metricsTracker = new MetricsTracker();
        this.isRunning = false;
    }
    
    initializeScenarios() {
        return [
            {
                id: 'scenario1',
                name: 'Normal Conditions',
                description: 'GPS active, low risk environment',
                duration: 60, // seconds
                gpsRisk: 'low',
                imuNoise: 'low',
                gpsOutage: false,
                startPosition: [0, 0],
                endPosition: [1000, 1000]
            },
            {
                id: 'scenario2',
                name: 'Storm Warning',
                description: 'High GPS noise, reroute to safe path',
                duration: 90,
                gpsRisk: 'high',
                imuNoise: 'medium',
                gpsOutage: false,
                startPosition: [0, 0],
                endPosition: [2000, 2000],
                riskLevel: 'high'
            },
            {
                id: 'scenario3',
                name: 'GPS Failure',
                description: 'GPS outage, IMU takes over',
                duration: 120,
                gpsRisk: 'high',
                imuNoise: 'medium',
                gpsOutage: true,
                gpsOutageStart: 30,
                gpsOutageEnd: 90,
                startPosition: [0, 0],
                endPosition: [1500, 1500]
            },
            {
                id: 'scenario4',
                name: 'GPS Recovery',
                description: 'GPS returns and system resyncs',
                duration: 150,
                gpsRisk: 'medium',
                imuNoise: 'medium',
                gpsOutage: true,
                gpsOutageStart: 40,
                gpsOutageEnd: 100,
                gpsRecovery: true,
                startPosition: [0, 0],
                endPosition: [1800, 1800]
            }
        ];
    }
    
    getScenarios() {
        return this.scenarios;
    }
    
    addScenario(scenario) {
        this.scenarios.push(scenario);
    }
    
    async runScenario(scenarioId) {
        const scenario = this.scenarios.find(s => s.id === scenarioId);
        if (!scenario) {
            throw new Error(`Scenario ${scenarioId} not found`);
        }
        
        console.log(`Starting scenario: ${scenario.name}`);
        this.isRunning = true;
        this.data = [];
        this.logs = [];
        
        const startTime = Date.now();
        
        try {
            // Initialize components
            const imu = new IMUSimulator(scenario.imuNoise);
            const gps = new GPSSimulator(scenario.gpsRisk);
            const deadReckoning = new DeadReckoning();
            const sensorFusion = new SensorFusion();
            
            // Initialize routing
            const grid = this.createTestGrid(50, 50);
            const riskMap = this.createRiskMap(50, 50, scenario.riskLevel || 'low');
            const routeGenerator = new RouteGenerator(grid, riskMap);
            const astar = new EnhancedAStar(grid, riskMap);
            
            // Generate route
            const routes = routeGenerator.generateAlternativeRoutes(
                {x: scenario.startPosition[0], y: scenario.startPosition[1]},
                {x: scenario.endPosition[0], y: scenario.endPosition[1]}
            );
            
            const selectedRoute = routes[1]; // Balanced route
            
            // Run simulation steps
            const timeStep = 1.0 / this.config.simulationSpeed; // seconds per step
            const steps = Math.floor(scenario.duration / timeStep);
            
            let currentPosition = [...scenario.startPosition];
            let truePosition = [...scenario.startPosition];
            let heading = 0;
            
            for (let step = 0; step < steps; step++) {
                const time = step * timeStep;
                
                // Update true position (simulate movement along route)
                truePosition = this.simulateMovement(truePosition, selectedRoute, time, scenario.duration);
                
                // Check GPS outage
                let gpsAvailable = true;
                if (scenario.gpsOutage && time > scenario.gpsOutageStart && time < scenario.gpsOutageEnd) {
                    gpsAvailable = false;
                    gps.setAvailable(false);
                } else {
                    gps.setAvailable(true);
                }
                
                // Get sensor readings
                const imuReading = imu.getReading(currentPosition, heading);
                const gpsReading = gps.getReading(truePosition);
                
                // Fuse sensors
                const fusedPosition = sensorFusion.fuse(imuReading, gpsReading, gpsAvailable);
                
                // Update dead reckoning if GPS is out
                if (!gpsAvailable) {
                    deadReckoning.update(imuReading);
                }
                
                // Update current position estimate
                currentPosition = fusedPosition;
                
                // Log data
                const positionError = this.calculateError(fusedPosition, truePosition);
                this.data.push({
                    timestamp: startTime + (time * 1000),
                    time,
                    step,
                    truePosition,
                    fusedPosition,
                    imuReading,
                    gpsReading,
                    gpsAvailable,
                    positionError,
                    heading
                });
                
                // Add to logs
                if (step % 10 === 0) {
                    this.logs.push({
                        timestamp: new Date().toISOString(),
                        level: 'info',
                        message: `Step ${step}: Position error = ${positionError.toFixed(2)}m, GPS = ${gpsAvailable ? 'OK' : 'OUT'}`
                    });
                }
                
                // Check for excessive error
                if (positionError > this.config.maxPositionError) {
                    this.logs.push({
                        timestamp: new Date().toISOString(),
                        level: 'warning',
                        message: `Position error exceeded threshold: ${positionError.toFixed(2)}m`
                    });
                }
            }
            
            // Generate report
            const report = this.generateReport(scenario);
            
            this.isRunning = false;
            
            return {
                scenario,
                report,
                success: true,
                duration: Date.now() - startTime
            };
            
        } catch (error) {
            this.isRunning = false;
            throw error;
        }
    }
    
    async runAllScenarios() {
        const results = [];
        const startTime = Date.now();
        
        for (const scenario of this.scenarios) {
            try {
                console.log(`Running scenario: ${scenario.name}`);
                const result = await this.runScenario(scenario.id);
                results.push(result);
            } catch (error) {
                console.error(`Failed to run scenario ${scenario.name}:`, error.message);
                results.push({
                    scenario,
                    error: error.message,
                    success: false
                });
            }
        }
        
        const finalReport = this.generateFinalReport(results);
        
        return {
            results,
            finalReport,
            totalDuration: Date.now() - startTime
        };
    }
    
    simulateMovement(currentPos, route, time, totalTime) {
        // Simple linear movement simulation
        const progress = Math.min(time / totalTime, 1.0);
        if (route && route.length > 0) {
            const targetIndex = Math.min(Math.floor(progress * route.length), route.length - 1);
            const targetNode = route[targetIndex];
            return [targetNode.x, targetNode.y];
        }
        return currentPos;
    }
    
    calculateError(pos1, pos2) {
        const dx = pos1[0] - pos2[0];
        const dy = pos1[1] - pos2[1];
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    createTestGrid(width, height) {
        const grid = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                // Simple grid with some obstacles
                const isObstacle = Math.random() > 0.8;
                row.push(isObstacle ? 'obstacle' : 'road');
            }
            grid.push(row);
        }
        return grid;
    }
    
    createRiskMap(width, height, riskLevel) {
        const riskMap = [];
        const baseRisk = {
            low: 0.1,
            medium: 0.3,
            high: 0.6
        }[riskLevel] || 0.1;
        
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                // Add some random variation
                const variation = (Math.random() - 0.5) * 0.2;
                row.push(Math.max(0, Math.min(1, baseRisk + variation)));
            }
            riskMap.push(row);
        }
        return riskMap;
    }
    
    generateReport(scenario) {
        const errors = this.data.map(d => d.positionError);
        const avgError = errors.length > 0 ? errors.reduce((a, b) => a + b, 0) / errors.length : 0;
        const maxError = errors.length > 0 ? Math.max(...errors) : 0;
        
        const gpsOutageData = this.data.filter(d => !d.gpsAvailable);
        const gpsOutageTime = gpsOutageData.length > 0 ? 
            gpsOutageData[gpsOutageData.length - 1].time - gpsOutageData[0].time : 0;
        
        const avgErrorDuringOutage = gpsOutageData.length > 0 ?
            gpsOutageData.map(d => d.positionError).reduce((a, b) => a + b, 0) / gpsOutageData.length : 0;
        
        return {
            summary: `Completed ${scenario.name} with ${this.data.length} steps`,
            metrics: {
                positionError: {
                    average: avgError,
                    maximum: maxError,
                    duringGPSOutage: avgErrorDuringOutage
                },
                gpsOutage: {
                    totalOutages: gpsOutageData.length > 0 ? 1 : 0,
                    totalDuration: gpsOutageTime,
                    averageDrift: avgErrorDuringOutage
                },
                time: {
                    totalTravel: scenario.duration,
                    averageStepTime: scenario.duration / this.data.length
                },
                risk: {
                    averageReduction: Math.random() * 20 + 10 // Placeholder
                },
                sensors: {
                    resyncEvents: gpsOutageData.length > 0 && 
                        this.data.find(d => d.gpsAvailable && d.time > gpsOutageTime) ? 1 : 0
                }
            },
            recommendations: [
                avgError > 20 ? 'Consider improving sensor calibration' : 'Sensor calibration is adequate',
                gpsOutageTime > 30 ? 'Increase dead reckoning accuracy for longer outages' : 'Dead reckoning performance is good'
            ]
        };
    }
    
    generateFinalReport(results) {
        const successfulResults = results.filter(r => r.success);
        
        const overallMetrics = {
            averagePositionError: 0,
            totalTravelTime: 0,
            totalGPSOutages: 0,
            averageRiskReduction: 0
        };
        
        if (successfulResults.length > 0) {
            overallMetrics.averagePositionError = 
                successfulResults.reduce((sum, r) => sum + r.report.metrics.positionError.average, 0) / successfulResults.length;
            
            overallMetrics.totalTravelTime = 
                successfulResults.reduce((sum, r) => sum + r.report.metrics.time.totalTravel, 0);
            
            overallMetrics.totalGPSOutages = 
                successfulResults.reduce((sum, r) => sum + r.report.metrics.gpsOutage.totalOutages, 0);
            
            overallMetrics.averageRiskReduction = 
                successfulResults.reduce((sum, r) => sum + r.report.metrics.risk.averageReduction, 0) / successfulResults.length;
        }
        
        const recommendations = [
            'Implement automatic sensor calibration routine',
            'Add redundancy with additional navigation systems',
            'Develop predictive models for GPS signal quality',
            'Optimize route planning for varying risk conditions'
        ];
        
        return {
            overallMetrics,
            recommendations,
            totalScenarios: results.length,
            successfulScenarios: successfulResults.length
        };
    }
    
    getSimulationData() {
        return {
            data: this.data,
            logs: this.logs,
            config: this.config
        };
    }
    
}

module.exports = SimulationEngine;