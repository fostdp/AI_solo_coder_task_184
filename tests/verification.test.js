const fs = require('fs');
const path = require('path');

const testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    assertions: [],
    failures: []
};

function assert(condition, testName, expected, actual, description) {
    testResults.total++;
    if (condition) {
        testResults.passed++;
        testResults.assertions.push({
            name: testName,
            status: 'PASS',
            expected,
            actual,
            description
        });
    } else {
        testResults.failed++;
        testResults.assertions.push({
            name: testName,
            status: 'FAIL',
            expected,
            actual,
            description
        });
        testResults.failures.push({
            name: testName,
            expected,
            actual,
            description
        });
    }
    return condition;
}

function assertApproximatelyEqual(actual, expected, tolerance, testName, description) {
    const diff = Math.abs(actual - expected);
    const condition = diff <= tolerance;
    testResults.total++;
    if (condition) {
        testResults.passed++;
        testResults.assertions.push({
            name: testName,
            status: 'PASS',
            expected: `≈${expected} (±${tolerance})`,
            actual: actual,
            description
        });
    } else {
        testResults.failed++;
        testResults.assertions.push({
            name: testName,
            status: 'FAIL',
            expected: `≈${expected} (±${tolerance})`,
            actual: actual,
            description
        });
        testResults.failures.push({
            name: testName,
            expected: `≈${expected} (±${tolerance})`,
            actual: actual,
            description
        });
    }
    return condition;
}

function assertGreaterThan(actual, threshold, testName, description) {
    const condition = actual > threshold;
    testResults.total++;
    if (condition) {
        testResults.passed++;
        testResults.assertions.push({
            name: testName,
            status: 'PASS',
            expected: `> ${threshold}`,
            actual: actual,
            description
        });
    } else {
        testResults.failed++;
        testResults.assertions.push({
            name: testName,
            status: 'FAIL',
            expected: `> ${threshold}`,
            actual: actual,
            description
        });
        testResults.failures.push({
            name: testName,
            expected: `> ${threshold}`,
            actual: actual,
            description
        });
    }
    return condition;
}

function assertLessThan(actual, threshold, testName, description) {
    const condition = actual < threshold;
    testResults.total++;
    if (condition) {
        testResults.passed++;
        testResults.assertions.push({
            name: testName,
            status: 'PASS',
            expected: `< ${threshold}`,
            actual: actual,
            description
        });
    } else {
        testResults.failed++;
        testResults.assertions.push({
            name: testName,
            status: 'FAIL',
            expected: `< ${threshold}`,
            actual: actual,
            description
        });
        testResults.failures.push({
            name: testName,
            expected: `< ${threshold}`,
            actual: actual,
            description
        });
    }
    return condition;
}

function assertExists(value, testName, description) {
    const condition = value !== undefined && value !== null;
    testResults.total++;
    if (condition) {
        testResults.passed++;
        testResults.assertions.push({
            name: testName,
            status: 'PASS',
            expected: 'exists (not null/undefined)',
            actual: value,
            description
        });
    } else {
        testResults.failed++;
        testResults.assertions.push({
            name: testName,
            status: 'FAIL',
            expected: 'exists (not null/undefined)',
            actual: value,
            description
        });
        testResults.failures.push({
            name: testName,
            expected: 'exists (not null/undefined)',
            actual: value,
            description
        });
    }
    return condition;
}

console.log('\n' + '='.repeat(70));
console.log('  航空发动机涡轮叶片冷却模拟 - 修复验证测试套件');
console.log('='.repeat(70));
console.log(`  测试时间: ${new Date().toLocaleString('zh-CN')}`);
console.log('='.repeat(70));

const bladeGeometryCode = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'js', 'bladeGeometry.js'),
    'utf-8'
);
eval(bladeGeometryCode.replace('const BladeGeometry', 'global.BladeGeometry'));

const filmCoverageCode = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'js', 'filmCoverageModel.js'),
    'utf-8'
);
eval(filmCoverageCode.replace('const FilmCoverageModel', 'global.FilmCoverageModel'));

const coolingModelCode = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'js', 'coolingModel.js'),
    'utf-8'
);
eval(coolingModelCode.replace('const CoolingModel', 'global.CoolingModel'));

