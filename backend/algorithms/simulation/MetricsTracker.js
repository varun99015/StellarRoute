// MetricsTracker.js - Enhanced for TASK 3.8
// Location: backend/algorithms/simulation/MetricsTracker.js

class MetricsTracker {
    constructor() {
        // Core metrics
        this.metrics = {
            positionErrors: [],
            computationTimes: [],
            gpsOutages: [],
            riskExposure: [],
            routeChanges: [],
            sensorReadings: [],
            simulationEvents: []
        };
        
        // Performance counters
        this.counters = {
            steps: 0,
            gpsReadings: 0,
            imuReadings: 0,
            fusionOperations: 0,
            routeCalculations: 0,
            errors: 0,
            warnings: 0
        };
        
        // Statistical accumulators
        this.stats = {
            startTime: Date.now(),
            totalPositionError: 0,
            totalRiskExposure: 0,
            maxPositionError: 0,
            minPositionError: Infinity,
            gpsOutageDuration: 0,
            imuDrift: 0
        };
        
        // Real-time monitoring
        this.realtime = {
            currentPositionError: 0,
            currentRisk: 0,
            gpsAvailable: true,
            lastUpdate: Date.now()
        };
    }
    
    // ========== TRACKING METHODS ==========
    
    trackPositionError(error, truePosition, estimatedPosition) {
        this.metrics.positionErrors.push({
            timestamp: Date.now(),
            error,
            truePosition,
            estimatedPosition,
            gpsAvailable: this.realtime.gpsAvailable
        });
        
        // Update statistics
        this.stats.totalPositionError += error;
        this.stats.maxPositionError = Math.max(this.stats.maxPositionError, error);
        this.stats.minPositionError = Math.min(this.stats.minPositionError, error);
        this.realtime.currentPositionError = error;
        
        this.counters.steps++;
    }
    
    trackComputationTime(operation, time, details = {}) {
        this.metrics.computationTimes.push({
            timestamp: Date.now(),
            operation,
            time,
            details
        });
    }
    
    trackGPSOutage(startTime, endTime, maxDrift, averageDrift) {
        const outage = {
            timestamp: Date.now(),
            startTime,
            endTime,
            duration: endTime - startTime,
            maxDrift,
            averageDrift,
            positionAtStart: this.realtime.lastPosition,
            positionAtEnd: this.realtime.currentPosition
        };
        
        this.metrics.gpsOutages.push(outage);
        this.stats.gpsOutageDuration += outage.duration;
    }
    
    trackRiskExposure(time, riskValue, location, routeSegment) {
        const exposure = {
            timestamp: Date.now(),
            time,
            riskValue,
            location,
            routeSegment
        };
        
        this.metrics.riskExposure.push(exposure);
        this.stats.totalRiskExposure += riskValue * time;
        this.realtime.currentRisk = riskValue;
    }
    
    trackSensorReading(sensorType, reading, accuracy, timestamp) {
        this.metrics.sensorReadings.push({
            timestamp: timestamp || Date.now(),
            sensorType,
            reading,
            accuracy,
            gpsAvailable: this.realtime.gpsAvailable
        });
        
        if (sensorType === 'gps') this.counters.gpsReadings++;
        if (sensorType === 'imu') this.counters.imuReadings++;
    }
    
    trackFusionOperation(inputs, output, algorithm, duration) {
        this.metrics.simulationEvents.push({
            type: 'fusion',
            timestamp: Date.now(),
            inputs,
            output,
            algorithm,
            duration
        });
        
        this.counters.fusionOperations++;
        this.trackComputationTime('sensor_fusion', duration, { algorithm });
    }
    
    trackRouteChange(oldRoute, newRoute, reason, riskReduction) {
        const change = {
            timestamp: Date.now(),
            reason,
            oldRoute: {
                length: oldRoute.length,
                totalRisk: this.calculateRouteRisk(oldRoute),
                distance: this.calculateRouteDistance(oldRoute)
            },
            newRoute: {
                length: newRoute.length,
                totalRisk: this.calculateRouteRisk(newRoute),
                distance: this.calculateRouteDistance(newRoute)
            },
            riskReduction,
            position: this.realtime.currentPosition
        };
        
        this.metrics.routeChanges.push(change);
        this.counters.routeCalculations++;
    }
    
    trackEvent(type, message, data = {}) {
        this.metrics.simulationEvents.push({
            type,
            timestamp: Date.now(),
            message,
            data,
            position: this.realtime.currentPosition,
            positionError: this.realtime.currentPositionError
        });
        
        if (type === 'error') this.counters.errors++;
        if (type === 'warning') this.counters.warnings++;
    }
    
    // ========== CALCULATION METHODS ==========
    
