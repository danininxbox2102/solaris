export class EnemyGroupCoordinator {
    constructor({ alertRadius = 900 } = {}) {
        this.alertRadius = alertRadius;
    }

    update(enemies) {
        for (const enemy of enemies) {
            const bb = enemy.ai?.blackboard;

            if (!bb) {
                continue;
            }

            bb.hasSharedAlert = false;
        }

        for (const spotter of enemies) {
            const spotterBb = spotter.ai?.blackboard;

            if (!spotterBb?.canSeePlayer || !spotterBb.hasLastKnownPlayerPosition) {
                continue;
            }

            for (const ally of enemies) {
                if (ally === spotter || !ally.isAlive) {
                    continue;
                }

                const allyBb = ally.ai?.blackboard;

                if (!allyBb || allyBb.canSeePlayer) {
                    continue;
                }

                const distanceSq = ally.object.position.distanceToSquared(spotter.object.position);

                if (distanceSq > this.alertRadius * this.alertRadius) {
                    continue;
                }

                allyBb.sharedAlertPosition.copy(spotterBb.lastKnownPlayerPosition);
                allyBb.hasSharedAlert = true;
            }
        }
    }
}