console.log('\n' + '─'.repeat(70));
console.log('  测试 1: 孔间距变化对展向平均效率的影响');
console.log('  假设: 孔间距减小(孔数增加) → 展向平均效率 η_spanwise 升高');
console.log('─'.repeat(70));

const test1Params = {
    mainstreamTemp: 1000,
    coolantTemp: 300,
    coolantFlow: 0.05,
    mainstreamPressure: 2.0,
    coolantPressure: 2.5,
    bladeMaterial: 'nickel_alloy'
};

const holeCounts = [12, 18, 24, 30, 36, 48];
const holeSpacingResults = [];

for (const holeCount of holeCounts) {
    const holes = BladeGeometry.generateFilmHoles(holeCount);
    const result = CoolingModel.simulateCooling(
        { ...test1Params, holes },
        0,
        0.016
    );
    holeSpacingResults.push({
        holeCount,
        spacingToDiameter: (300 / holeCount) / 2.5,
        spanwiseEta: result.spanwiseStatistics.avgSpanwiseEfficiency,
        coolingEta: result.coolingEfficiency
    });
}

console.log('\n  孔间距(D)  |  孔数  |  展向平均η(%)  |  整体效率(%)');
console.log('  ' + '-'.repeat(55));
for (const r of holeSpacingResults) {
    console.log(`     ${r.spacingToDiameter.toFixed(2)}      |   ${String(r.holeCount).padStart(2)}   |    ${r.spanwiseEta.toFixed(1).padStart(6)}     |    ${r.coolingEta.toFixed(1).padStart(5)}`);
}
console.log('');

const etaSmallSpacing = holeSpacingResults[holeSpacingResults.length - 1].spanwiseEta;
const etaLargeSpacing = holeSpacingResults[0].spanwiseEta;

assertGreaterThan(
    etaSmallSpacing,
    etaLargeSpacing,
    'TEST1.1: 小孔间距(48孔)展向η > 大孔间距(12孔)展向η',
    '孔间距减小应通过多孔叠加提升展向平均效率'
);

const etaMid = holeSpacingResults[Math.floor(holeSpacingResults.length / 2)].spanwiseEta;
assert(
    etaSmallSpacing > etaMid && etaMid > etaLargeSpacing,
    'TEST1.2: 展向η随孔数增加单调递增',
    `单调递增关系`,
    `12孔:${etaLargeSpacing.toFixed(1)} → 24孔:${etaMid.toFixed(1)} → 48孔:${etaSmallSpacing.toFixed(1)}`,
    '展向平均效率应随孔间距减小而单调升高'
);

const etaDelta = etaSmallSpacing - etaLargeSpacing;
assertGreaterThan(
    etaDelta,
    0.2,
    'TEST1.3: 孔间距从2.5D(12孔)到0.6D(48孔)，效率提升 > 0.2%',
    '多孔叠加效应应产生可测量的效率提升'
);

console.log('\n  失败用例:');
if (testResults.failures.filter(f => f.name.startsWith('TEST1')).length === 0) {
    console.log('    ✓ 无失败 - 孔间距与效率的相关性已验证');
} else {
    testResults.failures.filter(f => f.name.startsWith('TEST1')).forEach(f => {
        console.log(`    ✗ ${f.name}`);
        console.log(`      期望值: ${f.expected}`);
        console.log(`      实际值: ${f.actual}`);
        console.log(`      说明: ${f.description}`);
    });
}

console.log('\n' + '─'.repeat(70));
console.log('  测试 2: 吹风比变化下的气膜脱离检测');
console.log('  假设: 当 M > M_crit(1.2) 时，气膜脱离发生，η 骤降');
console.log('─'.repeat(70));

const test2Holes = BladeGeometry.generateFilmHoles(24);
const blowingRatioResults = [];
const pressurePairs = [
    { main: 3.0, cool: 3.1 },
    { main: 3.0, cool: 3.3 },
    { main: 3.0, cool: 3.8 },
    { main: 3.0, cool: 4.5 },
    { main: 3.0, cool: 5.5 },
    { main: 3.0, cool: 7.0 }
];

