import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.159.0/examples/jsm/loaders/GLTFLoader.js';
import { ARButton } from './libs/ARButton.js';

class ARModelViewer {
    constructor() {
        this.camera = null;
        this.scene = null;
        this.renderer = null;
        this.controller = null;
        this.models = {
            'fast-charger': null,
            'wall-charger': null
        };
        this.placedModels = [];
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.statusElement = document.getElementById('hit-test-status');
        
        this.init();
        this.loadModels();
        this.animate();
    }

    showStatus(message, duration = 3000) {
        this.statusElement.textContent = message;
        this.statusElement.style.display = 'block';
        setTimeout(() => {
            this.statusElement.style.display = 'none';
        }, duration);
    }

    init() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.xr.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Lights
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        light.position.set(0.5, 1, 0.25);
        this.scene.add(light);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(-2, 4, 2);
        this.scene.add(directionalLight);

        // AR Button
        document.body.appendChild(
            ARButton.createButton(this.renderer, {
                requiredFeatures: ['hit-test'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: { root: document.body }
            })
        );

        // Controller
        this.controller = this.renderer.xr.getController(0);
        this.controller.addEventListener('select', () => this.onSelect());
        this.scene.add(this.controller);

        // Hit test indicator
        const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.reticle = new THREE.Mesh(geometry, material);
        this.reticle.matrixAutoUpdate = false;
        this.reticle.visible = false;
        this.scene.add(this.reticle);

        // Window resize handler
        window.addEventListener('resize', () => this.onWindowResize());
    }

    loadModels() {
        const loader = new GLTFLoader();
        const modelNames = ['fast-charger', 'wall-charger'];

        modelNames.forEach(modelName => {
            loader.load(
                `models/${modelName}.glb`,
                (gltf) => {
                    this.models[modelName] = gltf.scene;
                    this.models[modelName].scale.set(0.5, 0.5, 0.5);
                    this.showStatus(`${modelName} model loaded successfully`);
                },
                undefined,
                (error) => {
                    console.error(`Error loading ${modelName}:`, error);
                    this.showStatus(`Error loading ${modelName} model`, 5000);
                }
            );
        });
    }

    onSelect() {
        if (this.reticle.visible) {
            const modelNames = Object.keys(this.models);
            const randomModel = this.models[modelNames[Math.floor(Math.random() * modelNames.length)]];
            
            if (randomModel) {
                const model = randomModel.clone();
                model.position.setFromMatrixPosition(this.reticle.matrix);
                this.scene.add(model);
                this.placedModels.push(model);
                this.showStatus('Model placed successfully');
            }
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    async initializeHitTesting() {
        const session = this.renderer.xr.getSession();

        const viewerSpace = await session.requestReferenceSpace('viewer');
        this.hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

        const referenceSpace = await session.requestReferenceSpace('local');
        this.renderer.xr.setReferenceSpace(referenceSpace);

        session.addEventListener('end', () => {
            this.hitTestSourceRequested = false;
            this.hitTestSource = null;
            this.showStatus('AR session ended');
        });

        this.showStatus('Hit testing initialized');
    }

    animate() {
        this.renderer.setAnimationLoop((timestamp, frame) => {
            if (frame) {
                if (!this.hitTestSourceRequested) {
                    this.initializeHitTesting();
                    this.hitTestSourceRequested = true;
                }

                if (this.hitTestSource) {
                    const hitTestResults = frame.getHitTestResults(this.hitTestSource);

                    if (hitTestResults.length > 0) {
                        const hit = hitTestResults[0];
                        const pose = hit.getPose(this.renderer.xr.getReferenceSpace());

                        this.reticle.visible = true;
                        this.reticle.matrix.fromArray(pose.transform.matrix);

                        // Update hit test indicators
                        document.querySelectorAll('.model-container').forEach(container => {
                            container.classList.add('hit-test-active');
                        });
                    } else {
                        this.reticle.visible = false;
                        document.querySelectorAll('.model-container').forEach(container => {
                            container.classList.remove('hit-test-active');
                        });
                    }
                }
            }

            // Rotate placed models
            this.placedModels.forEach(model => {
                model.rotation.y += 0.01;
            });

            this.renderer.render(this.scene, this.camera);
        });
    }
}

// Initialize when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
    const modelViewers = document.querySelectorAll('model-viewer');
    const hitTestStatus = document.getElementById('hit-test-status');

    // Function to handle hit testing
    function handleHitTest(modelViewer) {
        const hitTestIndicator = modelViewer.querySelector('.hit-test-indicator');
        
        // Show status message
        function showStatus(message) {
            hitTestStatus.textContent = message;
            hitTestStatus.style.display = 'block';
            setTimeout(() => {
                hitTestStatus.style.display = 'none';
            }, 3000);
        }

        // Handle AR session start
        modelViewer.addEventListener('ar-status', (event) => {
            if (event.detail.status === 'session-started') {
                showStatus('AR session started. Move your device to detect surfaces.');
            }
        });

        // Handle hit testing
        modelViewer.addEventListener('hit-test', (event) => {
            const hitTestResult = event.detail;
            
            if (hitTestResult.hit) {
                hitTestIndicator.style.display = 'block';
                hitTestIndicator.style.left = `${hitTestResult.x}px`;
                hitTestIndicator.style.top = `${hitTestResult.y}px`;
                hitTestIndicator.classList.add('visible');
            } else {
                hitTestIndicator.classList.remove('visible');
            }
        });

        // Handle model placement
        modelViewer.addEventListener('ar-placement', (event) => {
            if (event.detail.status === 'placed') {
                showStatus('Model placed successfully!');
            }
        });

        // Handle errors
        modelViewer.addEventListener('error', (error) => {
            console.error('AR Error:', error);
            showStatus('Error: ' + error.detail);
        });
    }

    // Initialize hit testing for each model viewer
    modelViewers.forEach(handleHitTest);

    // Handle model loading
    modelViewers.forEach(modelViewer => {
        const progressBar = modelViewer.querySelector('.progress-bar');
        const updateBar = modelViewer.querySelector('.update-bar');
        const arButton = modelViewer.querySelector('.ar-button');

        modelViewer.addEventListener('progress', (event) => {
            const progress = event.detail.totalProgress;
            updateBar.style.transform = `scaleX(${progress})`;
            progressBar.classList.remove('hide');
        });

        modelViewer.addEventListener('load', () => {
            progressBar.classList.add('hide');
            arButton.style.display = 'block';
        });

        modelViewer.addEventListener('error', (error) => {
            console.error('Error loading model:', error);
            progressBar.classList.add('hide');
        });
    });
}); 