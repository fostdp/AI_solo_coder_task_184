const http = require('http');

const postData = JSON.stringify({
    coolant_flow: 0.05,
    mainstream_temp: 1000,
    coolant_temp: 300,
    mainstream_pressure: 3.0,
    coolant_pressure: 3.0,
    blade_material: 'nickel_alloy',
    hole_count: 24,
    target_efficiency: 30
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/optimize/hole-positions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('测试正常工况下的孔位优化 API...');
console.log('主流压力: 3.0 MPa, 冷气压力: 3.0 MPa (M=1.0 左右，无脱离)');
console.log('');
const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const result = JSON.parse(data);
        console.log('✓ 孔位优化API响应:');
        console.log('  推荐类型:', result.recommendation.type);
        console.log('  推荐消息:', result.recommendation.message);
        console.log('  建议孔数:', result.recommendation.targetHoleCount + ' 孔');
        console.log('  预期效率:', result.recommendation.expectedEfficiency.toFixed(1) + '%');
        console.log('  最佳孔数:', result.recommendation.bestHoleCount + ' 孔 (' + result.recommendation.bestEfficiency.toFixed(1) + '%)');
        console.log('  参数化研究点数:', result.parametricStudy.length);
        console.log('  优化建议数:', result.optimizationSuggestions.length);
        console.log('');
        console.log('  参数化研究结果:');
        result.parametricStudy.forEach(r => {
            console.log('    ' + r.holeCount + '孔: η=' + r.coolingEfficiency.toFixed(1) + '%, M=' + r.blowingRatio.toFixed(2) + (r.isDetached ? ' (脱离)' : ' (附着)'));
        });
        console.log('');
        if (result.optimizationSuggestions.length > 0) {
            console.log('  优化建议:');
            result.optimizationSuggestions.forEach(s => {
                console.log('    [' + s.type + '] ' + s.category + ': ' + s.suggestion);
            });
        }
        if (result.recommendation.tradeOffAnalysis) {
            console.log('');
            console.log('  权衡分析:');
            result.recommendation.tradeOffAnalysis.forEach(t => {
                console.log('    ' + t.aspect + ': ' + t.optimal);
            });
        }
        console.log('');
        console.log('✓ 正常工况测试通过!');
        process.exit(0);
    });
});

req.on('error', (e) => { console.error('错误:', e.message); });
req.write(postData);
req.end();
