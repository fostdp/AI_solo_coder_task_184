const http = require('http');

const postData = JSON.stringify({
    coolant_flow: 0.05,
    mainstream_temp: 1000,
    coolant_temp: 300,
    mainstream_pressure: 2.0,
    coolant_pressure: 2.5,
    blade_material: 'nickel_alloy',
    hole_count: 24
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/monitor/simulate',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('测试 1: 测试在线监测 API...');
const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const result = JSON.parse(data);
        console.log('✓ 在线监测API响应:');
        console.log('  平均温度:', result.avgTemperature.toFixed(1) + '°C');
        console.log('  冷却效率:', result.coolingEfficiency.toFixed(1) + '%');
        console.log('  吹风比 M:', result.blowingRatio.toFixed(2));
        console.log('  气膜脱离:', result.detachmentMetrics.isDetached ? '是' : '否');
        console.log('  展向效率:', result.spanwiseStatistics.avgSpanwiseEfficiency.toFixed(1) + '%');
        console.log('  状态:', result.status);
        if (result.warnings) {
            console.log('  警告:', result.warnings);
        }
        console.log('');
        console.log('');
        testOptimizeAPI();
    });
});

req.on('error', (e) => { console.error('错误:', e.message); });
req.write(postData);
req.end();

function testOptimizeAPI() {
    console.log('测试 2: 测试孔位优化 API...');
    const optData = JSON.stringify({
        coolant_flow: 0.05,
        mainstream_temp: 1000,
        coolant_temp: 300,
        mainstream_pressure: 2.0,
        coolant_pressure: 2.5,
        blade_material: 'nickel_alloy',
        current_hole_count: 24,
        target_efficiency: 30
    });

    const optOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/optimize/hole-positions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(optData)
        }
    };

    const req2 = http.request(optOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            const result = JSON.parse(data);
            console.log('✓ 孔位优化API响应:');
            console.log('  推荐类型:', result.recommendation.type);
            console.log('  推荐消息:', result.recommendation.message);
            console.log('  建议孔数:', result.recommendation.targetHoleCount + ' 孔');
            console.log('  预期效率:', result.recommendation.expectedEfficiency.toFixed(1) + '%');
            console.log('  参数化研究点数:', result.parametricStudy.length);
            console.log('  优化建议数:', result.optimizationSuggestions.length);
            console.log('  权衡分析:', result.recommendation.tradeOffAnalysis ? result.recommendation.tradeOffAnalysis.length + ' 项' : '无');
            console.log('');
            console.log('  参数化研究结果:');
            result.parametricStudy.forEach(r => {
                console.log('    ' + r.holeCount + '孔: ' + r.coolingEfficiency.toFixed(1) + '%' + (r.isDetached ? ' (脱离)' : ''));
            });
            console.log('');
            console.log('✓ 所有API测试通过!');
            process.exit(0);
        });
    });

    req2.on('error', (e) => { console.error('错误:', e.message); });
    req2.write(optData);
    req2.end();
}
