import * as THREE from 'three';

const COLLISION_BOUNCE = 0.35;
const COLLISION_MIN_BOUNCE_SPEED = 1.5;
const COLLISION_SKIN = 0.03;

export class StationCollisionSystem {
    constructor() {
        this.playerShip = null;
        this.stationHitbox = null;
        this.stationHitboxTriangles = [];
        this.shipHitboxSphere = new THREE.Sphere();
        this.shipCollisionRadius = 0;
        this.shipCollisionCenter = new THREE.Vector3();
        this.shipCollisionPoints = [];
        this.shipCollisionPointRadius = 0;
        this.collisionCheckPosition = new THREE.Vector3();
        this.collisionStepPosition = new THREE.Vector3();
        this.collisionStepQuaternion = new THREE.Quaternion();
        this.collisionPointWorld = new THREE.Vector3();
        this.collisionClosestPoint = new THREE.Vector3();
        this.collisionNormal = new THREE.Vector3();
        this.collisionEdgeTangent = new THREE.Vector3();
        this.collisionTriangleNormal = new THREE.Vector3();
        this.collisionMovement = new THREE.Vector3();
        this.collisionSlideDelta = new THREE.Vector3();
        this.collisionSlidePosition = new THREE.Vector3();
        this.collisionSlideVelocity = new THREE.Vector3();
        this.collisionOriginalVelocity = new THREE.Vector3();
        this.collisionBestSlidePosition = new THREE.Vector3();
        this.collisionCandidateDelta = new THREE.Vector3();
        this.collisionCandidateNormal = new THREE.Vector3();
        this.collisionBestSlideNormal = new THREE.Vector3();
        this.collisionEdgeA = new THREE.Vector3();
        this.collisionEdgeB = new THREE.Vector3();
        this.collisionEdgeC = new THREE.Vector3();
        this.collisionRay = new THREE.Ray(
            new THREE.Vector3(),
            new THREE.Vector3(0.731, 0.317, 0.604).normalize()
        );
        this.collisionRayHit = new THREE.Vector3();
        this.collisionRayDistances = [];
    }

    configure({ playerShip, stationHitbox, stationMeshes, shipMeshes }) {
        this.playerShip = playerShip;
        this.stationHitbox = stationHitbox;
        this.stationHitboxTriangles = this.createStaticCollisionTriangles(stationMeshes);
        this.createShipCollisionSphere(shipMeshes);
    }

    collectCollisionMeshes(root) {
        const meshes = [];

        root.traverse((object) => {
            if (object.isMesh) {
                meshes.push(object);
            }
        });

        return meshes;
    }

    getPlayerCollisionSphere(target) {
        if (!this.playerShip || this.shipCollisionRadius === 0) {
            return null;
        }

        this.playerShip.object.updateMatrixWorld(true);
        target.center.copy(this.shipCollisionCenter)
            .applyMatrix4(this.playerShip.object.matrixWorld);
        target.radius = this.shipCollisionRadius;

        return target;
    }

    createStaticCollisionTriangles(meshes) {
        this.stationHitbox.updateMatrixWorld(true);
        const triangles = [];
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        const c = new THREE.Vector3();

        for (const mesh of meshes) {
            const geometry = mesh.geometry;
            const position = geometry.attributes.position;
            const index = geometry.index;

            if (!position) {
                continue;
            }

            mesh.updateMatrixWorld(true);

            if (index) {
                for (let i = 0; i < index.count; i += 3) {
                    a.fromBufferAttribute(position, index.getX(i)).applyMatrix4(mesh.matrixWorld);
                    b.fromBufferAttribute(position, index.getX(i + 1)).applyMatrix4(mesh.matrixWorld);
                    c.fromBufferAttribute(position, index.getX(i + 2)).applyMatrix4(mesh.matrixWorld);
                    triangles.push(new THREE.Triangle(a.clone(), b.clone(), c.clone()));
                }
            } else {
                for (let i = 0; i < position.count; i += 3) {
                    a.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
                    b.fromBufferAttribute(position, i + 1).applyMatrix4(mesh.matrixWorld);
                    c.fromBufferAttribute(position, i + 2).applyMatrix4(mesh.matrixWorld);
                    triangles.push(new THREE.Triangle(a.clone(), b.clone(), c.clone()));
                }
            }
        }

        return triangles;
    }

