import * as THREE from 'three';

const STATION_MARKER_MIN_DISTANCE = 300;

export class HudOverlay {
    constructor(selector, gameApp) {
        this.gameApp = gameApp;
        this.element = document.querySelector(selector);
        this.borderWarningShown = false;
        this.stationMarkerVisible = false;
        this.stationMarkerPosition = new THREE.Vector3();
        this.stationMarkerProjected = new THREE.Vector3();
        this.stationMarkerDirection = new THREE.Vector3();
        this.stationMarkerCameraDirection = new THREE.Vector3();
        this.createHealthBar();
        this.createFlightReticle();
        this.createStationMarker();
    }

    createHealthBar() {
        this.healthBar = document.createElement('div');
        this.healthBar.className = 'health-bar';
        this.healthBar.setAttribute('aria-label', 'Ship health');

        this.healthBarLabel = document.createElement('div');
        this.healthBarLabel.className = 'health-bar__label';
        this.healthBarLabel.textContent = 'HULL';

        this.healthBarTrack = document.createElement('div');
        this.healthBarTrack.className = 'health-bar__track';

        this.healthBarFill = document.createElement('div');
        this.healthBarFill.className = 'health-bar__fill';

        this.healthBarValue = document.createElement('div');
        this.healthBarValue.className = 'health-bar__value';

        this.healthBarTrack.append(this.healthBarFill);
        this.healthBar.append(
            this.healthBarLabel,
            this.healthBarTrack,
            this.healthBarValue
        );

        Object.assign(this.healthBar.style, {
            position: 'absolute',
            left: '28px',
            bottom: '28px',
            display: 'none',
            alignItems: 'center',
            gap: '10px',
            width: '320px',
            maxWidth: 'calc(100vw - 56px)',
            padding: '10px 12px',
            color: '#e7fbff',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            background: 'rgba(3, 12, 20, 0.54)',
            border: '1px solid rgba(143, 238, 255, 0.24)',
            borderRadius: '8px',
            boxShadow: '0 0 18px rgba(34, 208, 255, 0.14)',
            pointerEvents: 'none'
        });

        Object.assign(this.healthBarLabel.style, {
            flex: '0 0 auto',
            color: 'rgba(231, 251, 255, 0.86)'
        });

        Object.assign(this.healthBarTrack.style, {
            position: 'relative',
            flex: '1 1 auto',
            height: '10px',
            overflow: 'hidden',
            background: 'rgba(231, 251, 255, 0.14)',
            border: '1px solid rgba(231, 251, 255, 0.22)',
            borderRadius: '999px'
        });

        Object.assign(this.healthBarFill.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #31e981, #b7ff7a)',
            borderRadius: '999px',
            boxShadow: '0 0 12px rgba(49, 233, 129, 0.55)',
            transformOrigin: '0 50%',
            transform: 'scaleX(1)',
            transition: 'transform 140ms ease, background 140ms ease, box-shadow 140ms ease'
        });

        Object.assign(this.healthBarValue.style, {
            flex: '0 0 54px',
            color: 'rgba(231, 251, 255, 0.78)',
            fontSize: '11px',
            textAlign: 'right'
        });