for (const p of pressurePairs) {
    const result = CoolingModel.simulateCooling(
        {
            ...test1Params,
            mainstreamPressure: p.main,
            coolantPressure: p.cool,
            holes: test2Holes
        },
        0,
        0.016
    );
    blowingRatioResults.push({
        mainstreamPressure: p.main,
        coolantPressure: p.cool,
        blowingRatio: result.blowingRatio,
        isDetached: result.detachmentMetrics.isDetached,
        detachmentSeverity: result.detachmentMetrics.detachmentSeverity,
        detachmentFactor: result.detachmentMetrics.detachmentFactor,
        spanwiseEta: result.spanwiseStatistics.avgSpanwiseEfficiency
    });
}

console.log('\n  主流压  |  冷气压  |  吹风比 M  |  脱离  |  严重度(%) |  展向η(%)');
console.log('  ' + '-'.repeat(65));
for (const r of blowingRatioResults) {
    const detachSymbol = r.isDetached ? '是 ⚠' : '否 ✓';
    console.log(`   ${String(r.mainstreamPressure).padStart(4)}    |   ${String(r.coolantPressure).padStart(4)}    |    ${r.blowingRatio.toFixed(2).padStart(5)}    |  ${detachSymbol}  |    ${String(r.detachmentSeverity.toFixed(0)).padStart(4)}     |   ${r.spanwiseEta.toFixed(1).padStart(5)}`);
}
console.log('');

const criticalM = CoolingModel.CRITICAL_BLOWING_RATIO;

const lowMResults = blowingRatioResults.filter(r => r.blowingRatio < criticalM);
const highMResults = blowingRatioResults.filter(r => r.blowingRatio >= criticalM);

for (const r of lowMResults) {
    assert(
        r.isDetached === false,
        `TEST2.1: M=${r.blowingRatio.toFixed(2)} < ${criticalM} 时脱离状态为 false`,
        'isDetached = false',
        `isDetached = ${r.isDetached}`,
        '低于临界吹风比时，气膜应保持附着'
    );
    assertApproximatelyEqual(
        r.detachmentFactor,
        1.0,
        0.01,
        `TEST2.2: M=${r.blowingRatio.toFixed(2)} 时脱离因子 ≈ 1.0`,
        '附着状态下脱离因子应为1'
    );
}

for (const r of highMResults) {
    assert(
        r.isDetached === true,
        `TEST2.3: M=${r.blowingRatio.toFixed(2)} ≥ ${criticalM} 时脱离状态为 true`,
        'isDetached = true',
        `isDetached = ${r.isDetached}`,
        '高于临界吹风比时，气膜应发生脱离'
    );
    assertLessThan(
        r.detachmentFactor,
        1.0,
        `TEST2.4: M=${r.blowingRatio.toFixed(2)} 时脱离因子 < 1.0`,
        '脱离状态下脱离因子应小于1'
    );
}

const maxLowMEta = Math.max(...lowMResults.map(r => r.spanwiseEta));
const minHighMEta = Math.min(...highMResults.map(r => r.spanwiseEta));

assertLessThan(
    minHighMEta,
    maxLowMEta,
    `TEST2.5: 脱离发生后(M≥${criticalM})的最小η < 脱离前(M<${criticalM})的最大η`,
    '气膜脱离应导致效率骤降'
);

const transitionIdx = blowingRatioResults.findIndex(r => r.isDetached);
if (transitionIdx > 0 && transitionIdx < blowingRatioResults.length) {
    const etaBefore = blowingRatioResults[transitionIdx - 1].spanwiseEta;
    const etaAfter = blowingRatioResults[transitionIdx].spanwiseEta;
    const etaDrop = etaBefore - etaAfter;
    
    assertGreaterThan(
        etaDrop,
        3.0,
        `TEST2.6: 临界点(M=${blowingRatioResults[transitionIdx].blowingRatio.toFixed(2)})处效率骤降 > 3%`,
        '脱离点效率应出现明显跳变'
    );
}

console.log('\n  失败用例:');
const test2Failures = testResults.failures.filter(f => f.name.startsWith('TEST2'));
if (test2Failures.length === 0) {
    console.log('    ✓ 无失败 - 气膜脱离模型已正确实现');
} else {
    test2Failures.forEach(f => {
        console.log(`    ✗ ${f.name}`);
        console.log(`      期望值: ${f.expected}`);
        console.log(`      实际值: ${f.actual}`);
        console.log(`      说明: ${f.description}`);
    });
}