    createShipCollisionSphere(meshes) {
        const box = new THREE.Box3();
        const meshBox = new THREE.Box3();
        const sphere = new THREE.Sphere();

        this.playerShip.object.updateMatrixWorld(true);
        for (const mesh of meshes) {
            meshBox.setFromObject(mesh);
            box.union(meshBox);
        }

        box.getBoundingSphere(sphere);
        this.shipCollisionRadius = sphere.radius;
        this.shipCollisionCenter.copy(sphere.center);
        this.playerShip.object.worldToLocal(this.shipCollisionCenter);
        this.shipCollisionPointRadius = Math.max(0.1, this.shipCollisionRadius * 0.08);
        this.shipCollisionPoints = this.createShipCollisionPoints(meshes);
    }

    createShipCollisionPoints(meshes) {
        const points = [];
        const point = new THREE.Vector3();
        const maxPointsPerMesh = 140;

        this.playerShip.object.updateMatrixWorld(true);

        for (const mesh of meshes) {
            const position = mesh.geometry.attributes.position;

            if (!position) {
                continue;
            }

            mesh.updateMatrixWorld(true);

            const step = Math.max(1, Math.floor(position.count / maxPointsPerMesh));

            for (let i = 0; i < position.count; i += step) {
                point.fromBufferAttribute(position, i);
                mesh.localToWorld(point);
                this.playerShip.object.worldToLocal(point);
                points.push(point.clone());
            }
        }

        points.push(this.shipCollisionCenter.clone());

        return points;
    }

    resolve(previousPosition, previousQuaternion, delta) {
        if (
            this.stationHitboxTriangles.length === 0 ||
            this.shipCollisionRadius === 0
        ) {
            return;
        }

        this.playerShip.object.updateMatrixWorld(true);

        const currentPosition = this.playerShip.object.position.clone();
        const currentQuaternion = this.playerShip.object.quaternion.clone();
        this.collisionOriginalVelocity.copy(this.playerShip.velocity);
        this.collisionMovement.subVectors(currentPosition, previousPosition);

        if (this.hasPlayerStationCollisionAt(previousPosition, previousQuaternion)) {
            return;
        }

        if (!this.hasPlayerStationCollisionBetween(
            previousPosition,
            currentPosition,
            previousQuaternion,
            currentQuaternion
        )) {
            return;
        }

        const collisionNormal = this.findPlayerStationCollisionNormal(this.collisionMovement);
        const nextQuaternion = this.hasPlayerStationCollisionAt(previousPosition, currentQuaternion)
            ? previousQuaternion
            : currentQuaternion;

        this.collisionSlideVelocity.copy(this.playerShip.velocity);
        this.projectVectorOnCollisionPlane(this.collisionSlideVelocity, collisionNormal);

        this.collisionSlideDelta.copy(this.collisionMovement);
        this.projectVectorOnCollisionPlane(this.collisionSlideDelta, collisionNormal);

        const slidePosition = this.findSlidePosition(
            previousPosition,
            this.collisionSlideDelta,
            previousQuaternion,
            nextQuaternion
        );
        const usedEdgeSlide = slidePosition.distanceToSquared(previousPosition) < 0.0001 &&
            this.collisionEdgeTangent.lengthSq() > 0;

        if (usedEdgeSlide) {
            const edgeAmount = this.collisionMovement.dot(this.collisionEdgeTangent);

            this.collisionSlideDelta.copy(this.collisionEdgeTangent).multiplyScalar(edgeAmount);
            slidePosition.copy(this.findSlidePosition(
                previousPosition,
                this.collisionSlideDelta,
                previousQuaternion,
                nextQuaternion
            ));

            this.collisionSlideVelocity.copy(this.collisionEdgeTangent)
                .multiplyScalar(this.playerShip.velocity.dot(this.collisionEdgeTangent));
        }

        if (slidePosition.distanceToSquared(previousPosition) < 0.0001) {
            const nearbySlidePosition = this.findNearbyPlaneSlidePosition(
                previousPosition,
                previousQuaternion,
                nextQuaternion
            );

            if (nearbySlidePosition.distanceToSquared(previousPosition) >= 0.0001) {
                slidePosition.copy(nearbySlidePosition);
                this.collisionSlideVelocity.copy(this.playerShip.velocity);
                this.projectVectorOnCollisionPlane(this.collisionSlideVelocity, this.collisionBestSlideNormal);
            }
        }

        this.playerShip.object.position.copy(slidePosition);
        this.playerShip.object.quaternion.copy(nextQuaternion);

        if (nextQuaternion === previousQuaternion) {
            this.playerShip.rollVelocity = 0;
        }

        if (delta > 0 && slidePosition.distanceToSquared(previousPosition) < 0.0001) {
            this.applyCollisionBounce(collisionNormal, previousPosition);
        } else {
            this.playerShip.velocity.copy(this.collisionSlideVelocity);
        }

        this.playerShip.object.updateMatrixWorld(true);
    }

