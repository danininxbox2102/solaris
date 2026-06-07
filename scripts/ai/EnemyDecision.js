import * as THREE from 'three';
import { EnemyRole, EnemyState } from './EnemyAIProfiles.js';

export class EnemyDecision {
    constructor(blackboard, debug) {
        this.blackboard = blackboard;
        this.debug = debug;
    }

    update(delta) {
        const bb = this.blackboard;

        bb.stateTime += delta;

        const nextState = this.getNextState();

        if (bb.setState(nextState)) {
            this.debug.onStateChanged(bb.previousState, bb.currentState);
        }
    }

    getNextState() {
        const bb = this.blackboard;
        const profile = bb.profile;
        const distanceFromSpawn = bb.enemy.object.position.distanceTo(bb.spawnPosition);

        if (!bb.enemy.isAlive) {
            return EnemyState.Idle;
        }

        if (bb.isPlayerInSafeZone) {
            bb.canSeePlayer = false;
            bb.hasSharedAlert = false;
            bb.hasLastKnownPlayerPosition = false;
            bb.timeSincePlayerSeen = Infinity;

            const safeDistance = bb.safeZoneRadius > 0
                ? bb.enemy.object.position.distanceTo(bb.safeZoneCenter)
                : Infinity;

            if (
                distanceFromSpawn > Math.max(80, profile.patrolRadius * 0.18) ||
                safeDistance < bb.safeZoneRadius * 1.75
            ) {
                return EnemyState.ReturnToZone;
            }

            return EnemyState.Patrol;
        }

        if (bb.role === EnemyRole.Defender && distanceFromSpawn > profile.maxChaseDistance) {
            return EnemyState.ReturnToZone;
        }

        if (distanceFromSpawn > profile.maxChaseDistance * 1.12) {
            return EnemyState.ReturnToZone;
        }

        if (bb.healthPercent <= profile.retreatHealthPercent && profile.retreatHealthPercent > 0) {
            return EnemyState.Retreat;
        }

        if (bb.canSeePlayer) {
            if (bb.distanceToPlayer < profile.minDistance) {
                return EnemyState.Evade;
            }

            if (bb.currentState === EnemyState.AttackRun && bb.stateTime < profile.burstDuration) {
                return EnemyState.AttackRun;
            }

            if (bb.distanceToPlayer <= profile.attackRange) {
                if (bb.currentState === EnemyState.AttackRun) {
                    return EnemyState.OrbitStrafe;
                }

                if (
                    bb.currentState === EnemyState.OrbitStrafe &&
                    bb.stateTime < Math.max(0.7, profile.burstCooldown * (1.15 - profile.aggression))
                ) {
                    return EnemyState.OrbitStrafe;
                }

                if (bb.stateTime > 0.45 || bb.currentState === EnemyState.Chase) {
                    return EnemyState.AttackRun;
                }

                return EnemyState.OrbitStrafe;
            }

            return EnemyState.Chase;
        }

        if (bb.hasSharedAlert) {
            return EnemyState.Investigate;
        }

        if (bb.currentState === EnemyState.Search && bb.searchTime > 5.5) {
            return EnemyState.ReturnToZone;
        }

        if (bb.currentState === EnemyState.Investigate && bb.stateTime > 4) {
            return EnemyState.ReturnToZone;
        }

        if (bb.hasLastKnownPlayerPosition && bb.timeSincePlayerSeen < 4.5) {
            return EnemyState.Search;
        }

        if (
            bb.currentState === EnemyState.ReturnToZone &&
            distanceFromSpawn > Math.max(80, profile.patrolRadius * 0.18)
        ) {
            return EnemyState.ReturnToZone;
        }

        if (bb.currentState === EnemyState.Retreat && bb.stateTime < 2.5) {
            return EnemyState.Retreat;
        }

        return EnemyState.Patrol;
    }
}