    calculateRouteRisk(route) {
        if (!route || route.length === 0) return 0;
        
        let totalRisk = 0;
        for (let i = 0; i < route.length - 1; i++) {
            if (route[i].risk !== undefined) {
                totalRisk += route[i].risk;
            }
        }
        return totalRisk / Math.max(1, route.length - 1);
    }
    
    calculateRouteDistance(route) {
        if (!route || route.length < 2) return 0;
        
        let distance = 0;
        for (let i = 1; i < route.length; i++) {
            const dx = route[i].x - route[i-1].x;
            const dy = route[i].y - route[i-1].y;
            distance += Math.sqrt(dx*dx + dy*dy);
        }
        return distance;
    }
    
    // ========== REPORT GENERATION ==========
    
    getSummary() {
        const positionErrors = this.metrics.positionErrors.map(m => m.error);
        const avgPositionError = positionErrors.length > 0 ? 
            this.stats.totalPositionError / positionErrors.length : 0;
        
        const computationTimes = this.metrics.computationTimes.map(m => m.time);
        const totalComputationTime = computationTimes.length > 0 ?
            computationTimes.reduce((a, b) => a + b, 0) : 0;
        const avgComputationTime = computationTimes.length > 0 ?
            totalComputationTime / computationTimes.length : 0;
        
        const riskExposures = this.metrics.riskExposure.map(m => m.riskValue);
        const avgRiskExposure = riskExposures.length > 0 ?
            this.stats.totalRiskExposure / riskExposures.length : 0;
        
        const gpsOutageCount = this.metrics.gpsOutages.length;
        const avgOutageDuration = gpsOutageCount > 0 ?
            this.stats.gpsOutageDuration / gpsOutageCount : 0;
        
        const totalRuntime = Date.now() - this.stats.startTime;
        
        return {
            // Timing metrics
            totalRuntime: totalRuntime / 1000, // seconds
            simulationSteps: this.counters.steps,
            averageStepTime: totalRuntime / Math.max(1, this.counters.steps),
            
            // Position accuracy
            averagePositionError: avgPositionError,
            maximumPositionError: this.stats.maxPositionError,
            minimumPositionError: this.stats.minPositionError === Infinity ? 0 : this.stats.minPositionError,
            positionErrorStdDev: this.calculateStdDev(positionErrors),
            
            // GPS performance
            gpsAvailability: ((totalRuntime - this.stats.gpsOutageDuration) / totalRuntime * 100),
            totalGPSOutages: gpsOutageCount,
            averageGPSOutageDuration: avgOutageDuration / 1000, // seconds
            gpsReadings: this.counters.gpsReadings,
            
            // IMU performance
            imuReadings: this.counters.imuReadings,
            averageIMUDrift: this.calculateAverageIMUDrift(),
            
            // Risk management
            averageRiskExposure: avgRiskExposure,
            totalRiskExposure: this.stats.totalRiskExposure,
            riskReductionEvents: this.metrics.routeChanges.length,
            averageRiskReduction: this.calculateAverageRiskReduction(),
            
            // Computational performance
            totalComputationTime: totalComputationTime,
            averageComputationTime: avgComputationTime,
            fusionOperations: this.counters.fusionOperations,
            routeCalculations: this.counters.routeCalculations,
            
            // Reliability
            errors: this.counters.errors,
            warnings: this.counters.warnings,
            successRate: this.calculateSuccessRate(),
            
            // Real-time status
            currentPositionError: this.realtime.currentPositionError,
            currentRisk: this.realtime.currentRisk,
            uptime: totalRuntime / 1000
        };
    }
    
    // ========== HELPER METHODS ==========
    