    applyCollisionBounce(normal, previousPosition) {
        const normalSpeed = this.collisionOriginalVelocity.dot(normal);

        this.playerShip.object.position.copy(previousPosition)
            .addScaledVector(normal, COLLISION_SKIN);
        this.playerShip.velocity.copy(this.collisionOriginalVelocity);

        if (normalSpeed < -COLLISION_MIN_BOUNCE_SPEED) {
            this.playerShip.velocity.addScaledVector(
                normal,
                -(1 + COLLISION_BOUNCE) * normalSpeed
            );
            return;
        }

        this.projectVectorOnCollisionPlane(this.playerShip.velocity, normal);
    }

    findSlidePosition(from, slideDelta, fromQuaternion, toQuaternion) {
        const attempts = 5;

        for (let i = 0; i < attempts; i++) {
            const scale = 1 - i / attempts;

            this.collisionSlidePosition.copy(from).addScaledVector(slideDelta, scale);

            if (!this.hasPlayerStationCollisionBetween(
                from,
                this.collisionSlidePosition,
                fromQuaternion,
                toQuaternion
            )) {
                return this.collisionSlidePosition.clone();
            }
        }

        return from.clone();
    }

    findNearbyPlaneSlidePosition(from, fromQuaternion, toQuaternion) {
        let bestDistanceSq = 0;

        this.collisionBestSlidePosition.copy(from);
        this.collisionBestSlideNormal.set(0, 0, 0);
        this.shipHitboxSphere.center.copy(this.shipCollisionCenter)
            .applyMatrix4(this.playerShip.object.matrixWorld);

        bestDistanceSq = this.findNearbyPlaneSlideForPoint(
            this.shipHitboxSphere.center,
            this.shipCollisionRadius,
            from,
            fromQuaternion,
            toQuaternion,
            bestDistanceSq
        );

        for (const point of this.shipCollisionPoints) {
            this.collisionPointWorld.copy(point).applyMatrix4(this.playerShip.object.matrixWorld);
            bestDistanceSq = this.findNearbyPlaneSlideForPoint(
                this.collisionPointWorld,
                this.shipCollisionPointRadius,
                from,
                fromQuaternion,
                toQuaternion,
                bestDistanceSq
            );
        }

        return this.collisionBestSlidePosition.clone();
    }

    findNearbyPlaneSlideForPoint(point, radius, from, fromQuaternion, toQuaternion, bestDistanceSq) {
        const radiusSq = radius * radius;

        for (const triangle of this.stationHitboxTriangles) {
            triangle.closestPointToPoint(point, this.collisionClosestPoint);

            if (this.collisionClosestPoint.distanceToSquared(point) > radiusSq) {
                continue;
            }

            triangle.getNormal(this.collisionCandidateNormal);

            if (this.collisionCandidateNormal.lengthSq() === 0) {
                continue;
            }

            this.collisionCandidateNormal.normalize();

            if (this.collisionCandidateNormal.dot(this.collisionMovement) > 0) {
                this.collisionCandidateNormal.negate();
            }

            this.collisionCandidateDelta.copy(this.collisionMovement);
            this.projectVectorOnCollisionPlane(this.collisionCandidateDelta, this.collisionCandidateNormal);

            if (this.collisionCandidateDelta.lengthSq() < 0.0001) {
                continue;
            }

            const candidatePosition = this.findSlidePosition(
                from,
                this.collisionCandidateDelta,
                fromQuaternion,
                toQuaternion
            );
            const candidateDistanceSq = candidatePosition.distanceToSquared(from);

            if (candidateDistanceSq > bestDistanceSq) {
                bestDistanceSq = candidateDistanceSq;
                this.collisionBestSlidePosition.copy(candidatePosition);
                this.collisionBestSlideNormal.copy(this.collisionCandidateNormal);
            }
        }

        return bestDistanceSq;
    }