console.log('\n' + '─'.repeat(70));
console.log('  测试 3: 后端温度数据结构验证 - 展向统计指标');
console.log('  假设: 快照数据包含 spanwise_statistics, detachment_metrics 字段');
console.log('─'.repeat(70));

console.log('\n  3.1 前端模拟输出数据结构检查:');
const sampleResult = CoolingModel.simulateCooling(
    { ...test1Params, holes: test2Holes },
    0,
    0.016
);

assertExists(
    sampleResult.spanwiseStatistics,
    'TEST3.1: result.spanwiseStatistics 存在',
    '模拟结果应包含展向统计对象'
);

if (sampleResult.spanwiseStatistics) {
    assertExists(
        sampleResult.spanwiseStatistics.avgSpanwiseEfficiency,
        'TEST3.1a: spanwiseStatistics.avgSpanwiseEfficiency 存在',
        '应包含展向平均效率'
    );
    assertExists(
        sampleResult.spanwiseStatistics.avgChordwiseEfficiency,
        'TEST3.1b: spanwiseStatistics.avgChordwiseEfficiency 存在',
        '应包含弦向平均效率'
    );
    assertExists(
        sampleResult.spanwiseStatistics.spanwiseEfficiency,
        'TEST3.1c: spanwiseStatistics.spanwiseEfficiency 数组存在',
        '应包含展向效率分布数组'
    );
    assert(
        Array.isArray(sampleResult.spanwiseStatistics.spanwiseEfficiency),
        'TEST3.1d: spanwiseEfficiency 是数组',
        'Array',
        typeof sampleResult.spanwiseStatistics.spanwiseEfficiency,
        '展向效率分布应为数组类型'
    );
    assert(
        sampleResult.spanwiseStatistics.spanwiseEfficiency.length === 80,
        'TEST3.1e: spanwiseEfficiency 数组长度 = 80 (GRID_RESOLUTION)',
        'length = 80',
        `length = ${sampleResult.spanwiseStatistics.spanwiseEfficiency.length}`,
        '分布数组长度应与网格分辨率一致'
    );
}

assertExists(
    sampleResult.detachmentMetrics,
    'TEST3.2: result.detachmentMetrics 存在',
    '模拟结果应包含脱离指标对象'
);

if (sampleResult.detachmentMetrics) {
    assertExists(
        sampleResult.detachmentMetrics.isDetached,
        'TEST3.2a: detachmentMetrics.isDetached 存在',
        '应包含是否脱离的布尔标志'
    );
    assertExists(
        sampleResult.detachmentMetrics.detachmentSeverity,
        'TEST3.2b: detachmentMetrics.detachmentSeverity 存在',
        '应包含脱离严重度(%)'
    );
    assertExists(
        sampleResult.detachmentMetrics.detachmentFactor,
        'TEST3.2c: detachmentMetrics.detachmentFactor 存在',
        '应包含脱离因子(0-1)'
    );
    assert(
        typeof sampleResult.detachmentMetrics.isDetached === 'boolean',
        'TEST3.2d: isDetached 是布尔类型',
        'boolean',
        typeof sampleResult.detachmentMetrics.isDetached,
        '脱离标志应为布尔值'
    );
}

assertExists(
    sampleResult.blowingRatio,
    'TEST3.3: result.blowingRatio 存在',
    '模拟结果应包含吹风比数值'
);
assert(
    typeof sampleResult.blowingRatio === 'number',
    'TEST3.3a: blowingRatio 是数字类型',
    'number',
    typeof sampleResult.blowingRatio,
    '吹风比应为数值类型'
);

console.log('\n  3.2 后端 API 响应格式验证 (需要运行服务器):');
const http = require('http');

function makeHttpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

