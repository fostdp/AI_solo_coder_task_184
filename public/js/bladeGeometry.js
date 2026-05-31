const BladeGeometry = (function() {
    const CHORD = 300;
    const STAGGER = 30;
    const MAX_THICKNESS = 60;
    
    function naca4Digit(m, p, t, x) {
        const c = 1;
        const yt = (t * c / 0.2) * (
            0.2969 * Math.sqrt(x / c) -
            0.1260 * (x / c) -
            0.3516 * Math.pow(x / c, 2) +
            0.2843 * Math.pow(x / c, 3) -
            0.1015 * Math.pow(x / c, 4)
        );
        
        let yc, dyc_dx;
        if (x < p * c) {
            yc = (m / Math.pow(p, 2)) * (2 * p * (x / c) - Math.pow(x / c, 2));
            dyc_dx = (2 * m / Math.pow(p, 2)) * (p - x / c);
        } else {
            yc = (m / Math.pow(1 - p, 2)) * ((1 - 2 * p) + 2 * p * (x / c) - Math.pow(x / c, 2));
            dyc_dx = (2 * m / Math.pow(1 - p, 2)) * (p - x / c);
        }
        
        const theta = Math.atan(dyc_dx);
        const xu = x - yt * Math.sin(theta);
        const yu = yc + yt * Math.cos(theta);
        const xl = x + yt * Math.sin(theta);
        const yl = yc - yt * Math.cos(theta);
        
        return { xu, yu, xl, yl, yc, theta };
    }
    
    function generateBladeProfile() {
        const m = 0.02;
        const p = 0.4;
        const t = 0.12;
        
        const upperSurface = [];
        const lowerSurface = [];
        
        for (let i = 0; i <= 100; i++) {
            const x = i / 100;
            const point = naca4Digit(m, p, t, x);
            
            const xScaled = x * CHORD;
            upperSurface.push({
                x: xScaled * Math.cos(STAGGER * Math.PI / 180) - point.yu * MAX_THICKNESS * Math.sin(STAGGER * Math.PI / 180),
                y: xScaled * Math.sin(STAGGER * Math.PI / 180) + point.yu * MAX_THICKNESS * Math.cos(STAGGER * Math.PI / 180)
            });
            lowerSurface.push({
                x: xScaled * Math.cos(STAGGER * Math.PI / 180) - point.yl * MAX_THICKNESS * Math.sin(STAGGER * Math.PI / 180),
                y: xScaled * Math.sin(STAGGER * Math.PI / 180) + point.yl * MAX_THICKNESS * Math.cos(STAGGER * Math.PI / 180)
            });
        }
        
        return { upperSurface, lowerSurface };
    }
    
    function generateFilmHoles(count) {
        const holes = [];
        const profile = generateBladeProfile();
        
        const suctionSideHoles = Math.floor(count * 0.6);
        const pressureSideHoles = count - suctionSideHoles;
        
        for (let i = 0; i < suctionSideHoles; i++) {
            const t = (i + 1) / (suctionSideHoles + 1);
            const idx = Math.floor(t * (profile.upperSurface.length - 1));
            const point = profile.upperSurface[idx];
            const nextPoint = profile.upperSurface[Math.min(idx + 1, profile.upperSurface.length - 1)];
            
            const dx = nextPoint.x - point.x;
            const dy = nextPoint.y - point.y;
            const angle = Math.atan2(dy, dx) + Math.PI / 2;
            
            holes.push({
                x: point.x,
                y: point.y,
                diameter: 2 + Math.random() * 1.5,
                angle: angle,
                side: 'suction'
            });
        }
        
        for (let i = 0; i < pressureSideHoles; i++) {
            const t = (i + 1) / (pressureSideHoles + 1);
            const idx = Math.floor(t * (profile.lowerSurface.length - 1));
            const point = profile.lowerSurface[idx];
            const nextPoint = profile.lowerSurface[Math.min(idx + 1, profile.lowerSurface.length - 1)];
            
            const dx = nextPoint.x - point.x;
            const dy = nextPoint.y - point.y;
            const angle = Math.atan2(dy, dx) - Math.PI / 2;
            
            holes.push({
                x: point.x,
                y: point.y,
                diameter: 2 + Math.random() * 1.5,
                angle: angle,
                side: 'pressure'
            });
        }
        
        return holes;
    }
    
    function generateInternalChannels() {
        const channels = [];
        const staggerRad = STAGGER * Math.PI / 180;
        
        const numChannels = 5;
        const startX = 50;
        const endX = CHORD - 30;
        const channelSpacing = (endX - startX) / (numChannels - 1);
        
        for (let i = 0; i < numChannels; i++) {
            const xCenter = startX + i * channelSpacing;
            const x1 = xCenter * Math.cos(staggerRad) - 10 * Math.sin(staggerRad);
            const y1 = xCenter * Math.sin(staggerRad) + 10 * Math.cos(staggerRad);
            const x2 = xCenter * Math.cos(staggerRad) + 10 * Math.sin(staggerRad);
            const y2 = xCenter * Math.sin(staggerRad) - 10 * Math.cos(staggerRad);
            
            channels.push({
                x1, y1, x2, y2,
                width: 8,
                length: MAX_THICKNESS * 0.6
            });
        }
        
        return channels;
    }
    
    function getBounds() {
        return {
            minX: -50,
            maxX: CHORD + 100,
            minY: -MAX_THICKNESS,
            maxY: MAX_THICKNESS * 2.5
        };
    }
    
    return {
        generateBladeProfile,
        generateFilmHoles,
        generateInternalChannels,
        getBounds,
        CHORD,
        MAX_THICKNESS
    };
})();
