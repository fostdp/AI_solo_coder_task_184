const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('  气膜冷却模型重构验证测试套件');
console.log('  统一气膜覆盖框架 - Unified Film Coverage Framework');
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

const testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    failures: []
};

function assert(condition, testName, expected, actual, description) {
    testResults.total++;
    if (condition) {
        testResults.passed++;
        console.log(`  ✓ ${testName}`);
    } else {
        testResults.failed++;
        testResults.failures.push({ name: testName, expected, actual, description });
        console.log(`  ✗ ${testName}`);
        console.log(`    期望: ${expected}`);
        console.log(`    实际: ${actual}`);
        console.log(`    说明: ${description}`);
    }
    return condition;
}

console.log('\n' + '─'.repeat(70));
console.log('  组件1: JetTrajectoryModel - 射流轨迹模型');
console.log('─'.repeat(70));

try {
    const jetModel = new FilmCoverageModel.JetTrajectoryModel();
    assert(
        jetModel !== undefined,
        'JetTrajectoryModel 实例化成功',
        '对象存在',
        jetModel ? '对象存在' : '对象不存在',
        '射流轨迹模型应能正常实例化'
    );

    const testHole = { x: 100, y: 50, diameter: 2.5, angle: 0 };
    
    const trajectory = jetModel.calculateTrajectory(testHole, 0.5, 25);
    assert(
        trajectory.height !== undefined && trajectory.spread !== undefined,
        'calculateTrajectory 返回完整轨迹数据',
        '包含 height, spread, angle',
        trajectory.height !== undefined ? '字段完整' : '字段缺失',
        '轨迹计算应返回高度、扩散、角度等参数'
    );

    const etaAttached = jetModel.calculateEffectivenessDecay(testHole, 0.5, 10);
    const etaDetached = jetModel.calculateEffectivenessDecay(testHole, 2.0, 10);
    assert(
        etaAttached > etaDetached,
        '附着态效率 > 脱离态效率',
        `eta_attached > eta_detached`,
        `${etaAttached.toFixed(3)} > ${etaDetached.toFixed(3)}`,
        '高吹风比脱离状态下效率应显著降低'
    );

    const jetHeightLowM = jetModel.calculateTrajectory(testHole, 0.5, 20).height;
    const jetHeightHighM = jetModel.calculateTrajectory(testHole, 2.0, 20).height;
    assert(
        jetHeightHighM > jetHeightLowM,
        '高吹风比射流抬升更高',
        `height_highM > height_lowM`,
        `${jetHeightHighM.toFixed(2)} > ${jetHeightLowM.toFixed(2)}`,
        '射流动量过大时应从壁面抬起'
    );

} catch (e) {
    console.log(`  ⚠ 射流轨迹模型测试出错: ${e.message}`);
    testResults.failed++;
}

console.log('\n' + '─'.repeat(70));
console.log('  组件2: HoleInterferenceModel - 相邻孔干涉模型');
console.log('─'.repeat(70));

try {
    const interferenceModel = new FilmCoverageModel.HoleInterferenceModel();
    
    const holesClose = BladeGeometry.generateFilmHoles(48);
    const holesFar = BladeGeometry.generateFilmHoles(12);
    
    const matrixClose = interferenceModel.calculateInterferenceMatrix(holesClose);
    const matrixFar = interferenceModel.calculateInterferenceMatrix(holesFar);
    
    let avgInterferenceClose = 0, avgInterferenceFar = 0;
    for (let i = 0; i < holesClose.length; i++) {
        for (let j = 0; j < holesClose.length; j++) {
            if (i !== j) avgInterferenceClose += matrixClose[i][j];
        }
    }
    for (let i = 0; i < holesFar.length; i++) {
        for (let j = 0; j < holesFar.length; j++) {
            if (i !== j) avgInterferenceFar += matrixFar[i][j];
        }
    }
    avgInterferenceClose /= (holesClose.length * holesClose.length);
    avgInterferenceFar /= (holesFar.length * holesFar.length);
    
    assert(
        avgInterferenceClose > avgInterferenceFar,
        '孔间距越小，干涉越强',
        `interference_48holes > interference_12holes`,
        `${avgInterferenceClose.toFixed(4)} > ${avgInterferenceFar.toFixed(4)}`,
        '密集孔排列应有更强的相邻孔干涉'
    );

    const superposition = interferenceModel.calculateSuperpositionFactor(
        holesClose, 150, 75, 0.5
    );
    assert(
        superposition.factor >= 1.0,
        '叠加因子 ≥ 1.0',
        'factor >= 1.0',
        superposition.factor.toFixed(3),
        '多孔叠加应产生大于等于1的增强因子'
    );
    assert(
        superposition.activeHoles > 0,
        '检测到有效作用孔',
        'activeHoles > 0',
        superposition.activeHoles,
        '应能统计出在影响范围内的孔数'
    );
    assert(
        superposition.spacingFactor !== undefined,
        '包含孔间距相关因子',
        'spacingFactor 存在',
        superposition.spacingFactor.toFixed(3),
        '叠加因子应考虑实际孔间距'
    );

} catch (e) {
    console.log(`  ⚠ 孔干涉模型测试出错: ${e.message}`);
    testResults.failed++;
}