    projectVectorOnCollisionPlane(vector, normal) {
        const intoSurface = vector.dot(normal);

        if (intoSurface < 0) {
            vector.addScaledVector(normal, -intoSurface);
        }
    }

    findPlayerStationCollisionNormal(movement) {
        let bestDistanceSq = Infinity;

        this.collisionNormal.set(0, 0, 0);
        this.collisionEdgeTangent.set(0, 0, 0);
        this.shipHitboxSphere.center.copy(this.shipCollisionCenter)
            .applyMatrix4(this.playerShip.object.matrixWorld);

        bestDistanceSq = this.findClosestTriangleNormalForPoint(
            this.shipHitboxSphere.center,
            bestDistanceSq
        );

        for (const point of this.shipCollisionPoints) {
            this.collisionPointWorld.copy(point).applyMatrix4(this.playerShip.object.matrixWorld);
            bestDistanceSq = this.findClosestTriangleNormalForPoint(
                this.collisionPointWorld,
                bestDistanceSq
            );
        }

        if (this.collisionNormal.lengthSq() === 0) {
            this.collisionNormal.copy(movement).multiplyScalar(-1);
        }

        if (this.collisionNormal.lengthSq() === 0) {
            this.collisionNormal.set(0, 1, 0);
        } else {
            this.collisionNormal.normalize();
        }

        if (movement.dot(this.collisionNormal) > 0) {
            this.collisionNormal.negate();
        }

        return this.collisionNormal.clone();
    }

    findClosestTriangleNormalForPoint(point, bestDistanceSq) {
        for (const triangle of this.stationHitboxTriangles) {
            triangle.closestPointToPoint(point, this.collisionClosestPoint);
            const distanceSq = this.collisionClosestPoint.distanceToSquared(point);

            if (distanceSq < bestDistanceSq) {
                triangle.getNormal(this.collisionTriangleNormal);

                if (this.collisionTriangleNormal.lengthSq() > 0) {
                    this.collisionNormal.copy(this.collisionTriangleNormal).normalize();
                } else {
                    this.collisionNormal.subVectors(point, this.collisionClosestPoint);

                    if (this.collisionNormal.lengthSq() > 0.000001) {
                        this.collisionNormal.normalize();
                    }
                }

                if (this.collisionNormal.dot(this.collisionMovement) > 0) {
                    this.collisionNormal.negate();
                }

                this.updateCollisionEdgeTangent(triangle);
                bestDistanceSq = distanceSq;
            }
        }

        return bestDistanceSq;
    }

    updateCollisionEdgeTangent(triangle) {
        const movementLengthSq = this.collisionMovement.lengthSq();

        if (movementLengthSq === 0) {
            this.collisionEdgeTangent.set(0, 0, 0);
            return;
        }

        this.collisionEdgeA.subVectors(triangle.b, triangle.a).normalize();
        this.collisionEdgeB.subVectors(triangle.c, triangle.b).normalize();
        this.collisionEdgeC.subVectors(triangle.a, triangle.c).normalize();

        let bestEdge = this.collisionEdgeA;
        let bestAlignment = Math.abs(bestEdge.dot(this.collisionMovement));
        const edgeBAlignment = Math.abs(this.collisionEdgeB.dot(this.collisionMovement));
        const edgeCAlignment = Math.abs(this.collisionEdgeC.dot(this.collisionMovement));

        if (edgeBAlignment > bestAlignment) {
            bestEdge = this.collisionEdgeB;
            bestAlignment = edgeBAlignment;
        }

        if (edgeCAlignment > bestAlignment) {
            bestEdge = this.collisionEdgeC;
        }

        this.collisionEdgeTangent.copy(bestEdge);

        if (this.collisionEdgeTangent.dot(this.collisionMovement) < 0) {
            this.collisionEdgeTangent.negate();
        }
    }

