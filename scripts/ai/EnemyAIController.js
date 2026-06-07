import { EnemyBlackboard } from './EnemyBlackboard.js';
import { resolveEnemyProfile } from './EnemyAIProfiles.js';
import { EnemyPerception } from './EnemyPerception.js';
import { EnemyDecision } from './EnemyDecision.js';
import { EnemyMovement } from './EnemyMovement.js';
import { EnemyCombat } from './EnemyCombat.js';
import { EnemyDebug } from './EnemyDebug.js';

export class EnemyAIController {
    constructor({
        enemy,
        player = null,
        profile = 'pirateScout',
        role,
        getAllies = null,
        obstacleProvider = null,
        lineOfSightProvider = null,
        projectileSpeed = 125
    }) {
        this.profile = resolveEnemyProfile(profile);
        this.blackboard = new EnemyBlackboard({
            enemy,
            player,
            profile: this.profile,
            role
        });
        this.debugTool = new EnemyDebug(this.blackboard);
        this.perception = new EnemyPerception(this.blackboard, { lineOfSightProvider });
        this.decision = new EnemyDecision(this.blackboard, this.debugTool);
        this.movement = new EnemyMovement(this.blackboard, { getAllies, obstacleProvider });
        this.combat = new EnemyCombat(this.blackboard, { projectileSpeed });
    }

    get debug() {
        return this.debugTool.enabled;
    }

    set debug(value) {
        this.debugTool.enabled = Boolean(value);
    }

    setPlayer(player) {
        this.blackboard.player = player;
    }

    setProfile(profile) {
        this.profile = resolveEnemyProfile(profile);
        this.blackboard.profile = this.profile;
    }

    setSafeZoneState({ isPlayerInSafeZone, center = null, radius = 0 }) {
        this.blackboard.isPlayerInSafeZone = Boolean(isPlayerInSafeZone);
        this.blackboard.safeZoneRadius = radius;

        if (center) {
            this.blackboard.safeZoneCenter.copy(center);
        }
    }

    update(delta, onFire = null) {
        this.perception.update(delta);
        this.decision.update(delta);
        this.movement.update(delta);
        this.combat.update(delta, onFire);
    }

    getDebugSnapshot() {
        return this.debugTool.getSnapshot();
    }
}