        this.element.append(this.healthBar);
    }

    showHealthBar() {
        this.healthBar.style.display = 'flex';
    }

    hideHealthBar() {
        this.healthBar.style.display = 'none';
    }

    updateHealthBar({ health, maxHealth, ratio, isAlive }) {
        const safeMaxHealth = Math.max(1, maxHealth ?? 1);
        const safeHealth = Math.max(0, health ?? 0);
        const healthRatio = THREE.MathUtils.clamp(
            ratio ?? safeHealth / safeMaxHealth, // aaaa
            0,
            1
        );

        this.healthBarFill.style.transform = `scaleX(${healthRatio})`;
        this.healthBarValue.textContent = `${Math.ceil(safeHealth)} / ${Math.ceil(safeMaxHealth)}`;

        if (!isAlive || healthRatio <= 0.25) {
            this.healthBarFill.style.background = 'linear-gradient(90deg, #ff3f5f, #ff9a4a)';
            this.healthBarFill.style.boxShadow = '0 0 14px rgba(255, 63, 95, 0.68)';
        } else if (healthRatio <= 0.55) {
            this.healthBarFill.style.background = 'linear-gradient(90deg, #ffd447, #ffef8a)';
            this.healthBarFill.style.boxShadow = '0 0 12px rgba(255, 212, 71, 0.54)';
        } else {
            this.healthBarFill.style.background = 'linear-gradient(90deg, #31e981, #b7ff7a)';
            this.healthBarFill.style.boxShadow = '0 0 12px rgba(49, 233, 129, 0.55)';
        }
    }

    createFlightReticle() {
        this.flightReticle = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.flightReticle.setAttribute('class', 'flight-reticle');
        this.flightReticle.setAttribute('aria-hidden', 'true');
        Object.assign(this.flightReticle.style, {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none',
            opacity: '0',
            transition: 'opacity 140ms ease'
        });

        this.reticleOuter = this.createSvgCircle('rgba(0, 0, 0, 0)', 'rgba(225, 230, 238, 0)', 1);
        this.reticleSoft = this.createSvgCircle('rgba(0, 0, 0, 0)', 'rgba(225, 230, 238, 0.12)', 1);
        this.reticleLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        this.reticleLine.setAttribute('stroke', 'rgba(232, 235, 242, 0.62)');
        this.reticleLine.setAttribute('stroke-width', '2');
        this.reticleLine.setAttribute('stroke-linecap', 'round');
        this.reticleLine.setAttribute('filter', 'url(#reticleGlow)');

        this.reticleCursor = this.createSvgCircle('rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.92)', 2.2);
        this.reticleCursorDot = this.createSvgCircle('rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.96)', 1.5);

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <filter id="reticleGlow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="2.2" result="blur"></feGaussianBlur>
                <feMerge>
                    <feMergeNode in="blur"></feMergeNode>
                    <feMergeNode in="SourceGraphic"></feMergeNode>
                </feMerge>
            </filter>
        `;

        this.flightReticle.append(
            defs,
            this.reticleOuter,
            this.reticleSoft,
            this.reticleLine,
            this.reticleCursor,
            this.reticleCursorDot
        );
        this.element.append(this.flightReticle);
    }

    createSvgCircle(fill, stroke, strokeWidth) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('fill', fill);
        circle.setAttribute('stroke', stroke);
        circle.setAttribute('stroke-width', String(strokeWidth));
        circle.setAttribute('filter', 'url(#reticleGlow)');

        return circle;
    }

    showFlightReticle() {
        this.flightReticle.style.opacity = '1';
    }

    hideFlightReticle() {
        this.flightReticle.style.opacity = '0';
    }

    updateFlightReticle({ x, y, softZone, radius }) {
        const centerX = window.innerWidth * 0.5;
        const centerY = window.innerHeight * 0.46;
        const outerRadius = Math.min(window.innerWidth, window.innerHeight) * 0.28;
        const softRadius = outerRadius * (softZone / radius);
        const cursorX = centerX + x * outerRadius;
        const cursorY = centerY + y * outerRadius;
        const amount = Math.min(1, Math.hypot(x, y) / Math.max(radius, 0.001));
        const lineOpacity = amount < 0.04 ? 0 : 0.24 + amount * 0.58;
        const cursorRadius = 6 + amount * 8;

        this.setCircle(this.reticleOuter, centerX, centerY, outerRadius);
        this.setCircle(this.reticleSoft, centerX, centerY, softRadius);
        this.setCircle(this.reticleCursor, cursorX, cursorY, cursorRadius);
        this.setCircle(this.reticleCursorDot, cursorX, cursorY, 2.4 + amount * 1.6);

        this.reticleLine.setAttribute('x1', String(centerX));
        this.reticleLine.setAttribute('y1', String(centerY));
        this.reticleLine.setAttribute('x2', String(cursorX));
        this.reticleLine.setAttribute('y2', String(cursorY));
        this.reticleLine.setAttribute('opacity', String(lineOpacity));
    }

    setCircle(circle, x, y, radius) {
        circle.setAttribute('cx', String(x));
        circle.setAttribute('cy', String(y));
        circle.setAttribute('r', String(radius));
    }

    createStationMarker() {
        this.stationMarker = document.createElement('div');
        this.stationMarker.className = 'station-marker';
        this.stationMarker.setAttribute('aria-label', 'Station marker');

        this.stationMarkerArrow = document.createElement('div');
        this.stationMarkerArrow.className = 'station-marker__arrow';

        this.stationMarkerLabel = document.createElement('div');
        this.stationMarkerLabel.className = 'station-marker__label';
        this.stationMarkerLabel.innerHTML = '<img src="./assets/ico/station.svg" height="50">';

        this.stationMarkerDistance = document.createElement('div');
        this.stationMarkerDistance.className = 'station-marker__distance';

        this.stationMarker.append(
            this.stationMarkerArrow,
            this.stationMarkerLabel,
            this.stationMarkerDistance
        );

        Object.assign(this.stationMarker.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            display: 'none',
            alignItems: 'center',
            flexDirection: 'column',
            gap: '2px',
            minWidth: '92px',
            padding: '6px 9px',
            color: '#dff7ff',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            textAlign: 'center',
            //background: 'rgba(4, 16, 28, 0.48)',
            border: 'none',
            //borderRadius: '8px',
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            transition: 'opacity 120ms ease'
        });

        Object.assign(this.stationMarkerArrow.style, {
            width: '0',
            height: '0',
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: '10px solid #8feeff',
            transformOrigin: '50% 55%'
        });

        Object.assign(this.stationMarkerLabel.style, {
            lineHeight: '1.1'
        });

        Object.assign(this.stationMarkerDistance.style, {
            color: 'rgba(223, 247, 255, 0.72)',
            fontSize: '10px',
            fontWeight: '600',
            letterSpacing: '0.04em',
            lineHeight: '1.1'
        });

        this.element.append(this.stationMarker);
    }

    showStationMarker() {
        this.stationMarkerVisible = true;
    }

    hideStationMarker() {
        this.stationMarkerVisible = false;
        this.stationMarker.style.display = 'none';
    }

    updateStationMarker({ worldPosition, camera, playerPosition }) {
        if (!this.stationMarkerVisible || !worldPosition || !camera) {
            return;
        }

        this.stationMarkerPosition.set(worldPosition.x, worldPosition.y, worldPosition.z);

        if (!playerPosition) {
            this.stationMarker.style.display = 'none';
            return;
        }

        const distance = this.stationMarkerPosition.distanceTo(playerPosition);
        if (distance <= STATION_MARKER_MIN_DISTANCE) {
            this.stationMarker.style.display = 'none';
            return;
        }

        this.stationMarker.style.display = 'flex';
        this.stationMarkerProjected.copy(this.stationMarkerPosition).project(camera);
        this.stationMarkerDirection.copy(this.stationMarkerPosition).sub(camera.position);
        camera.getWorldDirection(this.stationMarkerCameraDirection);

        const isBehindCamera = this.stationMarkerDirection.dot(this.stationMarkerCameraDirection) <= 0;
        let ndcX = this.stationMarkerProjected.x;
        let ndcY = this.stationMarkerProjected.y;

        if (isBehindCamera) {
            ndcX *= -1;
            ndcY *= -1;
        }

        const rect = this.element.getBoundingClientRect();
        const viewportWidth = rect.width || window.innerWidth;
        const viewportHeight = rect.height || window.innerHeight;
        const edgePadding = 54;
        const screenX = (ndcX * 0.5 + 0.5) * viewportWidth;
        const screenY = (-ndcY * 0.5 + 0.5) * viewportHeight;
        const x = Math.min(Math.max(screenX, edgePadding), viewportWidth - edgePadding);
        const y = Math.min(Math.max(screenY, edgePadding), viewportHeight - edgePadding);
        const isOnScreen = !isBehindCamera
            && ndcX >= -1
            && ndcX <= 1
            && ndcY >= -1
            && ndcY <= 1;
        const markerAngle = Math.atan2(y - viewportHeight * 0.5, x - viewportWidth * 0.5) + Math.PI * 0.5;

        this.stationMarker.style.left = `${x}px`;
        this.stationMarker.style.top = `${y}px`;
        this.stationMarker.style.opacity = isOnScreen ? '1' : '0.86';
        this.stationMarkerArrow.style.transform = isOnScreen
            ? 'rotate(0rad)'
            : `rotate(${markerAngle}rad)`;

        this.stationMarkerDistance.textContent = `${Math.round(distance)} u`;
    }

    startAlarm() {
        this.gameApp.soundManager.playSfx('borderAlarm').then();
        this.alarmIntervalId = setInterval(() => {
            this.gameApp.soundManager.playSfx('borderAlarm').then();
        },4000)
    }

    stopAlarm() {
        clearInterval(this.alarmIntervalId);
        this.gameApp.soundManager.stopSfx("borderAlarm");
    }

    displayBorderWarning() {
        if (this.borderWarningShown) return;

        this.borderWarningShown = true;

        this.element.querySelector('[id=borderWarn]').style.display = "block";
        this.gameApp.soundManager.playSfx('radioReceive').then();
        this.gameApp.soundManager.playMusic('borderTheme').then();
        this.gameApp.soundManager.playSfx('borderMessage').then();
        this.startAlarm();
    }

    hideBorderWarning() {
        if (!this.borderWarningShown) return;

        this.borderWarningShown = false;

        this.element.querySelector('[id=borderWarn]').style.display = "none";
        this.gameApp.soundManager.stopMusic("borderTheme");
        this.stopAlarm();
    }

    update() {

    }

}
