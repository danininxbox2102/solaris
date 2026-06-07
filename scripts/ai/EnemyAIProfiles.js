export const EnemyRole = Object.freeze({
    Attacker: 'Attacker',
    Flanker: 'Flanker',
    Interceptor: 'Interceptor',
    Defender: 'Defender'
});

export const EnemyState = Object.freeze({
    Idle: 'Idle',
    Patrol: 'Patrol',
    Investigate: 'Investigate',
    Chase: 'Chase',
    AttackRun: 'AttackRun',
    OrbitStrafe: 'OrbitStrafe',
    Evade: 'Evade',
    Retreat: 'Retreat',
    Search: 'Search',
    ReturnToZone: 'ReturnToZone'
});

export const AlertLevel = Object.freeze({
    Safe: 'Safe',
    Suspicious: 'Suspicious',
    Warning: 'Warning',
    Hostile: 'Hostile',
    Lockdown: 'Lockdown'
});

export const enemyProfiles = Object.freeze({
    pirateScout: Object.freeze({
        id: 'pirateScout',
        maxSpeed: 90,
        acceleration: 45,
        turnRate: 3.5,
        detectionRange: 1200,
        fieldOfView: Math.PI * 0.92,
        attackRange: 700,
        preferredDistance: 450,
        minDistance: 180,
        aggression: 0.7,
        accuracy: 0.45,
        evasion: 0.85,
        burstDuration: 0.8,
        burstCooldown: 1.6,
        fireInterval: 0.24,
        retreatHealthPercent: 0.2,
        patrolRadius: 900,
        maxChaseDistance: 1800,
        separationRadius: 90
    }),

    pirateFighter: Object.freeze({
        id: 'pirateFighter',
        maxSpeed: 70,
        acceleration: 35,
        turnRate: 2.6,
        detectionRange: 1400,
        fieldOfView: Math.PI * 0.95,
        attackRange: 800,
        preferredDistance: 550,
        minDistance: 220,
        aggression: 0.85,
        accuracy: 0.6,
        evasion: 0.55,
        burstDuration: 1.2,
        burstCooldown: 1.4,
        fireInterval: 0.28,
        retreatHealthPercent: 0.15,
        patrolRadius: 1000,
        maxChaseDistance: 2200,
        separationRadius: 110
    }),

    defenseDrone: Object.freeze({
        id: 'defenseDrone',
        maxSpeed: 55,
        acceleration: 30,
        turnRate: 3.0,
        detectionRange: 1000,
        fieldOfView: Math.PI,
        attackRange: 650,
        preferredDistance: 420,
        minDistance: 160,
        aggression: 0.9,
        accuracy: 0.5,
        evasion: 0.35,
        burstDuration: 1.0,
        burstCooldown: 1.2,
        fireInterval: 0.26,
        retreatHealthPercent: 0.0,
        patrolRadius: 600,
        maxChaseDistance: 900,
        separationRadius: 80
    })
});

export function resolveEnemyProfile(profile = 'pirateScout') {
    if (typeof profile === 'string') {
        return enemyProfiles[profile] ?? enemyProfiles.pirateScout;
    }

    const base = enemyProfiles[profile?.id] ?? enemyProfiles.pirateScout;

    return Object.freeze({
        ...base,
        ...profile,
        id: profile?.id ?? base.id
    });
}
