const CoolingModel = (function() {
    'use strict';

    const MATERIAL_PROPERTIES = {
        nickel_alloy: {
            name: '镍基合金',
            thermalConductivity: 20,
            density: 8500,
            specificHeat: 500,
            meltingPoint: 1350
        },
        cmsx_4: {
            name: 'CMSX-4 单晶',
            thermalConductivity: 25,
            density: 8700,
            specificHeat: 480,
            meltingPoint: 1420
        },
        rené_n5: {
            name: 'René N5',
            thermalConductivity: 22,
            density: 8600,
            specificHeat: 490,
            meltingPoint: 1400
        },
        ceramic: {
            name: '陶瓷基复合材料',
            thermalConductivity: 5,
            density: 2200,
            specificHeat: 800,
            meltingPoint: 1700
        }
    };

    const GRID_RESOLUTION = 80;

    const filmCoverageModel = typeof FilmCoverageModel !== 'undefined' 
        ? FilmCoverageModel.createModel() 
        : null;

    function calculateHeatTransferCoefficient(pressure, temperature, velocity) {
        const k = 0.05;
        const rho = pressure * 1e6 / (287 * (temperature + 273.15));
        const mu = 3e-5;
        const Re = rho * velocity * 0.01 / mu;
        const Pr = 0.7;
        const Nu = 0.0296 * Math.pow(Re, 0.8) * Math.pow(Pr, 0.33);
        return Nu * k / 0.01;
    }

    function calculateAdiabaticWallTemp(mainstreamTemp, coolantTemp, eta) {
        return mainstreamTemp - eta * (mainstreamTemp - coolantTemp);
    }

    function initializeTemperatureField(gridSize, initialTemp) {
        const field = [];
        for (let i = 0; i < gridSize; i++) {
            field[i] = [];
            for (let j = 0; j < gridSize; j++) {
                field[i][j] = initialTemp;
            }
        }
        return field;
    }

    function isPointInsideBlade(x, y, profile) {
        const { upperSurface, lowerSurface } = profile;
        
        let minX = Infinity, maxX = -Infinity;
        upperSurface.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
        });
        
        if (x < minX || x > maxX) return false;
        
        const t = (x - minX) / (maxX - minX);
        const idx = Math.min(Math.floor(t * (upperSurface.length - 1)), upperSurface.length - 2);
        
        const upperP1 = upperSurface[idx];
        const upperP2 = upperSurface[idx + 1];
        const lowerP1 = lowerSurface[idx];
        const lowerP2 = lowerSurface[idx + 1];
        
        const upperY = upperP1.y + (upperP2.y - upperP1.y) * ((x - upperP1.x) / (upperP2.x - upperP1.x || 1));
        const lowerY = lowerP1.y + (lowerP2.y - lowerP1.y) * ((x - lowerP1.x) / (lowerP2.x - lowerP1.x || 1));
        
        return y >= Math.min(upperY, lowerY) && y <= Math.max(upperY, lowerY);
    }

    function getDistanceToSurface(x, y, profile) {
        const allPoints = [...profile.upperSurface, ...profile.lowerSurface];
        let minDist = Infinity;
        
        for (const point of allPoints) {
            const dist = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
            minDist = Math.min(minDist, dist);
        }
        
        return minDist;
    }

    function computeSpanwiseAverages(temperatureField, filmCoverageField, bounds, gridSize, coolantTemp, mainstreamTemp) {
        const spanwiseTemp = [];
        const spanwiseEta = [];
        const chordwiseTemp = [];
        const chordwiseEta = [];
        
        const tempRange = mainstreamTemp - coolantTemp;
        const bladeMinTemp = coolantTemp + 100;
        
        for (let i = 0; i < gridSize; i++) {
            let sumT = 0, sumEta = 0, count = 0;
            for (let j = 0; j < gridSize; j++) {
                const t = temperatureField[i][j];
                const hasFilm = filmCoverageField[i][j] > 0.01;
                const inBladeRange = t > bladeMinTemp && t < mainstreamTemp - 10;
                
                if (hasFilm || inBladeRange) {
                    const eta = Math.max(0, Math.min(1, (mainstreamTemp - t) / tempRange));
                    sumT += t;
                    sumEta += eta;
                    count++;
                }
            }
            if (count > 0) {
                chordwiseTemp.push(sumT / count);
                chordwiseEta.push(sumEta / count);
            } else {
                chordwiseTemp.push(null);
                chordwiseEta.push(null);
            }
        }
        
        for (let j = 0; j < gridSize; j++) {
            let sumT = 0, sumEta = 0, count = 0;
            for (let i = 0; i < gridSize; i++) {
                const t = temperatureField[i][j];
                const hasFilm = filmCoverageField[i][j] > 0.01;
                const inBladeRange = t > bladeMinTemp && t < mainstreamTemp - 10;
                
                if (hasFilm || inBladeRange) {
                    const eta = Math.max(0, Math.min(1, (mainstreamTemp - t) / tempRange));
                    sumT += t;
                    sumEta += eta;
                    count++;
                }
            }
            if (count > 0) {
                spanwiseTemp.push(sumT / count);
                spanwiseEta.push(sumEta / count);
            } else {
                spanwiseTemp.push(null);
                spanwiseEta.push(null);
            }
        }
        
        const avgSpanwiseEfficiency = spanwiseEta.filter(v => v !== null).reduce((a, b) => a + b, 0) / 
            Math.max(spanwiseEta.filter(v => v !== null).length, 1);
        
        const avgChordwiseEfficiency = chordwiseEta.filter(v => v !== null).reduce((a, b) => a + b, 0) / 
            Math.max(chordwiseEta.filter(v => v !== null).length, 1);
        
        const avgSpanwiseTemp = spanwiseTemp.filter(v => v !== null).reduce((a, b) => a + b, 0) / 
            Math.max(spanwiseTemp.filter(v => v !== null).length, 1);
        
        return {
            spanwiseTemperature: spanwiseTemp,
            spanwiseEfficiency: spanwiseEta,
            chordwiseTemperature: chordwiseTemp,
            chordwiseEfficiency: chordwiseEta,
            avgSpanwiseEfficiency: avgSpanwiseEfficiency * 100,
            avgChordwiseEfficiency: avgChordwiseEfficiency * 100,
            avgSpanwiseTemperature: avgSpanwiseTemp
        };
    }

    function simulateCooling(params, time, deltaTime) {
        const {
            coolantFlow,
            mainstreamTemp,
            coolantTemp,
            mainstreamPressure,
            coolantPressure,
            bladeMaterial,
            holes
        } = params;

        const material = MATERIAL_PROPERTIES[bladeMaterial] || MATERIAL_PROPERTIES.nickel_alloy;
        const profile = BladeGeometry.generateBladeProfile();
        const bounds = BladeGeometry.getBounds();
        
        const gridSize = GRID_RESOLUTION;
        const dx = (bounds.maxX - bounds.minX) / gridSize;
        const dy = (bounds.maxY - bounds.minY) / gridSize;
        
        const temperatureField = initializeTemperatureField(gridSize, coolantTemp);
        const filmCoverageField = initializeTemperatureField(gridSize, 0);
        
        const h_mainstream = calculateHeatTransferCoefficient(mainstreamPressure, mainstreamTemp, 200);
        const h_coolant = calculateHeatTransferCoefficient(coolantPressure, coolantTemp, 50);
        
        let blowingRatio;
        let detachmentMetrics;
        
        if (filmCoverageModel && holes.length > 0) {
            filmCoverageModel.initialize(holes, {
                coolantFlow,
                mainstreamTemp,
                coolantTemp,
                mainstreamPressure,
                coolantPressure
            });
            
            const metrics = filmCoverageModel.getMetrics();
            blowingRatio = metrics.blowingRatio;
            detachmentMetrics = metrics.detachmentMetrics;
        } else {
            const BlowingRatioModel = FilmCoverageModel 
                ? new FilmCoverageModel.BlowingRatioModel() 
                : null;
                
            if (BlowingRatioModel) {
                blowingRatio = BlowingRatioModel.calculateBlowingRatio(
                    coolantPressure, coolantTemp, mainstreamPressure, mainstreamTemp
                );
                detachmentMetrics = BlowingRatioModel.calculateDetachmentMetrics(blowingRatio);
            } else {
                const rho_c = coolantPressure * 1e6 / (287 * (coolantTemp + 273.15));
                const rho_g = mainstreamPressure * 1e6 / (287 * (mainstreamTemp + 273.15));
                const V_c = Math.sqrt(2 * Math.max(coolantPressure - mainstreamPressure, 0.01) * 1e6 / rho_c);
                const V_g = 200;
                blowingRatio = (rho_c * V_c) / (rho_g * V_g);
                
                const CRITICAL_M = 1.2;
                if (blowingRatio <= CRITICAL_M) {
                    detachmentMetrics = {
                        isDetached: false,
                        detachmentSeverity: 0,
                        detachmentFactor: 1.0,
                        regime: 'attached'
                    };
                } else {
                    const excessRatio = (blowingRatio - CRITICAL_M) / CRITICAL_M;
                    const severity = Math.min(1.0, excessRatio * 2.0);
                    detachmentMetrics = {
                        isDetached: true,
                        detachmentSeverity: severity * 100,
                        detachmentFactor: 1.0 - severity * 0.7,
                        regime: excessRatio > 0.5 ? 'fully_detached' : 'transitional'
                    };
                }
            }
        }
        
        let sumTemp = 0;
        let maxTemp = coolantTemp;
        let minTemp = mainstreamTemp;
        let bladePoints = 0;
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const x = bounds.minX + i * dx;
                const y = bounds.minY + j * dy;
                
                if (isPointInsideBlade(x, y, profile)) {
                    const distToSurface = getDistanceToSurface(x, y, profile);
                    
                    let coverage;
                    if (filmCoverageModel && holes.length > 0) {
                        coverage = filmCoverageModel.calculatePointCoverage(x, y);
                    } else {
                        coverage = fallbackCalculateCoverage(
                            x, y, holes, coolantFlow,
                            mainstreamTemp, coolantTemp, blowingRatio,
                            detachmentMetrics.detachmentFactor
                        );
                    }
                    
                    const surfaceEta = coverage.eta;
                    filmCoverageField[i][j] = surfaceEta;
                    
                    const depthFactor = Math.max(0, 1 - distToSurface / 30);
                    
                    const baseMetalTemp = mainstreamTemp - 20;
                    
                    const filmCoolingPotential = (mainstreamTemp - coolantTemp) * 0.7;
                    const filmCooling = surfaceEta * filmCoolingPotential;
                    
                    const internalCoolingMax = (mainstreamTemp - coolantTemp) * 0.05;
                    const internalCooling = internalCoolingMax * (1 - depthFactor);
                    
                    const temperature = baseMetalTemp - filmCooling - internalCooling;
                    const steadyTemp = temperature + Math.sin(time * 0.5 + i * 0.1 + j * 0.1) * 5;
                    
                    temperatureField[i][j] = Math.max(coolantTemp, Math.min(mainstreamTemp, steadyTemp));
                    
                    sumTemp += temperatureField[i][j];
                    maxTemp = Math.max(maxTemp, temperatureField[i][j]);
                    minTemp = Math.min(minTemp, temperatureField[i][j]);
                    bladePoints++;
                }
            }
        }
        
        if (filmCoverageModel) {
            filmCoverageModel.updateSpanwiseStore(temperatureField, filmCoverageField, bounds, gridSize, coolantTemp, mainstreamTemp);
        }
        
        const avgTemp = bladePoints > 0 ? sumTemp / bladePoints : mainstreamTemp;
        const coolingEfficiency = ((mainstreamTemp - avgTemp) / (mainstreamTemp - coolantTemp)) * 100;
        const heatFlux = h_mainstream * (mainstreamTemp - avgTemp) / 1e6;
        
        let filmCoverageSum = 0;
        let filmPoints = 0;
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                if (filmCoverageField[i][j] > 0) {
                    filmCoverageSum += filmCoverageField[i][j];
                    filmPoints++;
                }
            }
        }
        const avgFilmCoverage = filmPoints > 0 ? (filmCoverageSum / filmPoints) * 100 : 0;
        
        let spanwiseStats;
        if (filmCoverageModel) {
            const stats = filmCoverageModel.getSpanwiseStatistics();
            const profile = stats.spanwiseProfile;
            
            const spanwiseTemperature = [];
            const spanwiseEfficiency = [];
            for (let j = 0; j < gridSize; j++) {
                const spanwiseFrac = j / (gridSize - 1);
                const binFloat = spanwiseFrac * (profile.length - 1);
                const binIdx = Math.floor(binFloat);
                const binNext = Math.min(binIdx + 1, profile.length - 1);
                const binFrac = binFloat - binIdx;
                const eta = profile[binIdx].efficiency * (1 - binFrac) + profile[binNext].efficiency * binFrac;
                const temp = profile[binIdx].temperature * (1 - binFrac) + profile[binNext].temperature * binFrac;
                spanwiseTemperature.push(temp);
                spanwiseEfficiency.push(eta * 100);
            }
            
            const chordwiseTemperature = [];
            const chordwiseEfficiency = [];
            for (let i = 0; i < gridSize; i++) {
                let sumT = 0, sumEta = 0, count = 0;
                for (let j = 0; j < gridSize; j++) {
                    if (filmCoverageField[i][j] > 0.01) {
                        sumT += temperatureField[i][j];
                        sumEta += filmCoverageField[i][j];
                        count++;
                    }
                }
                if (count > 0) {
                    chordwiseTemperature.push(sumT / count);
                    chordwiseEfficiency.push(sumEta / count * 100);
                } else {
                    chordwiseTemperature.push(null);
                    chordwiseEfficiency.push(null);
                }
            }
            
            spanwiseStats = {
                spanwiseTemperature,
                spanwiseEfficiency,
                chordwiseTemperature,
                chordwiseEfficiency,
                avgSpanwiseEfficiency: stats.avgEfficiency * 100,
                avgChordwiseEfficiency: stats.avgEfficiency * 100,
                avgSpanwiseTemperature: stats.spanwiseProfile.reduce((a, b) => a + b.temperature, 0) / Math.max(stats.spanwiseProfile.length, 1),
                uniformity: stats.uniformity,
                maxEfficiency: stats.maxEfficiency * 100,
                minEfficiency: stats.minEfficiency * 100,
                spanwiseProfile: stats.spanwiseProfile
            };
        } else {
            spanwiseStats = computeSpanwiseAverages(
                temperatureField, filmCoverageField, bounds, gridSize, coolantTemp, mainstreamTemp
            );
        }
        
        return {
            temperatureField,
            filmCoverageField,
            avgTemperature: avgTemp,
            maxTemperature: maxTemp,
            minTemperature: minTemp,
            coolingEfficiency: Math.min(100, Math.max(0, coolingEfficiency)),
            heatFlux: Math.max(0, heatFlux),
            filmCoverage: avgFilmCoverage,
            blowingRatio,
            gridSize,
            bounds,
            detachmentMetrics,
            spanwiseStatistics: spanwiseStats,
            filmCoverageModel: filmCoverageModel ? {
                getMetrics: () => filmCoverageModel.getMetrics(),
                getSpanwiseProfile: () => filmCoverageModel.getSpanwiseProfile(),
                exportSpanwiseData: () => filmCoverageModel.exportSpanwiseData()
            } : null
        };
    }

    function fallbackCalculateCoverage(x, y, holes, coolantFlow, mainstreamTemp, coolantTemp, blowingRatio, detachmentFactor) {
        let totalEta = 0;
        let activeHoles = 0;
        const FILM_INFLUENCE_RADIUS = 80;
        
        for (const hole of holes) {
            const dist = Math.sqrt(Math.pow(x - hole.x, 2) + Math.pow(y - hole.y, 2));
            
            if (dist > FILM_INFLUENCE_RADIUS) continue;
            
            const xOverD = dist / Math.max(hole.diameter, 0.1);
            
            const M = blowingRatio;
            let baseEta;
            if (M < 0.3) {
                baseEta = 0.95 * Math.exp(-0.04 * xOverD / Math.max(M, 0.01));
            } else if (M < 1.2) {
                const peakM = 0.6;
                const envelope = 1.0 - Math.pow((M - peakM) / (1.2 - peakM), 2);
                baseEta = 0.9 * envelope * Math.exp(-0.04 * xOverD / Math.max(M, 0.1));
            } else {
                const detFactor = 1.0 / (1.0 + Math.pow(M - 1.2, 2) * 10.0);
                baseEta = 0.2 * detFactor * Math.exp(-0.2 * xOverD / Math.max(M, 0.01));
            }
            
            const flowFactor = Math.min(Math.max(coolantFlow / 0.08, 0.3), 1.2);
            const holeEta = baseEta * flowFactor * detachmentFactor;
            
            const weight = Math.exp(-Math.pow(dist / (FILM_INFLUENCE_RADIUS * 0.5), 2));
            totalEta += holeEta * weight;
            activeHoles++;
        }
        
        const superpositionFactor = 1.0 + 1.0 * Math.log(1 + activeHoles * 0.3);
        const combinedEta = Math.min(1.0, totalEta * superpositionFactor);
        
        return {
            eta: combinedEta,
            activeHoles,
            totalWeight: totalEta,
            superpositionFactor
        };
    }

    return {
        simulateCooling,
        MATERIAL_PROPERTIES,
        calculateHeatTransferCoefficient,
        calculateAdiabaticWallTemp,
        
        get CRITICAL_BLOWING_RATIO() {
            return FilmCoverageModel ? FilmCoverageModel.CONFIG.CRITICAL_BLOWING_RATIO : 1.2;
        },
        
        createFilmCoverageModel: function() {
            return FilmCoverageModel ? FilmCoverageModel.createModel() : null;
        },
        
        getFilmCoverageConfig: function() {
            return FilmCoverageModel ? FilmCoverageModel.CONFIG : null;
        }
    };
})();
