const Visualization = (function() {
    let canvas, ctx;
    let width, height;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let animationTime = 0;
    let filmParticles = [];
    let temperatureHistory = [];
    const MAX_HISTORY = 100;

    function init(canvasElement) {
        canvas = canvasElement;
        ctx = canvas.getContext('2d');
        width = canvas.width;
        height = canvas.height;
        
        const bounds = BladeGeometry.getBounds();
        const rangeX = bounds.maxX - bounds.minX;
        const rangeY = bounds.maxY - bounds.minY;
        scale = Math.min(width / rangeX, height / rangeY) * 0.85;
        
        offsetX = (width - rangeX * scale) / 2 - bounds.minX * scale;
        offsetY = (height - rangeY * scale) / 2 - bounds.minY * scale;
        
        initFilmParticles();
    }

    function initFilmParticles() {
        filmParticles = [];
        const holes = BladeGeometry.generateFilmHoles(24);
        holes.forEach(hole => {
            for (let i = 0; i < 5; i++) {
                filmParticles.push({
                    hole: hole,
                    life: Math.random(),
                    maxLife: 1 + Math.random(),
                    speed: 30 + Math.random() * 20
                });
            }
        });
    }

    function toCanvasX(x) {
        return x * scale + offsetX;
    }

    function toCanvasY(y) {
        return y * scale + offsetY;
    }

    function getTemperatureColor(temp, minTemp, maxTemp) {
        const t = (temp - minTemp) / (maxTemp - minTemp);
        const clampedT = Math.max(0, Math.min(1, t));
        
        if (clampedT < 0.2) {
            const f = clampedT / 0.2;
            return `rgb(${Math.floor(30 + f * 0)}, ${Math.floor(144 + f * 111)}, ${Math.floor(255)})`;
        } else if (clampedT < 0.4) {
            const f = (clampedT - 0.2) / 0.2;
            return `rgb(${Math.floor(30 + f * 0)}, ${Math.floor(255 - f * 255)}, ${Math.floor(255 - f * 255)})`;
        } else if (clampedT < 0.6) {
            const f = (clampedT - 0.4) / 0.2;
            return `rgb(${Math.floor(0 + f * 255)}, ${Math.floor(255)}, ${Math.floor(0)})`;
        } else if (clampedT < 0.8) {
            const f = (clampedT - 0.6) / 0.2;
            return `rgb(${Math.floor(255)}, ${Math.floor(255 - f * 255)}, ${Math.floor(0)})`;
        } else {
            const f = (clampedT - 0.8) / 0.2;
            return `rgb(${Math.floor(255)}, ${Math.floor(136 - f * 136)}, ${Math.floor(0)})`;
        }
    }

    function drawBackground() {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#0a0a1a');
        gradient.addColorStop(1, '#1a1a2e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    function drawMainstreamFlow(time) {
        ctx.save();
        const arrowCount = 8;
        for (let i = 0; i < arrowCount; i++) {
            const y = (height / arrowCount) * i + 30 + Math.sin(time * 2 + i) * 5;
            const xOffset = (time * 100 + i * 50) % (width + 100) - 50;
            
            ctx.strokeStyle = `rgba(255, 150, 100, ${0.3 + Math.sin(time * 3 + i) * 0.1})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(xOffset, y);
            ctx.lineTo(xOffset + 40, y);
            ctx.lineTo(xOffset + 35, y - 5);
            ctx.moveTo(xOffset + 40, y);
            ctx.lineTo(xOffset + 35, y + 5);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawTemperatureField(result, viewMode) {
        if (!result || !result.temperatureField) return;
        
        const { temperatureField, filmCoverageField, bounds, gridSize } = result;
        const dx = (bounds.maxX - bounds.minX) / gridSize;
        const dy = (bounds.maxY - bounds.minY) / gridSize;
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const x = bounds.minX + i * dx;
                const y = bounds.minY + j * dy;
                const canvasX = toCanvasX(x);
                const canvasY = toCanvasY(y);
                const cellWidth = dx * scale;
                const cellHeight = dy * scale;
                
                const temp = temperatureField[i][j];
                const eta = filmCoverageField[i][j];
                
                if (viewMode === 'temperature' || viewMode === 'combined') {
                    const color = getTemperatureColor(temp, result.minTemperature, result.maxTemperature);
                    ctx.fillStyle = color;
                    ctx.globalAlpha = viewMode === 'combined' ? 0.7 : 1;
                    ctx.fillRect(canvasX, canvasY, cellWidth + 1, cellHeight + 1);
                }
                
                if (viewMode === 'film' || (viewMode === 'combined' && eta > 0)) {
                    ctx.fillStyle = `rgba(100, 200, 255, ${eta * 0.6})`;
                    ctx.globalAlpha = 1;
                    ctx.fillRect(canvasX, canvasY, cellWidth + 1, cellHeight + 1);
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    function drawBladeProfile(holes) {
        const profile = BladeGeometry.generateBladeProfile();
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(toCanvasX(profile.upperSurface[0].x), toCanvasY(profile.upperSurface[0].y));
        for (let i = 1; i < profile.upperSurface.length; i++) {
            ctx.lineTo(toCanvasX(profile.upperSurface[i].x), toCanvasY(profile.upperSurface[i].y));
        }
        for (let i = profile.lowerSurface.length - 1; i >= 0; i--) {
            ctx.lineTo(toCanvasX(profile.lowerSurface[i].x), toCanvasY(profile.lowerSurface[i].y));
        }
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, 'rgba(100, 100, 120, 0.3)');
        gradient.addColorStop(1, 'rgba(150, 150, 180, 0.3)');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        
        drawInternalChannels();
        drawFilmHoles(holes);
    }

    function drawInternalChannels() {
        const channels = BladeGeometry.generateInternalChannels();
        
        ctx.save();
        channels.forEach(channel => {
            const x1 = toCanvasX(channel.x1);
            const y1 = toCanvasY(channel.y1);
            const x2 = toCanvasX(channel.x2);
            const y2 = toCanvasY(channel.y2);
            
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
            ctx.lineWidth = channel.width * scale * 0.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            
            ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(x1, y1, channel.width * scale * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x2, y2, channel.width * scale * 0.3, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }

    function drawFilmHoles(holes) {
        if (!holes) return;
        
        ctx.save();
        holes.forEach(hole => {
            const x = toCanvasX(hole.x);
            const y = toCanvasY(hole.y);
            const radius = hole.diameter * scale * 0.5;
            
            ctx.fillStyle = '#0a0a1a';
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
            glowGradient.addColorStop(0, 'rgba(100, 200, 255, 0.3)');
            glowGradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }

    function drawFilmParticles(time, holes) {
        if (!holes) return;
        
        ctx.save();
        holes.forEach(hole => {
            const numParticles = 3;
            for (let i = 0; i < numParticles; i++) {
                const phase = (time * 0.5 + i / numParticles) % 1;
                const distance = phase * 40;
                const spread = Math.sin(phase * Math.PI) * 10;
                
                const x = toCanvasX(hole.x + Math.cos(hole.angle) * distance + Math.cos(hole.angle + Math.PI/2) * spread * (i - 1));
                const y = toCanvasY(hole.y + Math.sin(hole.angle) * distance + Math.sin(hole.angle + Math.PI/2) * spread * (i - 1));
                
                const alpha = (1 - phase) * 0.6;
                const size = (2 + phase * 3) * scale;
                
                ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.restore();
    }

    function drawCoolantFlowAnimation(time) {
        ctx.save();
        const bounds = BladeGeometry.getBounds();
        
        for (let i = 0; i < 15; i++) {
            const t = (time * 0.3 + i / 15) % 1;
            const x = bounds.minX + 20 + t * (BladeGeometry.CHORD + 60);
            const y = bounds.minY + BladeGeometry.MAX_THICKNESS * 0.3 + Math.sin(t * Math.PI * 4 + i) * 10;
            
            const canvasX = toCanvasX(x);
            const canvasY = toCanvasY(y);
            
            const gradient = ctx.createRadialGradient(canvasX, canvasY, 0, canvasX, canvasY, 15 * scale);
            gradient.addColorStop(0, 'rgba(100, 200, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, 15 * scale, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawTemperatureContour(result) {
        if (!result || !result.temperatureField) return;
        
        const { temperatureField, bounds, gridSize } = result;
        const levels = [200, 400, 600, 800, 1000];
        
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        
        for (const level of levels) {
            ctx.beginPath();
            for (let i = 0; i < gridSize - 1; i++) {
                for (let j = 0; j < gridSize - 1; j++) {
                    const t00 = temperatureField[i][j];
                    const t10 = temperatureField[i + 1][j];
                    const t01 = temperatureField[i][j + 1];
                    
                    if ((t00 - level) * (t10 - level) < 0) {
                        const x = bounds.minX + (i + (level - t00) / (t10 - t00)) * ((bounds.maxX - bounds.minX) / gridSize);
                        const y = bounds.minY + j * ((bounds.maxY - bounds.minY) / gridSize);
                        if (i === 0 && j === 0) {
                            ctx.moveTo(toCanvasX(x), toCanvasY(y));
                        } else {
                            ctx.lineTo(toCanvasX(x), toCanvasY(y));
                        }
                    }
                }
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawLabels(time, result) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 150, 100, 0.8)';
        ctx.font = '14px Segoe UI';
        ctx.textAlign = 'left';
        ctx.fillText('主流 →', 20, 30);
        
        ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
        ctx.fillText('← 冷气', width - 80, height - 20);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px Segoe UI';
        ctx.textAlign = 'right';
        ctx.fillText(`模拟时间: ${time.toFixed(1)}s`, width - 20, 30);
        
        if (result && result.detachmentMetrics) {
            const dm = result.detachmentMetrics;
            if (dm.isDetached) {
                ctx.fillStyle = 'rgba(255, 80, 80, 0.9)';
                ctx.font = 'bold 13px Segoe UI';
                ctx.textAlign = 'left';
                ctx.fillText(`⚠ 气膜脱离 严重度: ${dm.detachmentSeverity.toFixed(0)}%`, 20, height - 20);
            } else {
                ctx.fillStyle = 'rgba(100, 200, 150, 0.8)';
                ctx.font = '12px Segoe UI';
                ctx.textAlign = 'left';
                ctx.fillText('✓ 气膜附着正常', 20, height - 20);
            }
            
            if (result.blowingRatio !== undefined) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.font = '11px Segoe UI';
                ctx.textAlign = 'left';
                ctx.fillText(`吹风比 M=${result.blowingRatio.toFixed(2)}  (临界=${CoolingModel.CRITICAL_BLOWING_RATIO.toFixed(1)})`, 20, height - 38);
            }
        }
        
        if (result && result.spanwiseStatistics) {
            const stats = result.spanwiseStatistics;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '11px Segoe UI';
            ctx.textAlign = 'right';
            ctx.fillText(`展向平均η: ${stats.avgSpanwiseEfficiency.toFixed(1)}%`, width - 20, 48);
            ctx.fillText(`弦向平均η: ${stats.avgChordwiseEfficiency.toFixed(1)}%`, width - 20, 64);
        }
        
        ctx.restore();
    }

    function drawTemperatureHeatmap(result) {
        if (!result || !result.temperatureField) return;
        
        const { temperatureField, bounds, gridSize, minTemperature, maxTemperature } = result;
        const dx = (bounds.maxX - bounds.minX) / gridSize;
        const dy = (bounds.maxY - bounds.minY) / gridSize;
        const tempRange = Math.max(maxTemperature - minTemperature, 1);
        
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        
        const canvasLeft = offsetX;
        const canvasTop = offsetY;
        const canvasWidth = (bounds.maxX - bounds.minX) * scale;
        const canvasHeight = (bounds.maxY - bounds.minY) * scale;
        
        for (let py = 0; py < height; py++) {
            for (let px = 0; px < width; px++) {
                const idx = (py * width + px) * 4;
                
                if (px < canvasLeft || px > canvasLeft + canvasWidth || 
                    py < canvasTop || py > canvasTop + canvasHeight) {
                    data[idx] = 10;
                    data[idx + 1] = 10;
                    data[idx + 2] = 26;
                    data[idx + 3] = 255;
                    continue;
                }
                
                const modelX = (px - canvasLeft) / scale + bounds.minX;
                const modelY = (py - canvasTop) / scale + bounds.minY;
                
                const gridI = Math.max(0, Math.min(gridSize - 1, Math.floor((modelX - bounds.minX) / dx)));
                const gridJ = Math.max(0, Math.min(gridSize - 1, Math.floor((modelY - bounds.minY) / dy)));
                
                const temp = temperatureField[gridI][gridJ];
                const t = Math.max(0, Math.min(1, (temp - minTemperature) / tempRange));
                
                let r, g, b;
                if (t < 0.25) {
                    const f = t / 0.25;
                    r = Math.floor(0 + f * 0);
                    g = Math.floor(50 + f * 100);
                    b = Math.floor(200 + f * 55);
                } else if (t < 0.5) {
                    const f = (t - 0.25) / 0.25;
                    r = Math.floor(0 + f * 0);
                    g = Math.floor(150 + f * 105);
                    b = Math.floor(255 - f * 255);
                } else if (t < 0.75) {
                    const f = (t - 0.5) / 0.25;
                    r = Math.floor(0 + f * 255);
                    g = Math.floor(255 - f * 0);
                    b = Math.floor(0 + f * 0);
                } else {
                    const f = (t - 0.75) / 0.25;
                    r = Math.floor(255);
                    g = Math.floor(255 - f * 200);
                    b = Math.floor(0 + f * 0);
                }
                
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    function drawTemperatureProfileCurve(result) {
        if (!result || !result.temperatureField) return;
        
        const { temperatureField, bounds, gridSize } = result;
        const midJ = Math.floor(gridSize / 2);
        
        ctx.save();
        const chartX = 20;
        const chartY = height - 100;
        const chartWidth = 200;
        const chartHeight = 70;
        
        ctx.fillStyle = 'rgba(10, 10, 26, 0.8)';
        ctx.fillRect(chartX - 5, chartY - 20, chartWidth + 10, chartHeight + 30);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(chartX, chartY, chartWidth, chartHeight);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px Segoe UI';
        ctx.textAlign = 'left';
        ctx.fillText('中弦温度剖面', chartX, chartY - 8);
        
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 150, 100, 0.9)';
        ctx.lineWidth = 2;
        
        let minT = Infinity, maxT = -Infinity;
        for (let i = 0; i < gridSize; i++) {
            const t = temperatureField[i][midJ];
            if (t > 100) {
                minT = Math.min(minT, t);
                maxT = Math.max(maxT, t);
            }
        }
        
        if (minT < Infinity && maxT > -Infinity) {
            const range = Math.max(maxT - minT, 1);
            for (let i = 0; i < gridSize; i++) {
                const t = temperatureField[i][midJ];
                if (t > 100) {
                    const x = chartX + (i / gridSize) * chartWidth;
                    const y = chartY + chartHeight - ((t - minT) / range) * chartHeight;
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            }
            ctx.stroke();
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '9px Segoe UI';
            ctx.fillText(`${Math.round(minT)}°C`, chartX, chartY + chartHeight + 10);
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(maxT)}°C`, chartX + chartWidth, chartY - 2);
        }
        
        ctx.restore();
    }

    function drawEfficiencyTrend(result, time) {
        if (!result) return;
        
        temperatureHistory.push({
            time: time,
            efficiency: result.coolingEfficiency,
            avgTemp: result.avgTemperature
        });
        
        if (temperatureHistory.length > MAX_HISTORY) {
            temperatureHistory.shift();
        }
        
        if (temperatureHistory.length < 2) return;
        
        ctx.save();
        const chartX = width - 220;
        const chartY = height - 100;
        const chartWidth = 200;
        const chartHeight = 70;
        
        ctx.fillStyle = 'rgba(10, 10, 26, 0.8)';
        ctx.fillRect(chartX - 5, chartY - 20, chartWidth + 10, chartHeight + 30);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(chartX, chartY, chartWidth, chartHeight);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px Segoe UI';
        ctx.textAlign = 'left';
        ctx.fillText('冷却效率趋势', chartX, chartY - 8);
        
        let minEta = Infinity, maxEta = -Infinity;
        temperatureHistory.forEach(h => {
            minEta = Math.min(minEta, h.efficiency);
            maxEta = Math.max(maxEta, h.efficiency);
        });
        
        const etaRange = Math.max(maxEta - minEta, 0.1);
        
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.9)';
        ctx.lineWidth = 2;
        
        temperatureHistory.forEach((h, idx) => {
            const x = chartX + (idx / (temperatureHistory.length - 1)) * chartWidth;
            const y = chartY + chartHeight - ((h.efficiency - minEta) / etaRange) * chartHeight;
            if (idx === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '9px Segoe UI';
        ctx.textAlign = 'left';
        ctx.fillText(`${minEta.toFixed(1)}%`, chartX, chartY + chartHeight + 10);
        ctx.textAlign = 'right';
        ctx.fillText(`${maxEta.toFixed(1)}%`, chartX + chartWidth, chartY - 2);
        
        ctx.restore();
    }

    function drawTemperatureScale(result) {
        if (!result) return;
        
        ctx.save();
        const scaleX = width - 60;
        const scaleY = 80;
        const scaleWidth = 30;
        const scaleHeight = 180;
        
        const gradient = ctx.createLinearGradient(scaleX, scaleY + scaleHeight, scaleX, scaleY);
        gradient.addColorStop(0, 'rgb(0, 50, 200)');
        gradient.addColorStop(0.33, 'rgb(0, 255, 255)');
        gradient.addColorStop(0.66, 'rgb(255, 255, 0)');
        gradient.addColorStop(1, 'rgb(255, 50, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(scaleX, scaleY, scaleWidth, scaleHeight);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(scaleX, scaleY, scaleWidth, scaleHeight);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '11px Segoe UI';
        ctx.textAlign = 'left';
        ctx.fillText('温度', scaleX, scaleY - 10);
        
        ctx.font = '10px Segoe UI';
        ctx.fillText(`${Math.round(result.maxTemperature)}°`, scaleX + scaleWidth + 5, scaleY + 5);
        ctx.fillText(`${Math.round((result.maxTemperature + result.minTemperature) / 2)}°`, scaleX + scaleWidth + 5, scaleY + scaleHeight / 2);
        ctx.fillText(`${Math.round(result.minTemperature)}°`, scaleX + scaleWidth + 5, scaleY + scaleHeight);
        
        ctx.restore();
    }

    function drawSpanwiseProfile(result) {
        if (!result || !result.spanwiseStatistics || !result.spanwiseStatistics.spanwiseProfile) return;
        
        const profile = result.spanwiseStatistics.spanwiseProfile;
        if (profile.length === 0) return;
        
        ctx.save();
        const chartX = width / 2 - 100;
        const chartY = height - 100;
        const chartWidth = 200;
        const chartHeight = 70;
        
        ctx.fillStyle = 'rgba(10, 10, 26, 0.8)';
        ctx.fillRect(chartX - 5, chartY - 20, chartWidth + 10, chartHeight + 30);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(chartX, chartY, chartWidth, chartHeight);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px Segoe UI';
        ctx.textAlign = 'left';
        ctx.fillText('展向效率分布', chartX, chartY - 8);
        
        const maxEta = Math.max(...profile.map(p => p.efficiency), 0.01);
        
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(150, 255, 150, 0.9)';
        ctx.lineWidth = 2;
        
        profile.forEach((p, idx) => {
            const x = chartX + (idx / (profile.length - 1)) * chartWidth;
            const y = chartY + chartHeight - (p.efficiency / maxEta) * chartHeight;
            if (idx === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '9px Segoe UI';
        ctx.textAlign = 'left';
        ctx.fillText('0%', chartX, chartY + chartHeight + 10);
        ctx.textAlign = 'right';
        ctx.fillText(`${(maxEta * 100).toFixed(0)}%`, chartX + chartWidth, chartY - 2);
        
        ctx.restore();
    }

    function render(result, viewMode, holes, time) {
        animationTime = time;
        
        drawBackground();
        
        if (viewMode === 'temperature' || viewMode === 'combined') {
            drawTemperatureHeatmap(result);
        }
        
        drawMainstreamFlow(time);
        
        if (viewMode === 'film' || viewMode === 'combined') {
            drawTemperatureField(result, viewMode);
        }
        
        if (viewMode === 'combined') {
            drawTemperatureContour(result);
        }
        
        drawBladeProfile(holes);
        drawFilmParticles(time, holes);
        drawCoolantFlowAnimation(time);
        drawLabels(time, result);
        drawTemperatureScale(result);
        drawTemperatureProfileCurve(result);
        drawEfficiencyTrend(result, time);
        drawSpanwiseProfile(result);
    }

    function resize(newWidth, newHeight) {
        width = newWidth;
        height = newHeight;
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        const bounds = BladeGeometry.getBounds();
        const rangeX = bounds.maxX - bounds.minX;
        const rangeY = bounds.maxY - bounds.minY;
        scale = Math.min(width / rangeX, height / rangeY) * 0.85;
        
        offsetX = (width - rangeX * scale) / 2 - bounds.minX * scale;
        offsetY = (height - rangeY * scale) / 2 - bounds.minY * scale;
    }

    return {
        init,
        render,
        resize,
        getTemperatureColor,
        drawTemperatureHeatmap,
        drawTemperatureProfileCurve,
        drawEfficiencyTrend,
        drawSpanwiseProfile
    };
})();
