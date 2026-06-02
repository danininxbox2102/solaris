import { Entity } from './Entity.js';

const FLAGMAN_SCALE = 0.2;
const FOLLOW_OFFSET_X = 400;
const SPAWN_Z_OFFSET = 900;
const SPAWN_DURATION = .6;
const DESPAWN_Z_OFFSET = -900;
const DESPAWN_DURATION = .6;

export class Flagman extends Entity {
    constructor({ object, target = null }) {
        super({
            name: 'BossFlagman',
            object,
            maxHealth: 100
        });

        this.target = target;
        this.zOffset = 0;
        this.animationElapsed = 0;
        this.animationDuration = 0;
        this.animationFromZ = 0;
        this.animationToZ = 0;
        this.animationEase = null;
        this.animationComplete = null;
        this.object.name = this.name;
        this.object.scale.setScalar(FLAGMAN_SCALE);
        this.object.rotation.y = Math.PI;
    }

    setTarget(target) {
        this.target = target;
    }

    spawn() {
        this.animateZOffset({
            from: SPAWN_Z_OFFSET,
            to: 0,
            duration: SPAWN_DURATION,
            ease: (progress) => 1 - Math.pow(1 - progress, 4)
        });
    }

    despawn(onComplete = null) {
        this.animateZOffset({
            from: this.zOffset,
            to: DESPAWN_Z_OFFSET,
            duration: DESPAWN_DURATION,
            ease: (progress) => Math.pow(progress, 4),
            onComplete
        });
    }

    animateZOffset({ from, to, duration, ease, onComplete = null }) {
        this.zOffset = from;
        this.animationElapsed = 0;
        this.animationDuration = duration;
        this.animationFromZ = from;
        this.animationToZ = to;
        this.animationEase = ease;
        this.animationComplete = onComplete;
        this.updatePosition();
    }

    update(delta = 0) {
        if (this.animationEase) {
            this.animationElapsed += delta;
            const progress = Math.min(1, this.animationElapsed / this.animationDuration);
            const easedProgress = this.animationEase(progress);

            this.zOffset = this.animationFromZ + (this.animationToZ - this.animationFromZ) * easedProgress;

            if (progress >= 1) {
                const onComplete = this.animationComplete;

                this.zOffset = this.animationToZ;
                this.animationEase = null;
                this.animationComplete = null;
                this.updatePosition();
                onComplete?.();
                return;
            }
        }

        this.updatePosition();
    }

    updatePosition() {
        if (!this.target?.object) {
            return;
        }

        const targetPosition = this.target.object.position;

        this.object.position.set(
            targetPosition.x + FOLLOW_OFFSET_X,
            targetPosition.y,
            targetPosition.z + this.zOffset
        );
    }

    dispose() {
        this.object.traverse((object) => {
            if (!object.isMesh) {
                return;
            }

            object.geometry?.dispose();

            if (Array.isArray(object.material)) {
                object.material.forEach((material) => material.dispose());
            } else {
                object.material?.dispose();
            }
        });
    }
}
