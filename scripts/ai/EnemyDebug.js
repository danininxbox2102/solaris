export class EnemyDebug {
    constructor(blackboard) {
        this.blackboard = blackboard;
        this.enabled = false;
    }

    onStateChanged(previousState, nextState) {
        if (!this.enabled) {
            return;
        }

        const profileId = this.blackboard.profile.id;
        console.debug(`[EnemyAI] ${profileId}: ${previousState} -> ${nextState}`);
    }

    getSnapshot() {
        const bb = this.blackboard;

        return {
            state: bb.currentState,
            distanceToPlayer: bb.distanceToPlayer,
            targetPosition: bb.hasTargetPosition ? bb.targetPosition : null,
            lastKnownPlayerPosition: bb.hasLastKnownPlayerPosition ? bb.lastKnownPlayerPosition : null,
            detectionRange: bb.profile.detectionRange,
            preferredDistance: bb.profile.preferredDistance,
            attackRange: bb.profile.attackRange
        };
    }
}