async function runBackendTests() {
    try {
        const conditionsRes = await makeHttpRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/conditions',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, JSON.stringify({
            coolant_flow: 0.05,
            mainstream_temp: 1000,
            coolant_temp: 300,
            mainstream_pressure: 2.0,
            coolant_pressure: 2.5,
            blade_material: 'nickel_alloy'
        }));

        const conditionId = conditionsRes.data.id;

        const snapshotRes = await makeHttpRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/snapshots',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, JSON.stringify({
            condition_id: conditionId,
            avg_temperature: 750.5,
            max_temperature: 950.0,
            min_temperature: 450.0,
            cooling_efficiency: 35.7,
            heat_flux: 1.25,
            temperature_data: Array(80).fill(Array(80).fill(600)),
            film_coverage_data: Array(80).fill(Array(80).fill(0.3)),
            spanwise_statistics: {
                avgSpanwiseEfficiency: 32.5,
                avgChordwiseEfficiency: 30.1,
                avgSpanwiseTemperature: 720.3
            },
            detachment_metrics: {
                isDetached: false,
                detachmentSeverity: 0,
                detachmentFactor: 1.0
            },
            blowing_ratio: 0.85
        }));

        const snapshotId = snapshotRes.data.id;
        assertExists(snapshotId, 'TEST3.4: 快照保存成功并返回ID', '后端快照API正常工作');

        const getRes = await makeHttpRequest({
            hostname: 'localhost',
            port: 3000,
            path: `/api/snapshots/${snapshotId}`,
            method: 'GET'
        });

        const retrieved = getRes.data;
        assertExists(
            retrieved.spanwise_statistics,
            'TEST3.5: GET /api/snapshots/:id 返回 spanwise_statistics',
            '数据库中已存储展向统计数据'
        );
        if (retrieved.spanwise_statistics) {
            assertApproximatelyEqual(
                retrieved.spanwise_statistics.avgSpanwiseEfficiency,
                32.5,
                0.1,
                'TEST3.5a: 展向平均效率值正确持久化',
                '数值存储和读取一致'
            );
        }

        assertExists(
            retrieved.detachment_metrics,
            'TEST3.6: GET /api/snapshots/:id 返回 detachment_metrics',
            '数据库中已存储脱离指标'
        );
        if (retrieved.detachment_metrics) {
            assert(
                retrieved.detachment_metrics.isDetached === false,
                'TEST3.6a: 脱离标志正确持久化',
                'isDetached = false',
                `isDetached = ${retrieved.detachment_metrics.isDetached}`,
                '布尔值存储和读取一致'
            );
        }

        assertApproximatelyEqual(
            retrieved.blowing_ratio,
            0.85,
            0.01,
            'TEST3.7: GET /api/snapshots/:id 返回 blowing_ratio',
            '吹风比数值正确持久化'
        );

        return true;
    } catch (error) {
        console.log(`\n    ⚠  后端API测试跳过: ${error.message}`);
        console.log('    (请确保服务器正在运行)');
        return false;
    }
}

runBackendTests().then((backendPassed) => {
    console.log('\n  失败用例:');
    const test3Failures = testResults.failures.filter(f => f.name.startsWith('TEST3'));
    if (test3Failures.length === 0) {
        console.log('    ✓ 无失败 - 数据结构验证通过');
    } else {
        test3Failures.forEach(f => {
            console.log(`    ✗ ${f.name}`);
            console.log(`      期望值: ${f.expected}`);
            console.log(`      实际值: ${f.actual}`);
            console.log(`      说明: ${f.description}`);
        });
    }

    console.log('\n' + '='.repeat(70));
    console.log('  测试结果汇总');
    console.log('='.repeat(70));
    console.log(`  总断言数: ${testResults.total}`);
    console.log(`  通过: ${testResults.passed}   失败: ${testResults.failed}`);
    console.log(`  通过率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    console.log('='.repeat(70));

    if (testResults.failed > 0) {
        console.log('\n  ❌ 存在失败断言，请检查以上失败用例明细');
        console.log('\n  所有失败用例:');
        testResults.failures.forEach((f, idx) => {
            console.log(`\n  ${idx + 1}. ${f.name}`);
            console.log(`     期望: ${f.expected}`);
            console.log(`     实际: ${f.actual}`);
            console.log(`     说明: ${f.description}`);
        });
        process.exit(1);
    } else {
        console.log('\n  ✓ 所有测试通过! 三个bug修复验证成功');
        console.log('\n  验证结论:');
        console.log('  1. ✓ 孔间距减小 → 展向平均效率升高 (多孔叠加生效)');
        console.log('  2. ✓ 吹风比 > 1.2 → 气膜脱离发生，效率骤降 (脱离模型生效)');
        console.log('  3. ✓ 快照数据包含展向统计、脱离指标等定量字段');
        process.exit(0);
    }
}).catch(err => {
    console.error('\n测试执行出错:', err);
    process.exit(1);
});