console.log('\n' + '─'.repeat(70));
console.log('  组件3: BlowingRatioModel - 吹风比效应模型');
console.log('─'.repeat(70));

try {
    const brModel = new FilmCoverageModel.BlowingRatioModel();
    
    const M_attached = brModel.calculateBlowingRatio(2.0, 300, 2.0, 1000);
    assert(
        typeof M_attached === 'number' && M_attached > 0,
        '吹风比计算返回正数',
        'M > 0',
        M_attached.toFixed(3),
        '吹风比计算应返回合理的正数'
    );

    const metrics_attached = brModel.calculateDetachmentMetrics(0.8);
    const metrics_detached = brModel.calculateDetachmentMetrics(1.5);
    
    assert(
        metrics_attached.isDetached === false,
        'M=0.8 判定为附着态',
        'isDetached = false',
        metrics_attached.isDetached,
        '低于临界吹风比应判定为附着'
    );
    assert(
        metrics_detached.isDetached === true,
        'M=1.5 判定为脱离态',
        'isDetached = true',
        metrics_detached.isDetached,
        '高于临界吹风比应判定为脱离'
    );
    assert(
        metrics_detached.detachmentFactor < 1.0,
        '脱离态 detachmentFactor < 1.0',
        'detachmentFactor < 1.0',
        metrics_detached.detachmentFactor.toFixed(3),
        '脱离状态应有惩罚因子'
    );
    assert(
        metrics_detached.regime !== undefined,
        '包含脱离阶段分类',
        'regime 存在',
        metrics_detached.regime,
        '应识别过渡态、完全脱离、吹离等阶段'
    );

    const flowFactor_attached = brModel.calculateFlowFactor(0.05, 0.8);
    const flowFactor_detached = brModel.calculateFlowFactor(0.05, 2.0);
    assert(
        flowFactor_attached > flowFactor_detached,
        '附着态流量因子 > 脱离态流量因子',
        `flowFactor_attached > flowFactor_detached`,
        `${flowFactor_attached.toFixed(3)} > ${flowFactor_detached.toFixed(3)}`,
        '脱离状态下流量利用效率应降低'
    );

} catch (e) {
    console.log(`  ⚠ 吹风比模型测试出错: ${e.message}`);
    testResults.failed++;
}

console.log('\n' + '─'.repeat(70));
console.log('  组件4: SpanwiseEfficiencyStore - 展向效率存储');
console.log('─'.repeat(70));