    calculateStdDev(values) {
        if (values.length === 0) return 0;
        
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const squareDiffs = values.map(value => Math.pow(value - avg, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
        return Math.sqrt(avgSquareDiff);
    }
    
    calculateAverageIMUDrift() {
        if (this.metrics.gpsOutages.length === 0) return 0;
        
        let totalDrift = 0;
        this.metrics.gpsOutages.forEach(outage => {
            totalDrift += outage.averageDrift || 0;
        });
        
        return totalDrift / this.metrics.gpsOutages.length;
    }
    
    calculateAverageRiskReduction() {
        if (this.metrics.routeChanges.length === 0) return 0;
        
        let totalReduction = 0;
        this.metrics.routeChanges.forEach(change => {
            if (change.riskReduction) {
                totalReduction += change.riskReduction;
            }
        });
        
        return totalReduction / this.metrics.routeChanges.length;
    }
    
    calculateSuccessRate() {
        const totalEvents = this.counters.steps;
        const errorEvents = this.counters.errors;
        
        if (totalEvents === 0) return 100;
        return ((totalEvents - errorEvents) / totalEvents * 100);
    }
    
    // ========== REPORT GENERATORS ==========
    
    generateDetailedReport() {
        const summary = this.getSummary();
        
        return {
            metadata: {
                generatedAt: new Date().toISOString(),
                simulationDuration: summary.totalRuntime,
                totalSteps: summary.simulationSteps
            },
            
            summary: summary,
            
            detailedMetrics: {
                positionAccuracy: {
                    histogram: this.generateErrorHistogram(),
                    overTime: this.metrics.positionErrors.slice(-100), // Last 100 readings
                    byGPSStatus: this.separateMetricsByGPSStatus()
                },
                
                gpsPerformance: {
                    outages: this.metrics.gpsOutages,
                    availabilityOverTime: this.calculateGPSAvailabilityOverTime(),
                    readingAccuracy: this.calculateGPSAccuracy()
                },
                
                computationalPerformance: {
                    operations: this.metrics.computationTimes,
                    mostExpensiveOperations: this.identifyExpensiveOperations(),
                    timingDistribution: this.generateTimingDistribution()
                },
                
                riskAnalysis: {
                    exposureOverTime: this.metrics.riskExposure,
                    routeChanges: this.metrics.routeChanges,
                    riskReductionImpact: this.calculateRiskReductionImpact()
                },
                
                sensorPerformance: {
                    imuDriftDuringOutages: this.calculateIMUDriftDuringOutages(),
                    fusionAccuracy: this.calculateFusionAccuracy(),
                    sensorCalibration: this.assessSensorCalibration()
                }
            },
            
            recommendations: this.generateRecommendations(summary),
            
            rawData: {
                totalDataPoints: this.metrics.positionErrors.length + 
                                this.metrics.computationTimes.length +
                                this.metrics.sensorReadings.length,
                dataSize: this.estimateDataSize(),
                exportable: true
            }
        };
    }
    
    generateErrorHistogram() {
        const errors = this.metrics.positionErrors.map(m => m.error);
        const bins = [0, 5, 10, 20, 50, 100, 200, 500];
        const histogram = {};
        
        for (let i = 0; i < bins.length - 1; i++) {
            const key = `${bins[i]}-${bins[i+1]}m`;
            histogram[key] = errors.filter(e => e >= bins[i] && e < bins[i+1]).length;
        }
        
        // Last bin for errors >= max
        const lastKey = `>${bins[bins.length-1]}m`;
        histogram[lastKey] = errors.filter(e => e >= bins[bins.length-1]).length;
        
        return histogram;
    }
    
    separateMetricsByGPSStatus() {
        const withGPS = this.metrics.positionErrors.filter(m => m.gpsAvailable);
        const withoutGPS = this.metrics.positionErrors.filter(m => !m.gpsAvailable);
        
        return {
            withGPS: {
                count: withGPS.length,
                averageError: withGPS.length > 0 ? 
                    withGPS.reduce((sum, m) => sum + m.error, 0) / withGPS.length : 0,
                maxError: withGPS.length > 0 ? 
                    Math.max(...withGPS.map(m => m.error)) : 0
            },
            withoutGPS: {
                count: withoutGPS.length,
                averageError: withoutGPS.length > 0 ? 
                    withoutGPS.reduce((sum, m) => sum + m.error, 0) / withoutGPS.length : 0,
                maxError: withoutGPS.length > 0 ? 
                    Math.max(...withoutGPS.map(m => m.error)) : 0
            }
        };
    }
    
    calculateGPSAvailabilityOverTime() {
        const windowSize = 60; // 60-second windows
        const windows = [];
        const totalTime = Date.now() - this.stats.startTime;
        
        for (let i = 0; i < totalTime; i += windowSize * 1000) {
            const windowStart = this.stats.startTime + i;
            const windowEnd = windowStart + windowSize * 1000;
            
            const outagesInWindow = this.metrics.gpsOutages.filter(outage => 
                outage.endTime > windowStart && outage.startTime < windowEnd
            );
            
            let outageDuration = 0;
            outagesInWindow.forEach(outage => {
                const start = Math.max(outage.startTime, windowStart);
                const end = Math.min(outage.endTime, windowEnd);
                outageDuration += end - start;
            });
            
            const availability = ((windowSize * 1000 - outageDuration) / (windowSize * 1000)) * 100;
            
            windows.push({
                time: new Date(windowStart).toISOString(),
                availability,
                outages: outagesInWindow.length
            });
        }
        
        return windows;
    }
    
    identifyExpensiveOperations() {
        const operations = {};
        
        this.metrics.computationTimes.forEach(op => {
            if (!operations[op.operation]) {
                operations[op.operation] = {
                    count: 0,
                    totalTime: 0,
                    maxTime: 0
                };
            }
            
            operations[op.operation].count++;
            operations[op.operation].totalTime += op.time;
            operations[op.operation].maxTime = Math.max(
                operations[op.operation].maxTime, 
                op.time
            );
        });
        
        // Convert to array and sort by average time
        return Object.entries(operations)
            .map(([name, stats]) => ({
                operation: name,
                count: stats.count,
                averageTime: stats.totalTime / stats.count,
                maxTime: stats.maxTime,
                percentage: (stats.totalTime / this.metrics.computationTimes.reduce((sum, op) => sum + op.time, 0)) * 100
            }))
            .sort((a, b) => b.averageTime - a.averageTime);
    }
    
    generateRecommendations(summary) {
        const recommendations = [];
        
        // Position error recommendations
        if (summary.averagePositionError > 50) {
            recommendations.push({
                priority: 'high',
                category: 'accuracy',
                suggestion: 'Implement additional sensor fusion techniques (Kalman filter)',
                expectedImprovement: 'Reduce position error by 40-60%'
            });
        } else if (summary.averagePositionError > 20) {
            recommendations.push({
                priority: 'medium',
                category: 'accuracy',
                suggestion: 'Improve IMU calibration routine',
                expectedImprovement: 'Reduce position error by 20-30%'
            });
        }
        
        // GPS outage recommendations
        if (summary.totalGPSOutages > 3) {
            recommendations.push({
                priority: 'high',
                category: 'reliability',
                suggestion: 'Add predictive GPS outage detection',
                expectedImprovement: 'Reduce position drift during outages by 30%'
            });
        }
        
        // Computational performance
        if (summary.averageComputationTime > 100) { // ms
            recommendations.push({
                priority: 'medium',
                category: 'performance',
                suggestion: 'Optimize route calculation algorithms',
                expectedImprovement: 'Reduce computation time by 50%'
            });
        }
        
        // Risk management
        if (summary.averageRiskExposure > 0.7) {
            recommendations.push({
                priority: 'high',
                category: 'safety',
                suggestion: 'Implement dynamic risk threshold adjustment',
                expectedImprovement: 'Reduce risk exposure by 25-40%'
            });
        }
        
        return recommendations;
    }
    
    estimateDataSize() {
        // Rough estimate in bytes
        let size = 0;
        
        size += JSON.stringify(this.metrics).length;
        size += JSON.stringify(this.counters).length;
        size += JSON.stringify(this.stats).length;
        size += JSON.stringify(this.realtime).length;
        
        return {
            bytes: size,
            kilobytes: (size / 1024).toFixed(2),
            megabytes: (size / (1024 * 1024)).toFixed(2)
        };
    }
    
    reset() {
        // Create snapshot before reset
        const snapshot = this.generateDetailedReport();
        
        // Reset all data
        this.metrics = {
            positionErrors: [],
            computationTimes: [],
            gpsOutages: [],
            riskExposure: [],
            routeChanges: [],
            sensorReadings: [],
            simulationEvents: []
        };
        
        this.counters = {
            steps: 0,
            gpsReadings: 0,
            imuReadings: 0,
            fusionOperations: 0,
            routeCalculations: 0,
            errors: 0,
            warnings: 0
        };
        
        this.stats = {
            startTime: Date.now(),
            totalPositionError: 0,
            totalRiskExposure: 0,
            maxPositionError: 0,
            minPositionError: Infinity,
            gpsOutageDuration: 0,
            imuDrift: 0
        };
        
        this.realtime = {
            currentPositionError: 0,
            currentRisk: 0,
            gpsAvailable: true,
            lastUpdate: Date.now()
        };
        
        return snapshot;
    }
    
    exportToCSV() {
        // Create CSV strings for different metrics
        const csvs = {};
        
        // Position errors CSV
        if (this.metrics.positionErrors.length > 0) {
            let csv = 'Timestamp,Error,TrueX,TrueY,EstX,EstY,GPSAvailable\n';
            this.metrics.positionErrors.forEach(m => {
                csv += `${new Date(m.timestamp).toISOString()},${m.error},${m.truePosition[0]},${m.truePosition[1]},${m.estimatedPosition[0]},${m.estimatedPosition[1]},${m.gpsAvailable}\n`;
            });
            csvs.positionErrors = csv;
        }
        
        // Computation times CSV
        if (this.metrics.computationTimes.length > 0) {
            let csv = 'Timestamp,Operation,Time(ms),Details\n';
            this.metrics.computationTimes.forEach(m => {
                csv += `${new Date(m.timestamp).toISOString()},${m.operation},${m.time},"${JSON.stringify(m.details)}"\n`;
            });
            csvs.computationTimes = csv;
        }
        
        return csvs;
    }
}

module.exports = MetricsTracker;