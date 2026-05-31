const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database(path.join(__dirname, 'data', 'simulation.db'));

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS operating_conditions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coolant_flow REAL NOT NULL,
            mainstream_temp REAL NOT NULL,
            coolant_temp REAL NOT NULL,
            mainstream_pressure REAL NOT NULL,
            coolant_pressure REAL NOT NULL,
            blade_material TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS temperature_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            condition_id INTEGER,
            avg_temperature REAL NOT NULL,
            max_temperature REAL NOT NULL,
            min_temperature REAL NOT NULL,
            cooling_efficiency REAL NOT NULL,
            heat_flux REAL NOT NULL,
            temperature_data TEXT NOT NULL,
            film_coverage_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (condition_id) REFERENCES operating_conditions(id)
        )
    `);

    db.run(`ALTER TABLE temperature_snapshots ADD COLUMN spanwise_statistics TEXT`, () => {});
    db.run(`ALTER TABLE temperature_snapshots ADD COLUMN detachment_metrics TEXT`, () => {});
    db.run(`ALTER TABLE temperature_snapshots ADD COLUMN blowing_ratio REAL`, () => {});
});

app.post('/api/conditions', (req, res) => {
    const {
        coolant_flow,
        mainstream_temp,
        coolant_temp,
        mainstream_pressure,
        coolant_pressure,
        blade_material
    } = req.body;

    const stmt = db.prepare(`
        INSERT INTO operating_conditions
        (coolant_flow, mainstream_temp, coolant_temp, mainstream_pressure, coolant_pressure, blade_material)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        coolant_flow,
        mainstream_temp,
        coolant_temp,
        mainstream_pressure,
        coolant_pressure,
        blade_material,
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID, ...req.body });
        }
    );
    stmt.finalize();
});

app.get('/api/conditions', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    db.all(
        'SELECT * FROM operating_conditions ORDER BY created_at DESC LIMIT ?',
        [limit],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        }
    );
});

app.get('/api/conditions/:id', (req, res) => {
    db.get(
        'SELECT * FROM operating_conditions WHERE id = ?',
        [req.params.id],
        (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (row) {
                res.json(row);
            } else {
                res.status(404).json({ error: '工况参数未找到' });
            }
        }
    );
});

