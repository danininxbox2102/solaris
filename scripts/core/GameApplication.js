import * as THREE from 'three';
import { GameLoop } from './GameLoop.js';
import { RendererService } from './RendererService.js';
import { CameraController } from './CameraController.js';
import { SceneController } from '../scene/SceneController.js';
import { ModelLoader } from '../assets/ModelLoader.js';
import { LoadingOverlay } from '../ui/LoadingOverlay.js';
import { DebugOverlay } from '../ui/DebugOverlay.js';
import { MenuState } from '../states/MenuState.js';

export class GameApplication {
    constructor(config) {
        this.config = {
            backgroundColor: 0x111111,
            camera: {
                fov: 60,
                near: 0.1,
                far: 1000,
                startPosition: new THREE.Vector3(2, 2, 4),
                target: new THREE.Vector3(0, 1, 0)
            },
            ...config
        };

        this.sceneController = new SceneController(this.config.backgroundColor);
        this.rendererService = new RendererService(this.config.canvasParent);
        this.cameraController = new CameraController(
            this.config.camera,
            this.rendererService.domElement
        );
        this.modelLoader = new ModelLoader();
        this.loadingOverlay = new LoadingOverlay(this.config.loaderSelector);
        this.debugOverlay = new DebugOverlay(this.config.debugSelector);
        this.menuState = new MenuState(this.sceneController.scene, this.cameraController);

        this.clock = new THREE.Clock();
        this.mixers = [];
        this.loop = new GameLoop({
            onUpdate: () => this.update(),
            onRender: () => this.render()
        });

        this.handleResize = this.handleResize.bind(this);
    }

    async start() {
        this.sceneController.setupDefaultWorld();
        this.menuState.enter();

        window.addEventListener('resize', this.handleResize);
        this.handleResize();

        await this.loadInitialScene();
        this.loop.start();
    }

    async loadInitialScene() {
        try {
            const corridorModel = await this.modelLoader.load(this.config.models.corridor, {
                onProgress: (progress) => this.loadingOverlay.setProgress(progress)
            });

            this.sceneController.add(corridorModel.root);

            if (corridorModel.mixer) {
                this.mixers.push(corridorModel.mixer);
            }

            const stationModel = await this.modelLoader.load(this.config.models.station, {
                onProgress: (progress) => this.loadingOverlay.setProgress(progress)
            });

            stationModel.root.position.set(20,1.5,-10)
            stationModel.root.scale.set(3,3,3)

            this.sceneController.add(stationModel.root);

            if (stationModel.mixer) {
                this.mixers.push(stationModel.mixer);
            }

            this.loadingOverlay.hide();
        } catch (error) {
            console.error('Ошибка загрузки GLTF/GLB модели:', error);
            this.loadingOverlay.setError('Ошибка загрузки модели');
        }
    }

    update() {
        const delta = this.clock.getDelta();

        for (const mixer of this.mixers) {
            mixer.update(delta);
        }

        this.cameraController.update();
        this.debugOverlay.update(this.cameraController.camera);
    }

    render() {
        this.rendererService.render(
            this.sceneController.scene,
            this.cameraController.camera
        );
    }

    handleResize() {
        this.cameraController.resize(window.innerWidth, window.innerHeight);
        this.rendererService.resize(window.innerWidth, window.innerHeight);
    }

    destroy() {
        this.loop.stop();
        this.menuState.exit();
        window.removeEventListener('resize', this.handleResize);
        this.rendererService.dispose();
    }
}