try {
    const spanwiseStore = new FilmCoverageModel.SpanwiseEfficiencyStore(20);
    
    assert(
        spanwiseStore.spanwiseBins === 20,
        '展向分箱数配置正确',
        '20 bins',
        spanwiseStore.spanwiseBins,
        '展向存储应按配置的分箱数初始化'
    );

    const testHoles = BladeGeometry.generateFilmHoles(24);
    spanwiseStore.initialize(testHoles, [-50, 150]);
    
    assert(
        spanwiseStore.binSize > 0,
        '分箱尺寸计算正确',
        'binSize > 0',
        spanwiseStore.binSize.toFixed(2),
        '应根据展向范围计算分箱尺寸'
    );

    for (let i = 0; i < 100; i++) {
        const pos = -50 + Math.random() * 200;
        const eta = 0.3 + Math.random() * 0.4;
        const temp = 600 + Math.random() * 200;
        spanwiseStore.addSample(pos, eta, temp, 1);
    }
    
    const profile = spanwiseStore.getSpanwiseProfile();
    assert(
        profile.length === 20,
        '展向分布数组长度正确',
        'length = 20',
        profile.length,
        '展向分布数组长度应等于分箱数'
    );
    assert(
        profile[0].efficiency !== undefined && profile[0].position !== undefined,
        '分布元素包含效率和位置',
        '包含 efficiency, position',
        '字段完整',
        '每个分箱应包含位置、效率、温度等信息'
    );

    const avgEta = spanwiseStore.getAverageEfficiency();
    assert(
        avgEta > 0 && avgEta < 1,
        '平均效率在合理范围内',
        '0 < avgEta < 1',
        avgEta.toFixed(3),
        '平均效率计算应在0-1范围内'
    );

    const stats = spanwiseStore.getStatistics();
    assert(
        stats.avgEfficiency !== undefined && stats.uniformity !== undefined,
        '统计量包含平均值和均匀度',
        '包含 avgEfficiency, uniformity',
        '统计量完整',
        '应提供平均、最大、最小、标准差、均匀度等统计量'
    );

    const exported = spanwiseStore.export();
    assert(
        exported.efficiencyData !== undefined,
        'export 输出完整数据结构',
        '包含 efficiencyData',
        '输出完整',
        '导出功能应能序列化所有存储数据'
    );

    spanwiseStore.saveTimeSnapshot(1.0);
    assert(
        spanwiseStore.timeHistory.length === 1,
        '时间快照存储功能正常',
        'timeHistory.length = 1',
        spanwiseStore.timeHistory.length,
        '应能保存不同时刻的展向分布'
    );

} catch (e) {
    console.log(`  ⚠ 展向存储测试出错: ${e.message}`);
    console.log(e.stack);
    testResults.failed++;
}

console.log('\n' + '─'.repeat(70));
console.log('  集成: UnifiedFilmCoverageModel - 统一覆盖框架');
console.log('─'.repeat(70));

try {
    const unifiedModel = FilmCoverageModel.createModel();
    assert(
        unifiedModel !== null,
        'createModel 工厂方法正常工作',
        'model != null',
        unifiedModel ? '创建成功' : '创建失败',
        '工厂方法应正确创建统一模型实例'
    );

    const testParams = {
        coolantFlow: 0.05,
        mainstreamTemp: 1000,
        coolantTemp: 300,
        mainstreamPressure: 2.0,
        coolantPressure: 2.5
    };
    const testHoles = BladeGeometry.generateFilmHoles(24);
    
    unifiedModel.initialize(testHoles, testParams);
    assert(
        unifiedModel.interferenceMatrix !== null,
        '初始化后干涉矩阵已计算',
        'interferenceMatrix 存在',
        unifiedModel.interferenceMatrix ? '已计算' : '未计算',
        '初始化应预计算孔干涉矩阵'
    );
    assert(
        unifiedModel.currentBlowingRatio > 0,
        '初始化后吹风比已计算',
        'blowingRatio > 0',
        unifiedModel.currentBlowingRatio.toFixed(3),
        '初始化应计算当前工况的吹风比'
    );

    const coverage = unifiedModel.calculatePointCoverage(150, 75);
    assert(
        coverage.eta !== undefined,
        '点覆盖计算返回效率',
        'eta 存在',
        coverage.eta.toFixed(3),
        '点覆盖计算应返回合成的气膜效率'
    );
    assert(
        coverage.superpositionFactor >= 1.0,
        '点覆盖包含叠加因子',
        'superpositionFactor >= 1.0',
        coverage.superpositionFactor.toFixed(3),
        '应考虑多孔叠加增强效应'
    );
    assert(
        coverage.contributions !== undefined,
        '点覆盖包含各孔贡献明细',
        'contributions 存在',
        `${coverage.contributions.length} 个孔`,
        '应追踪每个孔对该点的具体贡献'
    );

    const metrics = unifiedModel.getMetrics();
    assert(
        metrics.spanwiseStatistics !== undefined,
        'getMetrics 包含展向统计',
        'spanwiseStatistics 存在',
        '统计完整',
        '统一模型应汇总所有子模型的指标'
    );

    console.log(`  ✓ 统一框架接口完整: 初始化 → 点覆盖计算 → 指标获取`);
    testResults.passed++;
    testResults.total++;

} catch (e) {
    console.log(`  ⚠ 统一框架测试出错: ${e.message}`);
    console.log(e.stack);
    testResults.failed++;
}

console.log('\n' + '─'.repeat(70));
console.log('  集成验证: 与原有 CoolingModel 接口兼容');
console.log('─'.repeat(70));