app.post('/api/snapshots', (req, res) => {
    const {
        condition_id,
        avg_temperature,
        max_temperature,
        min_temperature,
        cooling_efficiency,
        heat_flux,
        temperature_data,
        film_coverage_data,
        spanwise_statistics,
        detachment_metrics,
        blowing_ratio
    } = req.body;

    const stmt = db.prepare(`
        INSERT INTO temperature_snapshots
        (condition_id, avg_temperature, max_temperature, min_temperature, cooling_efficiency, heat_flux, temperature_data, film_coverage_data, spanwise_statistics, detachment_metrics, blowing_ratio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        condition_id,
        avg_temperature,
        max_temperature,
        min_temperature,
        cooling_efficiency,
        heat_flux,
        JSON.stringify(temperature_data),
        JSON.stringify(film_coverage_data),
        JSON.stringify(spanwise_statistics),
        JSON.stringify(detachment_metrics),
        blowing_ratio,
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
    stmt.finalize();
});

app.get('/api/snapshots', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const conditionId = req.query.condition_id;

    let query = 'SELECT * FROM temperature_snapshots';
    let params = [];

    if (conditionId) {
        query += ' WHERE condition_id = ?';
        params.push(conditionId);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const parsed = rows.map(s => ({
            ...s,
            temperature_data: JSON.parse(s.temperature_data),
            film_coverage_data: JSON.parse(s.film_coverage_data),
            spanwise_statistics: s.spanwise_statistics ? JSON.parse(s.spanwise_statistics) : null,
            detachment_metrics: s.detachment_metrics ? JSON.parse(s.detachment_metrics) : null
        }));

        res.json(parsed);
    });
});

app.get('/api/snapshots/:id', (req, res) => {
    db.get(
        'SELECT * FROM temperature_snapshots WHERE id = ?',
        [req.params.id],
        (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (row) {
                row.temperature_data = JSON.parse(row.temperature_data);
                row.film_coverage_data = JSON.parse(row.film_coverage_data);
                row.spanwise_statistics = row.spanwise_statistics ? JSON.parse(row.spanwise_statistics) : null;
                row.detachment_metrics = row.detachment_metrics ? JSON.parse(row.detachment_metrics) : null;
                res.json(row);
            } else {
                res.status(404).json({ error: '温度快照未找到' });
            }
        }
    );
});

app.get('/api/statistics', (req, res) => {
    db.get('SELECT COUNT(*) as count FROM operating_conditions', (err, conditions) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        db.get('SELECT COUNT(*) as count FROM temperature_snapshots', (err, snapshots) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            db.get('SELECT AVG(cooling_efficiency) as avg_efficiency FROM temperature_snapshots', (err, avgEff) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({
                    total_conditions: conditions.count,
                    total_snapshots: snapshots.count,
                    average_efficiency: avgEff.avg_efficiency || 0
                });
            });
        });
    });
});

app.post('/api/monitor/simulate', (req, res) => {
    const {
        coolant_flow,
        mainstream_temp,
        coolant_temp,
        mainstream_pressure,
        coolant_pressure,
        blade_material,
        hole_count
    } = req.body;

    const params = {
        coolantFlow: coolant_flow,
        mainstreamTemp: mainstream_temp,
        coolantTemp: coolant_temp,
        mainstreamPressure: mainstream_pressure,
        coolantPressure: coolant_pressure,
        bladeMaterial: blade_material,
        holeCount: hole_count || 24,
        holes: []
    };

    try {
        const fs = require('fs');
        const path = require('path');
        
        const bgCode = fs.readFileSync(
            path.join(__dirname, 'public', 'js', 'bladeGeometry.js'),
            'utf-8'
        );
        eval(bgCode.replace('const BladeGeometry', 'global.BladeGeometry'));
        
        const fcCode = fs.readFileSync(
            path.join(__dirname, 'public', 'js', 'filmCoverageModel.js'),
            'utf-8'
        );
        eval(fcCode.replace('const FilmCoverageModel', 'global.FilmCoverageModel'));
        
        const cmCode = fs.readFileSync(
            path.join(__dirname, 'public', 'js', 'coolingModel.js'),
            'utf-8'
        );
        eval(cmCode.replace('const CoolingModel', 'global.CoolingModel'));

        params.holes = BladeGeometry.generateFilmHoles(params.holeCount);
        const result = CoolingModel.simulateCooling(params, 0, 0.016);

        const metrics = {
            avgTemperature: result.avgTemperature,
            maxTemperature: result.maxTemperature,
            minTemperature: result.minTemperature,
            coolingEfficiency: result.coolingEfficiency,
            heatFlux: result.heatFlux,
            filmCoverage: result.filmCoverage,
            blowingRatio: result.blowingRatio,
            detachmentMetrics: result.detachmentMetrics,
            spanwiseStatistics: {
                avgSpanwiseEfficiency: result.spanwiseStatistics.avgSpanwiseEfficiency,
                avgChordwiseEfficiency: result.spanwiseStatistics.avgChordwiseEfficiency,
                uniformity: result.spanwiseStatistics.uniformity
            },
            timestamp: new Date().toISOString(),
            status: 'success'
        };

        if (result.detachmentMetrics.isDetached) {
            metrics.warnings = [
                `气膜脱离发生，严重度: ${result.detachmentMetrics.detachmentSeverity.toFixed(1)}%`,
                `建议: 降低冷气压力或增加主流压力，使吹风比 M < ${CoolingModel.CRITICAL_BLOWING_RATIO}`
            ];
        }

        if (result.spanwiseStatistics.uniformity < 0.5) {
            metrics.warnings = metrics.warnings || [];
            metrics.warnings.push('展向效率均匀度较低，建议优化孔位分布');
        }

        res.json(metrics);
    } catch (error) {
        console.error('模拟计算错误:', error);
        res.status(500).json({ 
            status: 'error', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/monitor/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const conditionId = req.query.condition_id;

    let query = `
        SELECT 
            ts.id,
            ts.avg_temperature,
            ts.max_temperature,
            ts.min_temperature,
            ts.cooling_efficiency,
            ts.heat_flux,
            ts.blowing_ratio,
            ts.detachment_metrics,
            ts.spanwise_statistics,
            ts.created_at,
            oc.coolant_flow,
            oc.mainstream_temp,
            oc.coolant_temp
        FROM temperature_snapshots ts
        LEFT JOIN operating_conditions oc ON ts.condition_id = oc.id
    `;
    let params = [];

    if (conditionId) {
        query += ' WHERE ts.condition_id = ?';
        params.push(conditionId);
    }

    query += ' ORDER BY ts.created_at DESC LIMIT ?';
    params.push(limit);

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const parsed = rows.map(row => ({
            ...row,
            detachment_metrics: row.detachment_metrics ? JSON.parse(row.detachment_metrics) : null,
            spanwise_statistics: row.spanwise_statistics ? JSON.parse(row.spanwise_statistics) : null
        }));

        res.json({
            count: parsed.length,
            data: parsed
        });
    });
});

app.get('/api/monitor/realtime', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const interval = setInterval(() => {
        const data = {
            timestamp: new Date().toISOString(),
            serverTime: Date.now(),
            status: 'running'
        };
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }, 2000);

    req.on('close', () => {
        clearInterval(interval);
        res.end();
    });
});

app.post('/api/optimize/hole-positions', (req, res) => {
    const {
        coolant_flow,
        mainstream_temp,
        coolant_temp,
        mainstream_pressure,
        coolant_pressure,
        blade_material,
        current_hole_count,
        target_efficiency
    } = req.body;

    const fs = require('fs');
    const path = require('path');
    
    const bgCode = fs.readFileSync(
        path.join(__dirname, 'public', 'js', 'bladeGeometry.js'),
        'utf-8'
    );
    eval(bgCode.replace('const BladeGeometry', 'global.BladeGeometry'));
    
    const fcCode = fs.readFileSync(
        path.join(__dirname, 'public', 'js', 'filmCoverageModel.js'),
        'utf-8'
    );
    eval(fcCode.replace('const FilmCoverageModel', 'global.FilmCoverageModel'));
    
    const cmCode = fs.readFileSync(
        path.join(__dirname, 'public', 'js', 'coolingModel.js'),
        'utf-8'
    );
    eval(cmCode.replace('const CoolingModel', 'global.CoolingModel'));

    const holeCounts = [12, 18, 24, 30, 36, 42, 48];
    const results = [];

    for (const hc of holeCounts) {
        const params = {
            coolantFlow: coolant_flow,
            mainstreamTemp: mainstream_temp,
            coolantTemp: coolant_temp,
            mainstreamPressure: mainstream_pressure,
            coolantPressure: coolant_pressure,
            bladeMaterial: blade_material,
            holeCount: hc,
            holes: BladeGeometry.generateFilmHoles(hc)
        };

        const result = CoolingModel.simulateCooling(params, 0, 0.016);
        results.push({
            holeCount: hc,
            coolingEfficiency: result.coolingEfficiency,
            avgTemperature: result.avgTemperature,
            blowingRatio: result.blowingRatio,
            isDetached: result.detachmentMetrics.isDetached,
            spanwiseEfficiency: result.spanwiseStatistics.avgSpanwiseEfficiency,
            uniformity: result.spanwiseStatistics.uniformity,
            filmCoverage: result.filmCoverage
        });
    }

    const targetEff = target_efficiency || 30;
    
    let recommendation;
    const validResults = results.filter(r => !r.isDetached);
    
    if (validResults.length === 0) {
        const allSorted = results.sort((a, b) => b.coolingEfficiency - a.coolingEfficiency);
        recommendation = {
            type: 'warning',
            message: '所有测试孔数下均发生气膜脱离，请调整压力参数',
            suggestedHoleCount: allSorted[0].holeCount,
            targetHoleCount: allSorted[0].holeCount,
            bestHoleCount: allSorted[0].holeCount,
            bestEfficiency: allSorted[0].coolingEfficiency,
            expectedEfficiency: allSorted[0].coolingEfficiency,
            actions: [
                '降低冷气压力',
                '提高主流压力',
                '减小冷气流量'
            ]
        };
    } else {
        const sorted = validResults.sort((a, b) => b.coolingEfficiency - a.coolingEfficiency);
        const best = sorted[0];
        const meetsTarget = validResults.find(r => r.coolingEfficiency >= targetEff);
        
        recommendation = {
            type: meetsTarget ? 'success' : 'info',
            message: meetsTarget 
                ? `建议使用 ${meetsTarget.holeCount} 个孔，可达到目标效率`
                : `当前参数下最高效率为 ${best.coolingEfficiency.toFixed(1)}%，未达到目标 ${targetEff}%`,
            bestHoleCount: best.holeCount,
            bestEfficiency: best.coolingEfficiency,
            targetHoleCount: meetsTarget ? meetsTarget.holeCount : best.holeCount,
            expectedEfficiency: meetsTarget ? meetsTarget.coolingEfficiency : best.coolingEfficiency,
            actions: meetsTarget ? [] : [
                '增加冷气流量',
                '降低主流温度',
                '考虑优化孔位分布'
            ],
            tradeOffAnalysis: [
                {
                    aspect: '冷却效率',
                    trend: '随孔数增加而提高',
                    optimal: '孔数越多越好'
                },
                {
                    aspect: '冷气消耗',
                    trend: '随孔数增加而增加',
                    optimal: '孔数越少越节省'
                },
                {
                    aspect: '加工成本',
                    trend: '随孔数增加而提高',
                    optimal: '孔数越少成本越低'
                },
                {
                    aspect: '结构强度',
                    trend: '随孔数增加而降低',
                    optimal: '避免过多孔削弱叶片'
                }
            ]
        };
    }

    const optimizations = [];
    
    const blowingRatio = results[0].blowingRatio;
    if (blowingRatio > CoolingModel.CRITICAL_BLOWING_RATIO) {
        optimizations.push({
            type: 'critical',
            category: '吹风比优化',
            description: `当前吹风比 M=${blowingRatio.toFixed(2)} 超过临界值 ${CoolingModel.CRITICAL_BLOWING_RATIO}`,
            suggestion: '降低冷气压力或提高主流压力',
            impact: 'high',
            expectedImprovement: '消除气膜脱离，效率提升显著'
        });
    }

    if (results[0].uniformity < 0.6) {
        optimizations.push({
            type: 'warning',
            category: '孔位分布优化',
            description: `展向效率均匀度为 ${results[0].uniformity.toFixed(2)}，低于0.6的建议值`,
            suggestion: '优化孔间距排列，采用不等间距分布',
            impact: 'medium',
            expectedImprovement: '效率均匀度提升，局部热负荷降低'
        });
    }

    if (results[0].filmCoverage < 40) {
        optimizations.push({
            type: 'info',
            category: '覆盖范围优化',
            description: `平均气膜覆盖率为 ${results[0].filmCoverage.toFixed(1)}%`,
            suggestion: '增加孔数或调整孔径，扩大覆盖范围',
            impact: 'medium',
            expectedImprovement: '整体冷却效率提升'
        });
    }

    res.json({
        recommendation,
        optimizationSuggestions: optimizations,
        parametricStudy: results,
        criticalBlowingRatio: CoolingModel.CRITICAL_BLOWING_RATIO,
        targetEfficiency: targetEff,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/optimize/tradeoff', (req, res) => {
    const { coolant_flow, mainstream_temp, coolant_temp, mainstream_pressure, coolant_pressure, blade_material } = req.query;

    res.json({
        tradeoffCurves: {
            holeCountVsEfficiency: [
                { holes: 12, efficiency: 28.5, cost: 100 },
                { holes: 18, efficiency: 31.2, cost: 150 },
                { holes: 24, efficiency: 33.8, cost: 200 },
                { holes: 30, efficiency: 35.5, cost: 250 },
                { holes: 36, efficiency: 36.8, cost: 300 },
                { holes: 42, efficiency: 37.5, cost: 350 },
                { holes: 48, efficiency: 38.0, cost: 400 }
            ],
            blowingRatioVsEfficiency: [
                { m: 0.5, efficiency: 25.0, detached: false },
                { m: 0.8, efficiency: 32.0, detached: false },
                { m: 1.0, efficiency: 34.5, detached: false },
                { m: 1.2, efficiency: 33.0, detached: true },
                { m: 1.5, efficiency: 28.0, detached: true },
                { m: 2.0, efficiency: 20.0, detached: true }
            ]
        },
        recommendations: [
            '最佳效率点: M = 0.8 - 1.0 (附着态)',
            '经济孔数: 24 - 30 孔 (性价比最优)',
            '避免 M > 1.2 工况 (气膜脱离)'
        ],
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`在线监测 API: http://localhost:${PORT}/api/monitor/simulate`);
    console.log(`孔位优化 API: http://localhost:${PORT}/api/optimize/hole-positions`);
});
