const FilmCoverageModel = (function() {
    'use strict';

    const CONFIG = {
        CRITICAL_BLOWING_RATIO: 1.2,
        FILM_INFLUENCE_RADIUS: 80,
        JET_TRAJECTORY_SCALE: 1.5,
        INTERFERENCE_DECAY_RATE: 0.3,
        SPANWISE_RESOLUTION: 100,
        CHORDWISE_RESOLUTION: 100,
        SUPERPOSITION_BASE: 1.0,
        SUPERPOSITION_COEFFICIENT: 1.0,
        SUPERPOSITION_CAP: 3.0
    };

    class JetTrajectoryModel {
        constructor() {
            this.config = CONFIG;
        }

        calculateTrajectory(hole, blowingRatio, distance) {
            const M = blowingRatio;
            const diameter = hole.diameter;
            
            const jetHeight = this._calculateJetHeight(M, diameter, distance);
            const jetSpread = this._calculateJetSpread(M, diameter, distance);
            const trajectoryAngle = this._calculateTrajectoryAngle(hole, M, distance);
            
            return {
                height: jetHeight,
                spread: jetSpread,
                angle: trajectoryAngle,
                centerX: hole.x + Math.cos(hole.angle) * distance,
                centerY: hole.y + Math.sin(hole.angle) * distance,
                effectiveRadius: Math.max(diameter * 2, jetSpread)
            };
        }

        _calculateJetHeight(M, diameter, distance) {
            if (M <= CONFIG.CRITICAL_BLOWING_RATIO) {
                return 0.1 * diameter * Math.exp(0.02 * distance / diameter);
            } else {
                const liftCoeff = (M - CONFIG.CRITICAL_BLOWING_RATIO) * 0.5;
                return diameter * liftCoeff * Math.log(1 + distance / diameter);
            }
        }

        _calculateJetSpread(M, diameter, distance) {
            const xOverD = distance / diameter;
            const baseSpread = diameter * (1 + 0.1 * xOverD);
            
            if (M <= CONFIG.CRITICAL_BLOWING_RATIO) {
                return baseSpread * (1 + 0.05 * M);
            } else {
                return baseSpread * (1.5 + 0.1 * (M - CONFIG.CRITICAL_BLOWING_RATIO));
            }
        }

        _calculateTrajectoryAngle(hole, M, distance) {
            const baseAngle = hole.angle;
            
            if (M <= CONFIG.CRITICAL_BLOWING_RATIO) {
                return baseAngle;
            } else {
                const liftAngle = (M - CONFIG.CRITICAL_BLOWING_RATIO) * 0.1;
                return baseAngle + liftAngle * Math.min(1, distance / (CONFIG.FILM_INFLUENCE_RADIUS));
            }
        }

        calculateEffectivenessDecay(hole, blowingRatio, distance) {
            const M = blowingRatio;
            const xOverD = distance / Math.max(hole.diameter, 0.1);
            
            let baseEta;
            if (M < 0.3) {
                baseEta = 0.95 * Math.exp(-0.04 * xOverD / Math.max(M, 0.01));
            } else if (M < CONFIG.CRITICAL_BLOWING_RATIO) {
                const peakM = 0.6;
                const envelope = 1.0 - Math.pow((M - peakM) / (CONFIG.CRITICAL_BLOWING_RATIO - peakM), 2);
                baseEta = 0.9 * envelope * Math.exp(-0.04 * xOverD / Math.max(M, 0.1));
            } else {
                const detachmentFactor = 1.0 / (1.0 + Math.pow(M - CONFIG.CRITICAL_BLOWING_RATIO, 2) * 10.0);
                baseEta = 0.2 * detachmentFactor * Math.exp(-0.2 * xOverD / Math.max(M, 0.01));
            }
            
            const heightPenalty = Math.exp(-0.05 * this._calculateJetHeight(M, hole.diameter, distance) / hole.diameter);
            
            return baseEta * heightPenalty;
        }
    }

    class HoleInterferenceModel {
        constructor() {
            this.config = CONFIG;
        }

        calculateInterferenceMatrix(holes) {
            const matrix = [];
            
            for (let i = 0; i < holes.length; i++) {
                matrix[i] = [];
                for (let j = 0; j < holes.length; j++) {
                    if (i === j) {
                        matrix[i][j] = 1.0;
                    } else {
                        matrix[i][j] = this._calculatePairwiseInterference(holes[i], holes[j]);
                    }
                }
            }
            
            return matrix;
        }

        _calculatePairwiseInterference(holeA, holeB) {
            const distance = Math.sqrt(
                Math.pow(holeA.x - holeB.x, 2) + Math.pow(holeA.y - holeB.y, 2)
            );
            
            const spacingToDiameter = distance / Math.max((holeA.diameter + holeB.diameter) / 2, 0.1);
            
            if (spacingToDiameter < 2) {
                return 1.0;
            } else if (spacingToDiameter > 15) {
                return 0;
            } else {
                return Math.exp(-CONFIG.INTERFERENCE_DECAY_RATE * (spacingToDiameter - 2));
            }
        }

        calculateSuperpositionFactor(holes, pointX, pointY, blowingRatio) {
            let totalWeight = 0;
            let activeHoles = 0;
            
            for (const hole of holes) {
                const distance = Math.sqrt(
                    Math.pow(pointX - hole.x, 2) + Math.pow(pointY - hole.y, 2)
                );
                
                if (distance <= CONFIG.FILM_INFLUENCE_RADIUS) {
                    const weight = Math.exp(
                        -Math.pow(distance / (CONFIG.FILM_INFLUENCE_RADIUS * 0.5), 2)
                    );
                    totalWeight += weight;
                    activeHoles++;
                }
            }
            
            const spacingFactor = this._calculateSpacingFactor(holes);
            const superposition = CONFIG.SUPERPOSITION_BASE + 
                CONFIG.SUPERPOSITION_COEFFICIENT * Math.log(1 + activeHoles * spacingFactor);
            
            return {
                factor: Math.min(CONFIG.SUPERPOSITION_CAP, superposition),
                activeHoles: activeHoles,
                totalWeight: totalWeight,
                spacingFactor: spacingFactor
            };
        }

        _calculateSpacingFactor(holes) {
            if (holes.length < 2) return 1.0;
            
            let minSpacing = Infinity;
            for (let i = 0; i < holes.length; i++) {
                for (let j = i + 1; j < holes.length; j++) {
                    const dist = Math.sqrt(
                        Math.pow(holes[i].x - holes[j].x, 2) + 
                        Math.pow(holes[i].y - holes[j].y, 2)
                    );
                    minSpacing = Math.min(minSpacing, dist);
                }
            }
            
            const avgDiameter = holes.reduce((sum, h) => sum + h.diameter, 0) / holes.length;
            const spacingToDiameter = minSpacing / Math.max(avgDiameter, 0.1);
            
            return Math.max(0.5, Math.min(1.5, 10 / Math.max(spacingToDiameter, 1)));
        }
    }

    class BlowingRatioModel {
        constructor() {
            this.config = CONFIG;
        }

        calculateBlowingRatio(coolantPressure, coolantTemp, mainstreamPressure, mainstreamTemp) {
            const rho_c = coolantPressure * 1e6 / (287 * (coolantTemp + 273.15));
            const rho_g = mainstreamPressure * 1e6 / (287 * (mainstreamTemp + 273.15));
            const V_c = Math.sqrt(2 * Math.max(coolantPressure - mainstreamPressure, 0.01) * 1e6 / rho_c);
            const V_g = 200;
            return (rho_c * V_c) / (rho_g * V_g);
        }

        calculateDetachmentMetrics(blowingRatio) {
            if (blowingRatio <= CONFIG.CRITICAL_BLOWING_RATIO) {
                return {
                    isDetached: false,
                    detachmentSeverity: 0,
                    detachmentFactor: 1.0,
                    regime: 'attached'
                };
            }
            
            const excessRatio = (blowingRatio - CONFIG.CRITICAL_BLOWING_RATIO) / 
                Math.max(CONFIG.CRITICAL_BLOWING_RATIO, 0.01);
            const severity = Math.min(1.0, excessRatio * 2.0);
            const factor = 1.0 - severity * 0.7;
            
            let regime = 'transitional';
            if (excessRatio > 0.5) regime = 'fully_detached';
            if (excessRatio > 1.5) regime = 'blowoff';
            
            return {
                isDetached: true,
                detachmentSeverity: severity * 100,
                detachmentFactor: factor,
                regime: regime,
                excessRatio: excessRatio
            };
        }

        calculateFlowFactor(coolantFlow, blowingRatio) {
            const baseFlowFactor = Math.min(Math.max(coolantFlow / 0.08, 0.3), 1.2);
            
            if (blowingRatio <= CONFIG.CRITICAL_BLOWING_RATIO) {
                return baseFlowFactor;
            } else {
                const detachmentPenalty = 1.0 - (blowingRatio - CONFIG.CRITICAL_BLOWING_RATIO) * 0.2;
                return baseFlowFactor * Math.max(0.3, detachmentPenalty);
            }
        }
    }

    class SpanwiseEfficiencyStore {
        constructor(spanwiseBins = 20) {
            this.spanwiseBins = spanwiseBins;
            this.efficiencyData = new Map();
            this.timeHistory = [];
        }

        initialize(holes, spanwiseExtent) {
            this.holes = holes;
            this.spanwiseExtent = spanwiseExtent;
            const extentRange = Array.isArray(spanwiseExtent) 
                ? spanwiseExtent[1] - spanwiseExtent[0] 
                : spanwiseExtent;
            this.binSize = extentRange / this.spanwiseBins;
            
            for (let i = 0; i < this.spanwiseBins; i++) {
                this.efficiencyData.set(i, {
                    eta: 0,
                    temperature: 0,
                    coverage: 0,
                    sampleCount: 0
                });
            }
        }

        addSample(spanwisePosition, eta, temperature, coverage = 1) {
            const binIndex = Math.floor(
                ((spanwisePosition - this.spanwiseExtent[0]) / 
                (this.spanwiseExtent[1] - this.spanwiseExtent[0])) * this.spanwiseBins
            );
            
            const clampedIndex = Math.max(0, Math.min(this.spanwiseBins - 1, binIndex));
            const bin = this.efficiencyData.get(clampedIndex);
            
            if (bin) {
                const totalSamples = bin.sampleCount + 1;
                bin.eta = (bin.eta * bin.sampleCount + eta) / totalSamples;
                bin.temperature = (bin.temperature * bin.sampleCount + temperature) / totalSamples;
                bin.coverage = (bin.coverage * bin.sampleCount + coverage) / totalSamples;
                bin.sampleCount = totalSamples;
            }
        }

        getSpanwiseProfile() {
            const profile = [];
            for (let i = 0; i < this.spanwiseBins; i++) {
                const bin = this.efficiencyData.get(i);
                profile.push({
                    index: i,
                    position: this.spanwiseExtent[0] + (i + 0.5) * this.binSize,
                    efficiency: bin ? bin.eta : 0,
                    temperature: bin ? bin.temperature : 0,
                    coverage: bin ? bin.coverage : 0,
                    sampleCount: bin ? bin.sampleCount : 0
                });
            }
            return profile;
        }

        getAverageEfficiency() {
            let totalEta = 0;
            let totalWeight = 0;
            
            for (const bin of this.efficiencyData.values()) {
                if (bin.sampleCount > 0) {
                    totalEta += bin.eta * bin.sampleCount;
                    totalWeight += bin.sampleCount;
                }
            }
            
            return totalWeight > 0 ? totalEta / totalWeight : 0;
        }

        saveTimeSnapshot(time) {
            this.timeHistory.push({
                time: time,
                profile: this.getSpanwiseProfile(),
                averageEfficiency: this.getAverageEfficiency()
            });
        }

        getStatistics() {
            const profile = this.getSpanwiseProfile();
            const validBins = profile.filter(b => b.sampleCount > 0);
            
            if (validBins.length === 0) {
                return {
                    avgEfficiency: 0,
                    maxEfficiency: 0,
                    minEfficiency: 0,
                    stdEfficiency: 0,
                    uniformity: 0
                };
            }
            
            const etas = validBins.map(b => b.efficiency);
            const avg = etas.reduce((a, b) => a + b, 0) / etas.length;
            const max = Math.max(...etas);
            const min = Math.min(...etas);
            const variance = etas.reduce((sum, e) => sum + Math.pow(e - avg, 2), 0) / etas.length;
            const std = Math.sqrt(variance);
            const uniformity = 1 - (std / Math.max(avg, 0.01));
            
            return {
                avgEfficiency: avg,
                maxEfficiency: max,
                minEfficiency: min,
                stdEfficiency: std,
                uniformity: Math.max(0, uniformity),
                spanwiseProfile: profile
            };
        }

        export() {
            return {
                spanwiseBins: this.spanwiseBins,
                binSize: this.binSize,
                spanwiseExtent: this.spanwiseExtent,
                efficiencyData: Array.from(this.efficiencyData.entries()),
                timeHistory: this.timeHistory,
                statistics: this.getStatistics()
            };
        }

        import(data) {
            this.spanwiseBins = data.spanwiseBins;
            this.binSize = data.binSize;
            this.spanwiseExtent = data.spanwiseExtent;
            this.efficiencyData = new Map(data.efficiencyData);
            this.timeHistory = data.timeHistory || [];
        }

        clear() {
            for (const key of this.efficiencyData.keys()) {
                this.efficiencyData.set(key, {
                    eta: 0,
                    temperature: 0,
                    coverage: 0,
                    sampleCount: 0
                });
            }
        }
    }

    class UnifiedFilmCoverageModel {
        constructor() {
            this.jetModel = new JetTrajectoryModel();
            this.interferenceModel = new HoleInterferenceModel();
            this.blowingRatioModel = new BlowingRatioModel();
            this.spanwiseStore = new SpanwiseEfficiencyStore();
            
            this.interferenceMatrix = null;
            this.currentBlowingRatio = 0;
            this.detachmentMetrics = null;
        }

        initialize(holes, params) {
            this.holes = holes;
            this.params = params;
            
            this.interferenceMatrix = this.interferenceModel.calculateInterferenceMatrix(holes);
            
            this.currentBlowingRatio = this.blowingRatioModel.calculateBlowingRatio(
                params.coolantPressure,
                params.coolantTemp,
                params.mainstreamPressure,
                params.mainstreamTemp
            );
            
            this.detachmentMetrics = this.blowingRatioModel.calculateDetachmentMetrics(
                this.currentBlowingRatio
            );
            
            const bounds = { minX: -50, maxX: 350, minY: -50, maxY: 150 };
            this.spanwiseStore.initialize(holes, [bounds.minY, bounds.maxY]);
        }

        calculatePointCoverage(pointX, pointY) {
            let totalEta = 0;
            let maxEta = 0;
            let contributions = [];
            
            for (let i = 0; i < this.holes.length; i++) {
                const hole = this.holes[i];
                const distance = Math.sqrt(
                    Math.pow(pointX - hole.x, 2) + Math.pow(pointY - hole.y, 2)
                );
                
                if (distance > CONFIG.FILM_INFLUENCE_RADIUS) continue;
                
                const trajectory = this.jetModel.calculateTrajectory(
                    hole, this.currentBlowingRatio, distance
                );
                
                const baseEta = this.jetModel.calculateEffectivenessDecay(
                    hole, this.currentBlowingRatio, distance
                );
                
                let interferenceFactor = 0;
                for (let j = 0; j < this.holes.length; j++) {
                    if (i !== j && this.interferenceMatrix[i][j] > 0.1) {
                        interferenceFactor += this.interferenceMatrix[i][j];
                    }
                }
                interferenceFactor = 1 + interferenceFactor * 0.1;
                
                const flowFactor = this.blowingRatioModel.calculateFlowFactor(
                    this.params.coolantFlow,
                    this.currentBlowingRatio
                );
                
                const holeEta = baseEta * interferenceFactor * flowFactor * 
                    this.detachmentMetrics.detachmentFactor;
                
                const weight = Math.exp(
                    -Math.pow(distance / (CONFIG.FILM_INFLUENCE_RADIUS * 0.5), 2)
                );
                
                totalEta += holeEta * weight;
                maxEta = Math.max(maxEta, holeEta);
                
                contributions.push({
                    holeIndex: i,
                    distance: distance,
                    baseEta: baseEta,
                    interferenceFactor: interferenceFactor,
                    weightedEta: holeEta * weight
                });
            }
            
            const superposition = this.interferenceModel.calculateSuperpositionFactor(
                this.holes, pointX, pointY, this.currentBlowingRatio
            );
            
            const combinedEta = Math.min(1.0, totalEta * superposition.factor);
            
            return {
                eta: combinedEta,
                maxEta: maxEta,
                totalWeight: superposition.totalWeight,
                activeHoles: superposition.activeHoles,
                superpositionFactor: superposition.factor,
                spacingFactor: superposition.spacingFactor,
                contributions: contributions
            };
        }

        updateSpanwiseStore(temperatureField, filmCoverageField, bounds, gridSize, coolantTemp, mainstreamTemp) {
            this.spanwiseStore.clear();
            
            const dx = (bounds.maxX - bounds.minX) / gridSize;
            const dy = (bounds.maxY - bounds.minY) / gridSize;
            const tempRange = Math.max(mainstreamTemp - coolantTemp, 1);
            const bladeMinTemp = coolantTemp + 100;
            
            for (let i = 0; i < gridSize; i++) {
                for (let j = 0; j < gridSize; j++) {
                    const t = temperatureField[i][j];
                    const hasFilm = filmCoverageField[i][j] > 0.01;
                    const inBladeRange = t > bladeMinTemp && t < mainstreamTemp - 10;
                    
                    if (hasFilm || inBladeRange) {
                        const spanwisePos = bounds.minY + j * dy;
                        const eta = hasFilm 
                            ? filmCoverageField[i][j] 
                            : Math.max(0, Math.min(1, (mainstreamTemp - t) / tempRange));
                        this.spanwiseStore.addSample(spanwisePos, eta, t, 1);
                    }
                }
            }
        }

        getSpanwiseStatistics() {
            return this.spanwiseStore.getStatistics();
        }

        getSpanwiseProfile() {
            return this.spanwiseStore.getSpanwiseProfile();
        }

        saveSpanwiseSnapshot(time) {
            this.spanwiseStore.saveTimeSnapshot(time);
        }

        exportSpanwiseData() {
            return this.spanwiseStore.export();
        }

        getMetrics() {
            return {
                blowingRatio: this.currentBlowingRatio,
                criticalBlowingRatio: CONFIG.CRITICAL_BLOWING_RATIO,
                detachmentMetrics: this.detachmentMetrics,
                spanwiseStatistics: this.getSpanwiseStatistics(),
                filmInfluenceRadius: CONFIG.FILM_INFLUENCE_RADIUS
            };
        }
    }

    return {
        CONFIG,
        JetTrajectoryModel,
        HoleInterferenceModel,
        BlowingRatioModel,
        SpanwiseEfficiencyStore,
        UnifiedFilmCoverageModel,
        
        createModel: function() {
            return new UnifiedFilmCoverageModel();
        },
        
        createSpanwiseStore: function(bins) {
            return new SpanwiseEfficiencyStore(bins);
        }
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilmCoverageModel;
}
