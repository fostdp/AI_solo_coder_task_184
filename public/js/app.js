const App = (function() {
    const state = {
        isRunning: false,
        isPaused: false,
        simulationTime: 0,
        lastTime: 0,
        animationFrameId: null,
        viewMode: 'temperature',
        autoMonitor: false,
        autoMonitorInterval: null,
        params: {
            coolantFlow: 0.05,
            mainstreamTemp: 1000,
            coolantTemp: 300,
            mainstreamPressure: 2.0,
            coolantPressure: 2.5,
            bladeMaterial: 'nickel_alloy',
            holeCount: 24,
            holes: []
        },
        currentResult: null,
        conditionId: null
    };

    const elements = {};

    function init() {
        cacheElements();
        setupEventListeners();
        updateHoles();
        
        Visualization.init(elements.canvas);
        
        const initialResult = CoolingModel.simulateCooling(state.params, 0, 0.016);
        state.currentResult = initialResult;
        updateResultDisplay(initialResult);
        
        Visualization.render(initialResult, state.viewMode, state.params.holes, 0);
        
        saveCondition();
    }

    function cacheElements() {
        elements.canvas = document.getElementById('bladeCanvas');
        
        elements.mainstreamTemp = document.getElementById('mainstreamTemp');
        elements.coolantFlow = document.getElementById('coolantFlow');
        elements.coolantTemp = document.getElementById('coolantTemp');
        elements.mainstreamPressure = document.getElementById('mainstreamPressure');
        elements.coolantPressure = document.getElementById('coolantPressure');
        elements.bladeMaterial = document.getElementById('bladeMaterial');
        elements.holeCount = document.getElementById('holeCount');
        
        elements.mainstreamTempValue = document.getElementById('mainstreamTempValue');
        elements.coolantFlowValue = document.getElementById('coolantFlowValue');
        elements.coolantTempValue = document.getElementById('coolantTempValue');
        elements.mainstreamPressureValue = document.getElementById('mainstreamPressureValue');
        elements.coolantPressureValue = document.getElementById('coolantPressureValue');
        elements.holeCountValue = document.getElementById('holeCountValue');
        
        elements.avgTemp = document.getElementById('avgTemp');
        elements.maxTemp = document.getElementById('maxTemp');
        elements.minTemp = document.getElementById('minTemp');
        elements.coolingEfficiency = document.getElementById('coolingEfficiency');
        elements.heatFlux = document.getElementById('heatFlux');
        elements.filmCoverage = document.getElementById('filmCoverage');
        
        elements.spanwiseEta = document.getElementById('spanwiseEta');
        elements.chordwiseEta = document.getElementById('chordwiseEta');
        elements.blowingRatio = document.getElementById('blowingRatio');
        elements.detachmentStatus = document.getElementById('detachmentStatus');
        
        elements.btnStart = document.getElementById('btnStart');
        elements.btnPause = document.getElementById('btnPause');
        elements.btnReset = document.getElementById('btnReset');
        elements.btnTempView = document.getElementById('btnTempView');
        elements.btnFilmView = document.getElementById('btnFilmView');
        elements.btnCombinedView = document.getElementById('btnCombinedView');
        elements.btnSaveSnapshot = document.getElementById('btnSaveSnapshot');
        elements.btnLoadSnapshot = document.getElementById('btnLoadSnapshot');
        elements.btnMonitor = document.getElementById('btnMonitor');
        elements.btnOptimize = document.getElementById('btnOptimize');
        
        elements.statusIndicator = document.getElementById('statusIndicator');
        elements.statusText = document.getElementById('statusText');
        elements.tempMin = document.getElementById('tempMin');
        elements.tempMax = document.getElementById('tempMax');
        
        elements.snapshotModal = document.getElementById('snapshotModal');
        elements.closeModal = document.getElementById('closeModal');
        elements.snapshotList = document.getElementById('snapshotList');
        
        elements.monitorModal = document.getElementById('monitorModal');
        elements.closeMonitorModal = document.getElementById('closeMonitorModal');
        elements.monitorAvgTemp = document.getElementById('monitorAvgTemp');
        elements.monitorEfficiency = document.getElementById('monitorEfficiency');
        elements.monitorHeatFlux = document.getElementById('monitorHeatFlux');
        elements.monitorBlowingRatio = document.getElementById('monitorBlowingRatio');
        elements.monitorStatus = document.getElementById('monitorStatus');
        elements.monitorWarnings = document.getElementById('monitorWarnings');
        elements.btnRefreshMonitor = document.getElementById('btnRefreshMonitor');
        elements.btnAutoMonitor = document.getElementById('btnAutoMonitor');
        
        elements.optimizeModal = document.getElementById('optimizeModal');
        elements.closeOptimizeModal = document.getElementById('closeOptimizeModal');
        elements.targetEfficiency = document.getElementById('targetEfficiency');
        elements.targetEfficiencyValue = document.getElementById('targetEfficiencyValue');
        elements.btnRunOptimization = document.getElementById('btnRunOptimization');
        elements.optimizeResults = document.getElementById('optimizeResults');
        elements.optimizeRecommendation = document.getElementById('optimizeRecommendation');
        elements.parametricStudy = document.getElementById('parametricStudy');
        elements.optimizeSuggestions = document.getElementById('optimizeSuggestions');
        elements.tradeoffAnalysis = document.getElementById('tradeoffAnalysis');
    }

    function setupEventListeners() {
        elements.mainstreamTemp.addEventListener('input', (e) => {
            state.params.mainstreamTemp = parseFloat(e.target.value);
            elements.mainstreamTempValue.textContent = state.params.mainstreamTemp;
            updateSimulation();
        });

        elements.coolantFlow.addEventListener('input', (e) => {
            state.params.coolantFlow = parseFloat(e.target.value);
            elements.coolantFlowValue.textContent = state.params.coolantFlow.toFixed(3);
            updateSimulation();
        });

        elements.coolantTemp.addEventListener('input', (e) => {
            state.params.coolantTemp = parseFloat(e.target.value);
            elements.coolantTempValue.textContent = state.params.coolantTemp;
            updateSimulation();
        });

        elements.mainstreamPressure.addEventListener('input', (e) => {
            state.params.mainstreamPressure = parseFloat(e.target.value);
            elements.mainstreamPressureValue.textContent = state.params.mainstreamPressure.toFixed(1);
            updateSimulation();
        });

        elements.coolantPressure.addEventListener('input', (e) => {
            state.params.coolantPressure = parseFloat(e.target.value);
            elements.coolantPressureValue.textContent = state.params.coolantPressure.toFixed(1);
            updateSimulation();
        });

        elements.bladeMaterial.addEventListener('change', (e) => {
            state.params.bladeMaterial = e.target.value;
            updateSimulation();
        });

        elements.holeCount.addEventListener('input', (e) => {
            state.params.holeCount = parseInt(e.target.value);
            elements.holeCountValue.textContent = state.params.holeCount;
            updateHoles();
            updateSimulation();
        });

        elements.btnStart.addEventListener('click', startSimulation);
        elements.btnPause.addEventListener('click', togglePause);
        elements.btnReset.addEventListener('click', resetSimulation);

        elements.btnTempView.addEventListener('click', () => setViewMode('temperature'));
        elements.btnFilmView.addEventListener('click', () => setViewMode('film'));
        elements.btnCombinedView.addEventListener('click', () => setViewMode('combined'));

        elements.btnSaveSnapshot.addEventListener('click', saveSnapshot);
        elements.btnLoadSnapshot.addEventListener('click', loadSnapshots);
        elements.closeModal.addEventListener('click', () => {
            elements.snapshotModal.classList.add('hidden');
        });

        elements.snapshotModal.addEventListener('click', (e) => {
            if (e.target === elements.snapshotModal) {
                elements.snapshotModal.classList.add('hidden');
            }
        });

        elements.btnMonitor.addEventListener('click', openMonitorModal);
        elements.closeMonitorModal.addEventListener('click', closeMonitorModal);
        elements.monitorModal.addEventListener('click', (e) => {
            if (e.target === elements.monitorModal) closeMonitorModal();
        });
        elements.btnRefreshMonitor.addEventListener('click', fetchMonitorData);
        elements.btnAutoMonitor.addEventListener('click', toggleAutoMonitor);

        elements.btnOptimize.addEventListener('click', openOptimizeModal);
        elements.closeOptimizeModal.addEventListener('click', closeOptimizeModal);
        elements.optimizeModal.addEventListener('click', (e) => {
            if (e.target === elements.optimizeModal) closeOptimizeModal();
        });
        elements.targetEfficiency.addEventListener('input', (e) => {
            elements.targetEfficiencyValue.textContent = e.target.value + '%';
        });
        elements.btnRunOptimization.addEventListener('click', runOptimization);
    }

    function updateHoles() {
        state.params.holes = BladeGeometry.generateFilmHoles(state.params.holeCount);
    }

    function updateSimulation() {
        const result = CoolingModel.simulateCooling(state.params, state.simulationTime, 0.016);
        state.currentResult = result;
        updateResultDisplay(result);
        Visualization.render(result, state.viewMode, state.params.holes, state.simulationTime);
    }

    function updateResultDisplay(result) {
        elements.avgTemp.textContent = result.avgTemperature.toFixed(1);
        elements.maxTemp.textContent = result.maxTemperature.toFixed(1);
        elements.minTemp.textContent = result.minTemperature.toFixed(1);
        elements.coolingEfficiency.textContent = result.coolingEfficiency.toFixed(1);
        elements.heatFlux.textContent = result.heatFlux.toFixed(2);
        elements.filmCoverage.textContent = result.filmCoverage.toFixed(1);
        
        elements.spanwiseEta.textContent = result.spanwiseStatistics.avgSpanwiseEfficiency.toFixed(1);
        elements.chordwiseEta.textContent = result.spanwiseStatistics.avgChordwiseEfficiency.toFixed(1);
        elements.blowingRatio.textContent = result.blowingRatio.toFixed(2);
        
        if (result.detachmentMetrics.isDetached) {
            elements.detachmentStatus.textContent = result.detachmentMetrics.detachmentSeverity.toFixed(0);
            elements.detachmentStatus.style.color = '#ef4444';
        } else {
            elements.detachmentStatus.textContent = '正常';
            elements.detachmentStatus.style.color = '#10b981';
        }
        
        elements.tempMin.textContent = Math.round(result.minTemperature);
        elements.tempMax.textContent = Math.round(result.maxTemperature);
    }

    function startSimulation() {
        if (state.isRunning) return;
        
        state.isRunning = true;
        state.isPaused = false;
        state.lastTime = performance.now();
        
        elements.btnStart.disabled = true;
        elements.btnPause.disabled = false;
        elements.statusIndicator.className = 'status-indicator running';
        elements.statusText.textContent = '运行中';
        
        saveCondition();
        simulationLoop();
    }

    function simulationLoop(currentTime = performance.now()) {
        if (!state.isRunning || state.isPaused) return;
        
        const deltaTime = (currentTime - state.lastTime) / 1000;
        state.lastTime = currentTime;
        state.simulationTime += deltaTime;
        
        updateSimulation();
        
        state.animationFrameId = requestAnimationFrame(simulationLoop);
    }

    function togglePause() {
        if (!state.isRunning) return;
        
        state.isPaused = !state.isPaused;
        
        if (state.isPaused) {
            elements.btnPause.textContent = '继续';
            elements.statusIndicator.className = 'status-indicator paused';
            elements.statusText.textContent = '已暂停';
            if (state.animationFrameId) {
                cancelAnimationFrame(state.animationFrameId);
            }
        } else {
            elements.btnPause.textContent = '暂停';
            elements.statusIndicator.className = 'status-indicator running';
            elements.statusText.textContent = '运行中';
            state.lastTime = performance.now();
            simulationLoop();
        }
    }

    function resetSimulation() {
        state.isRunning = false;
        state.isPaused = false;
        state.simulationTime = 0;
        
        if (state.animationFrameId) {
            cancelAnimationFrame(state.animationFrameId);
        }
        
        elements.btnStart.disabled = false;
        elements.btnPause.disabled = true;
        elements.btnPause.textContent = '暂停';
        elements.statusIndicator.className = 'status-indicator';
        elements.statusText.textContent = '就绪';
        
        updateSimulation();
    }

    function setViewMode(mode) {
        state.viewMode = mode;
        
        elements.btnTempView.classList.toggle('active', mode === 'temperature');
        elements.btnFilmView.classList.toggle('active', mode === 'film');
        elements.btnCombinedView.classList.toggle('active', mode === 'combined');
        
        Visualization.render(state.currentResult, mode, state.params.holes, state.simulationTime);
    }

    async function saveCondition() {
        try {
            const response = await fetch('/api/conditions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    coolant_flow: state.params.coolantFlow,
                    mainstream_temp: state.params.mainstreamTemp,
                    coolant_temp: state.params.coolantTemp,
                    mainstream_pressure: state.params.mainstreamPressure,
                    coolant_pressure: state.params.coolantPressure,
                    blade_material: state.params.bladeMaterial
                })
            });
            const data = await response.json();
            state.conditionId = data.id;
        } catch (error) {
            console.error('保存工况参数失败:', error);
        }
    }

    async function saveSnapshot() {
        if (!state.currentResult) return;
        
        try {
            await saveCondition();
            
            const response = await fetch('/api/snapshots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    condition_id: state.conditionId,
                    avg_temperature: state.currentResult.avgTemperature,
                    max_temperature: state.currentResult.maxTemperature,
                    min_temperature: state.currentResult.minTemperature,
                    cooling_efficiency: state.currentResult.coolingEfficiency,
                    heat_flux: state.currentResult.heatFlux,
                    temperature_data: state.currentResult.temperatureField,
                    film_coverage_data: state.currentResult.filmCoverageField,
                    spanwise_statistics: state.currentResult.spanwiseStatistics,
                    detachment_metrics: state.currentResult.detachmentMetrics,
                    blowing_ratio: state.currentResult.blowingRatio
                })
            });
            
            const result = await response.json();
            alert(`快照已保存! ID: ${result.id}`);
        } catch (error) {
            console.error('保存快照失败:', error);
            alert('保存快照失败');
        }
    }

    async function loadSnapshots() {
        try {
            const response = await fetch('/api/snapshots?limit=20');
            const snapshots = await response.json();
            
            elements.snapshotList.innerHTML = '';
            
            if (snapshots.length === 0) {
                elements.snapshotList.innerHTML = '<p style="color: #94a3b8; text-align: center;">暂无历史快照</p>';
            } else {
                snapshots.forEach(snapshot => {
                    const spanwise = snapshot.spanwise_statistics;
                    const detachment = snapshot.detachment_metrics;
                    const item = document.createElement('div');
                    item.className = 'snapshot-item';
                    item.innerHTML = `
                        <div class="snapshot-header">
                            <span class="snapshot-id">快照 #${snapshot.id}</span>
                            <span class="snapshot-date">${new Date(snapshot.created_at).toLocaleString('zh-CN')}</span>
                        </div>
                        <div class="snapshot-params">
                            <div class="snapshot-param">平均温度: <span>${snapshot.avg_temperature.toFixed(1)}°C</span></div>
                            <div class="snapshot-param">冷却效率: <span>${snapshot.cooling_efficiency.toFixed(1)}%</span></div>
                            <div class="snapshot-param">热通量: <span>${snapshot.heat_flux.toFixed(2)} MW/m²</span></div>
                            ${spanwise ? `<div class="snapshot-param">展向η: <span>${spanwise.avgSpanwiseEfficiency.toFixed(1)}%</span></div>` : ''}
                            ${detachment ? `<div class="snapshot-param">脱离: <span>${detachment.isDetached ? '是' : '否'}</span></div>` : ''}
                            ${snapshot.blowing_ratio !== undefined ? `<div class="snapshot-param">M: <span>${snapshot.blowing_ratio.toFixed(2)}</span></div>` : ''}
                        </div>
                    `;
                    item.addEventListener('click', () => loadSnapshot(snapshot));
                    elements.snapshotList.appendChild(item);
                });
            }
            
            elements.snapshotModal.classList.remove('hidden');
        } catch (error) {
            console.error('加载快照失败:', error);
        }
    }

    function loadSnapshot(snapshot) {
        elements.snapshotModal.classList.add('hidden');
        
        state.currentResult = {
            temperatureField: snapshot.temperature_data,
            filmCoverageField: snapshot.film_coverage_data,
            avgTemperature: snapshot.avg_temperature,
            maxTemperature: snapshot.max_temperature,
            minTemperature: snapshot.min_temperature,
            coolingEfficiency: snapshot.cooling_efficiency,
            heatFlux: snapshot.heat_flux,
            gridSize: snapshot.temperature_data.length,
            bounds: BladeGeometry.getBounds(),
            spanwiseStatistics: snapshot.spanwise_statistics || {
                avgSpanwiseEfficiency: 0,
                avgChordwiseEfficiency: 0,
                avgSpanwiseTemperature: snapshot.avg_temperature
            },
            detachmentMetrics: snapshot.detachment_metrics || {
                isDetached: false,
                detachmentSeverity: 0,
                detachmentFactor: 1.0
            },
            blowingRatio: snapshot.blowing_ratio || 0
        };
        
        updateResultDisplay(state.currentResult);
        Visualization.render(state.currentResult, state.viewMode, state.params.holes, state.simulationTime);
    }

    function openMonitorModal() {
        elements.monitorModal.classList.remove('hidden');
        fetchMonitorData();
    }

    function closeMonitorModal() {
        elements.monitorModal.classList.add('hidden');
        if (state.autoMonitor) {
            toggleAutoMonitor();
        }
    }

    async function fetchMonitorData() {
        try {
            const response = await fetch('/api/monitor/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    coolant_flow: state.params.coolantFlow,
                    mainstream_temp: state.params.mainstreamTemp,
                    coolant_temp: state.params.coolantTemp,
                    mainstream_pressure: state.params.mainstreamPressure,
                    coolant_pressure: state.params.coolantPressure,
                    blade_material: state.params.bladeMaterial,
                    hole_count: state.params.holeCount
                })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                elements.monitorAvgTemp.textContent = data.avgTemperature.toFixed(1);
                elements.monitorEfficiency.textContent = data.coolingEfficiency.toFixed(1);
                elements.monitorHeatFlux.textContent = data.heatFlux.toFixed(2);
                elements.monitorBlowingRatio.textContent = data.blowingRatio.toFixed(2);

                if (data.detachmentMetrics && data.detachmentMetrics.isDetached) {
                    elements.monitorStatus.innerHTML = '<span class="status-badge warning">气膜脱离</span>';
                } else {
                    elements.monitorStatus.innerHTML = '<span class="status-badge success">系统正常</span>';
                }

                if (data.warnings && data.warnings.length > 0) {
                    elements.monitorWarnings.innerHTML = data.warnings.map(w => 
                        `<div class="warning-item">⚠ ${w}</div>`
                    ).join('');
                } else {
                    elements.monitorWarnings.innerHTML = '<p class="no-warnings">暂无警告</p>';
                }
            }
        } catch (error) {
            console.error('获取监测数据失败:', error);
            elements.monitorWarnings.innerHTML = '<div class="warning-item">无法连接到服务器</div>';
        }
    }

    function toggleAutoMonitor() {
        state.autoMonitor = !state.autoMonitor;
        if (state.autoMonitor) {
            elements.btnAutoMonitor.textContent = '自动监测: 开';
            elements.btnAutoMonitor.classList.add('active');
            state.autoMonitorInterval = setInterval(fetchMonitorData, 3000);
        } else {
            elements.btnAutoMonitor.textContent = '自动监测: 关';
            elements.btnAutoMonitor.classList.remove('active');
            if (state.autoMonitorInterval) {
                clearInterval(state.autoMonitorInterval);
                state.autoMonitorInterval = null;
            }
        }
    }

    function openOptimizeModal() {
        elements.optimizeModal.classList.remove('hidden');
        elements.optimizeResults.classList.add('hidden');
    }

    function closeOptimizeModal() {
        elements.optimizeModal.classList.add('hidden');
    }

    async function runOptimization() {
        elements.btnRunOptimization.disabled = true;
        elements.btnRunOptimization.textContent = '分析中...';

        try {
            const response = await fetch('/api/optimize/hole-positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    coolant_flow: state.params.coolantFlow,
                    mainstream_temp: state.params.mainstreamTemp,
                    coolant_temp: state.params.coolantTemp,
                    mainstream_pressure: state.params.mainstreamPressure,
                    coolant_pressure: state.params.coolantPressure,
                    blade_material: state.params.bladeMaterial,
                    current_hole_count: state.params.holeCount,
                    target_efficiency: parseInt(elements.targetEfficiency.value)
                })
            });

            const data = await response.json();
            displayOptimizationResults(data);
        } catch (error) {
            console.error('优化分析失败:', error);
            alert('优化分析失败，请稍后重试');
        } finally {
            elements.btnRunOptimization.disabled = false;
            elements.btnRunOptimization.textContent = '运行优化分析';
        }
    }

    function displayOptimizationResults(data) {
        elements.optimizeResults.classList.remove('hidden');

        const rec = data.recommendation;
        const recClass = rec.type === 'success' ? 'success' : rec.type === 'warning' ? 'warning' : 'info';
        elements.optimizeRecommendation.innerHTML = `
            <div class="recommendation-header ${recClass}">
                <div class="recommendation-title">
                    ${rec.type === 'success' ? '✓' : rec.type === 'warning' ? '⚠' : 'ℹ'}
                    推荐方案
                </div>
                <div class="recommendation-message">${rec.message}</div>
            </div>
            <div class="recommendation-details">
                <div class="detail-item">
                    <span>建议孔数:</span>
                    <strong>${rec.targetHoleCount} 孔</strong>
                </div>
                <div class="detail-item">
                    <span>预期效率:</span>
                    <strong>${rec.expectedEfficiency.toFixed(1)}%</strong>
                </div>
                <div class="detail-item">
                    <span>最佳孔数:</span>
                    <strong>${rec.bestHoleCount} 孔 (${rec.bestEfficiency.toFixed(1)}%)</strong>
                </div>
            </div>
            ${rec.actions && rec.actions.length > 0 ? `
                <div class="recommendation-actions">
                    <strong>建议措施:</strong>
                    <ul>${rec.actions.map(a => `<li>${a}</li>`).join('')}</ul>
                </div>
            ` : ''}
        `;

        const parametricHtml = data.parametricStudy.map(r => `
            <tr class="${r.isDetached ? 'detached' : ''}">
                <td>${r.holeCount}</td>
                <td>${r.coolingEfficiency.toFixed(1)}%</td>
                <td>${r.avgTemperature.toFixed(0)}°C</td>
                <td>${r.blowingRatio.toFixed(2)}</td>
                <td>${r.isDetached ? '<span class="status-badge warning">脱离</span>' : '<span class="status-badge success">附着</span>'}</td>
                <td>${r.uniformity.toFixed(2)}</td>
            </tr>
        `).join('');
        elements.parametricStudy.innerHTML = `
            <table class="param-table">
                <thead>
                    <tr>
                        <th>孔数</th>
                        <th>冷却效率</th>
                        <th>平均温度</th>
                        <th>吹风比 M</th>
                        <th>状态</th>
                        <th>均匀度</th>
                    </tr>
                </thead>
                <tbody>${parametricHtml}</tbody>
            </table>
        `;

        if (data.optimizationSuggestions && data.optimizationSuggestions.length > 0) {
            elements.optimizeSuggestions.innerHTML = data.optimizationSuggestions.map(s => `
                <div class="suggestion-item ${s.type}">
                    <div class="suggestion-category">${s.category}</div>
                    <div class="suggestion-desc">${s.description}</div>
                    <div class="suggestion-suggestion">💡 ${s.suggestion}</div>
                    <div class="suggestion-impact">预期效果: ${s.expectedImprovement}</div>
                </div>
            `).join('');
        } else {
            elements.optimizeSuggestions.innerHTML = '<p class="no-warnings">当前配置已较优</p>';
        }

        if (rec.tradeOffAnalysis) {
            elements.tradeoffAnalysis.innerHTML = rec.tradeOffAnalysis.map(t => `
                <div class="tradeoff-item">
                    <div class="tradeoff-aspect">${t.aspect}</div>
                    <div class="tradeoff-trend">趋势: ${t.trend}</div>
                    <div class="tradeoff-optimal">最优: ${t.optimal}</div>
                </div>
            `).join('');
        }
    }

    return {
        init
    };
})();

document.addEventListener('DOMContentLoaded', App.init);