    hasPlayerStationCollisionAt(position, quaternion) {
        const shipPosition = this.playerShip.object.position;
        const shipQuaternion = this.playerShip.object.quaternion;
        const previousPosition = shipPosition.clone();
        const previousQuaternion = shipQuaternion.clone();

        shipPosition.copy(position);
        if (quaternion) {
            shipQuaternion.copy(quaternion);
        }
        this.playerShip.object.updateMatrixWorld(true);

        const hasCollision = this.hasPlayerStationCollision();

        shipPosition.copy(previousPosition);
        shipQuaternion.copy(previousQuaternion);
        this.playerShip.object.updateMatrixWorld(true);

        return hasCollision;
    }

    hasPlayerStationCollision() {
        this.shipHitboxSphere.center.copy(this.shipCollisionCenter)
            .applyMatrix4(this.playerShip.object.matrixWorld);
        this.shipHitboxSphere.radius = this.shipCollisionRadius;

        if (this.isPointInsideStationHitbox(this.shipHitboxSphere.center)) {
            return true;
        }

        for (const point of this.shipCollisionPoints) {
            this.collisionPointWorld.copy(point).applyMatrix4(this.playerShip.object.matrixWorld);

            if (this.isPointInsideStationHitbox(this.collisionPointWorld)) {
                return true;
            }

            if (this.isPointNearStationHitbox(this.collisionPointWorld, this.shipCollisionPointRadius)) {
                return true;
            }
        }

        return this.stationHitboxTriangles.some((triangle) => {
            triangle.closestPointToPoint(this.shipHitboxSphere.center, this.collisionCheckPosition);

            return this.collisionCheckPosition.distanceToSquared(this.shipHitboxSphere.center) <=
                this.shipHitboxSphere.radius * this.shipHitboxSphere.radius;
        });
    }

    hasPlayerStationCollisionBetween(from, to, fromQuaternion, toQuaternion) {
        const distance = from.distanceTo(to);
        const rotationAngle = fromQuaternion.angleTo(toQuaternion);
        const moveSteps = Math.ceil(distance / Math.max(this.shipCollisionRadius * 0.5, 0.1));
        const rotationSteps = Math.ceil(rotationAngle / 0.08);
        const steps = Math.max(1, moveSteps, rotationSteps);

        for (let i = 1; i <= steps; i++) {
            const alpha = i / steps;

            this.collisionStepPosition.lerpVectors(from, to, alpha);
            this.collisionStepQuaternion.slerpQuaternions(fromQuaternion, toQuaternion, alpha);

            if (this.hasPlayerStationCollisionAt(this.collisionStepPosition, this.collisionStepQuaternion)) {
                return true;
            }
        }

        return false;
    }

    isPointNearStationHitbox(point, radius) {
        const radiusSq = radius * radius;

        return this.stationHitboxTriangles.some((triangle) => {
            triangle.closestPointToPoint(point, this.collisionCheckPosition);

            return this.collisionCheckPosition.distanceToSquared(point) <= radiusSq;
        });
    }

    isPointInsideStationHitbox(point) {
        this.collisionRay.origin.copy(point);
        this.collisionRayDistances.length = 0;

        for (const triangle of this.stationHitboxTriangles) {
            const hit = this.collisionRay.intersectTriangle(
                triangle.a,
                triangle.b,
                triangle.c,
                false,
                this.collisionRayHit
            );

            if (hit) {
                this.collisionRayDistances.push(hit.distanceTo(point));
            }
        }

        if (this.collisionRayDistances.length === 0) {
            return false;
        }

        this.collisionRayDistances.sort((a, b) => a - b);

        let uniqueHits = 0;
        let previousDistance = -Infinity;
        const hitEpsilon = 0.001;

        for (const distance of this.collisionRayDistances) {
            if (distance > hitEpsilon && distance - previousDistance > hitEpsilon) {
                uniqueHits += 1;
                previousDistance = distance;
            }
        }

        return uniqueHits % 2 === 1;
    }
}
