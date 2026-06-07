import * as THREE from 'three';
import { EnemyRole, EnemyState } from './EnemyAIProfiles.js';

export class EnemyBlackboard {
    constructor({ enemy, player = null, profile, role = EnemyRole.Attacker }) {
        this.enemy = enemy;
        this.player = player;
        this.profile = profile;
        this.role = role;

        this.currentState = EnemyState.Patrol;
        this.previousState = null;
        this.spawnPosition = enemy.object.position.clone();
        this.lastKnownPlayerPosition = new THREE.Vector3();
        this.hasLastKnownPlayerPosition = false;
        this.targetPosition = new THREE.Vector3();
        this.hasTargetPosition = false;
        this.patrolTarget = new THREE.Vector3();
        this.searchTarget = new THREE.Vector3();

        this.distanceToPlayer = Infinity;
        this.canSeePlayer = false;
        this.hasLineOfSight = true;
        this.stateTime = 0;
        this.timeSincePlayerSeen = Infinity;
        this.healthPercent = 1;
        this.desiredVelocity = new THREE.Vector3();
        this.desiredLookTarget = new THREE.Vector3();
        this.hasDesiredLookTarget = false;
        this.alertLevel = null;
        this.isPlayerInSafeZone = false;
        this.safeZoneCenter = new THREE.Vector3();
        this.safeZoneRadius = 0;
        this.sharedAlertPosition = new THREE.Vector3();
        this.hasSharedAlert = false;
        this.orbitDirection = enemy.id % 2 === 0 ? -1 : 1;
        this.attackRunTime = 0;
        this.searchTime = 0;
    }

    setState(nextState) {
        if (this.currentState === nextState) {
            return false;
        }

        this.previousState = this.currentState;
        this.currentState = nextState;
        this.stateTime = 0;

        if (nextState === EnemyState.AttackRun) {
            this.attackRunTime = 0;
        }

        if (nextState === EnemyState.Search) {
            this.searchTime = 0;
        }

        return true;
    }
}