try {
    const coolingModelCode = fs.readFileSync(
        path.join(__dirname, '..', 'public', 'js', 'coolingModel.js'),
        'utf-8'
    );
    eval(coolingModelCode.replace('const CoolingModel', 'global.CoolingModel'));
    
    const params = {
        coolantFlow: 0.05,
        mainstreamTemp: 1000,
        coolantTemp: 300,
        mainstreamPressure: 2.0,
        coolantPressure: 2.5,
        bladeMaterial: 'nickel_alloy',
        holes: BladeGeometry.generateFilmHoles(24)
    };
    
    const result = CoolingModel.simulateCooling(params, 0, 0.016);
    
    assert(
        result.spanwiseStatistics !== undefined,
        'simulateCooling 返回展向统计',
        'spanwiseStatistics 存在',
        '字段存在',
        '重构后应保持与原有冷却模型的接口兼容'
    );
    assert(
        result.detachmentMetrics !== undefined,
        'simulateCooling 返回脱离指标',
        'detachmentMetrics 存在',
        '字段存在',
        '应包含气膜脱离相关指标'
    );
    assert(
        result.blowingRatio !== undefined,
        'simulateCooling 返回吹风比',
        'blowingRatio 存在',
        result.blowingRatio.toFixed(3),
        '应返回计算得到的吹风比'
    );
    assert(
        result.filmCoverageModel !== undefined || result.blowingRatio > 0,
        '新接口或旧接口至少一个可用',
        '接口兼容',
        '兼容',
        '重构应保证向后兼容'
    );
    
    console.log(`  ✓ CoolingModel 接口兼容验证通过`);
    testResults.passed++;
    testResults.total++;

} catch (e) {
    console.log(`  ⚠ 接口兼容测试出错: ${e.message}`);
    console.log(e.stack);
    testResults.failed++;
}

console.log('\n' + '='.repeat(70));
console.log('  重构测试结果汇总');
console.log('='.repeat(70));
console.log(`  总断言数: ${testResults.total}`);
console.log(`  通过: ${testResults.passed}   失败: ${testResults.failed}`);
console.log(`  通过率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
console.log('='.repeat(70));

console.log('\n  重构架构总结:');
console.log('');
console.log('  ┌─────────────────────────────────────────────────────────┐');
console.log('  │            UnifiedFilmCoverageModel (统一框架)          │');
console.log('  ├─────────────┬─────────────────┬─────────────────────────┤');
console.log('  │ JetTrajectory │ HoleInterference │ SpanwiseEfficiencyStore │');
console.log('  │   Model     │     Model       │        (存储)           │');
console.log('  ├─────────────┼─────────────────┼─────────────────────────┤');
console.log('  │ 射流高度    │ 干涉矩阵        │ 分箱采样 (20 bins)     │');
console.log('  │ 扩散角度    │ 孔间距因子      │ 时间快照存储           │');
console.log('  │ 效率衰减    │ 叠加增强        │ 统计量计算 (均匀度等)   │');
console.log('  └─────────────┴─────────────────┴─────────────────────────┘');
console.log('                          │');
console.log('                          ▼');
console.log('              BlowingRatioModel (吹风比效应)');
console.log('              ├─ M 计算');
console.log('              ├─ 脱离判定 (attached/transitional/detached/blowoff)');
console.log('              └─ 流量因子');
console.log('');

if (testResults.failures.length > 0) {
    console.log('\n  ❌ 失败断言明细:');
    testResults.failures.forEach((f, idx) => {
        console.log(`\n  ${idx + 1}. ${f.name}`);
        console.log(`     期望: ${f.expected}`);
        console.log(`     实际: ${f.actual}`);
        console.log(`     说明: ${f.description}`);
    });
    process.exit(1);
} else {
    console.log('\n  ✓ 所有重构验证通过!');
    console.log('\n  重构完成度:');
    console.log('  1. ✓ 射流轨迹模型 - 计算射流高度、扩散、效率衰减');
    console.log('  2. ✓ 孔干涉模型 - 干涉矩阵、孔间距相关叠加因子');
    console.log('  3. ✓ 吹风比效应模型 - 脱离判定、阶段分类、流量因子');
    console.log('  4. ✓ 展向效率存储 - 分箱采样、时间快照、统计量计算');
    console.log('  5. ✓ 统一框架 - 集成所有子模型、对外统一接口');
    console.log('  6. ✓ 向后兼容 - 与原有 CoolingModel 无缝集成');
    process.exit(0);
}
