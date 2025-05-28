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

// XR globals
let xrButton = null;
let xrRefSpace = null;
let xrViewerSpace = null;
let xrHitTestSource = null;
let reticleHitTestResult = null;

// WebGL scene globals
let gl = null;
let renderer = null;
let scene = null;
let reticle = null;

// Model tracking
const MAX_MODELS = 30;
let placedModels = [];

document.addEventListener('DOMContentLoaded', function() {
    const modelViewers = document.querySelectorAll('model-viewer');
    const hitTestStatus = document.getElementById('hit-test-status');

    // Initialize XR
    function initXR() {
        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-ar')
                .then((supported) => {
                    if (supported) {
                        setupARButton();
                    } else {
                        showStatus('AR not supported on this device', true);
                    }
                });
        } else {
            showStatus('WebXR not supported', true);
        }
    }

    // Setup AR button
    function setupARButton() {
        const arButton = document.getElementById('ar-button');
        const arStatus = document.getElementById('ar-status');

        arButton.addEventListener('click', () => {
            if (xrButton) {
                onRequestSession();
            }
        });

        arStatus.textContent = 'AR READY';
    }

    // Request AR session
    function onRequestSession() {
        return navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['local', 'hit-test']
        }).then((session) => {
            onSessionStarted(session);
        });
    }

    // Handle session start
    function onSessionStarted(session) {
        session.addEventListener('end', onSessionEnded);
        session.addEventListener('select', onSelect);

        // Initialize WebGL context if not already done
        if (!gl) {
            gl = document.createElement('canvas').getContext('webgl', {
                xrCompatible: true
            });
        }

        // Create XR layer
        session.updateRenderState({
            baseLayer: new XRWebGLLayer(session, gl)
        });

        // Setup hit testing
        session.requestReferenceSpace('viewer').then((refSpace) => {
            xrViewerSpace = refSpace;
            session.requestHitTestSource({ space: xrViewerSpace }).then((hitTestSource) => {
                xrHitTestSource = hitTestSource;
            });
        });

        // Get reference space
        session.requestReferenceSpace('local').then((refSpace) => {
            xrRefSpace = refSpace;
            session.requestAnimationFrame(onXRFrame);
        });
    }

    // Handle session end
    function onSessionEnded() {
        if (xrHitTestSource) {
            xrHitTestSource.cancel();
            xrHitTestSource = null;
        }
        xrRefSpace = null;
        xrViewerSpace = null;
        showStatus('AR session ended');
    }

    // Handle select event (placing models)
    function onSelect(event) {
        if (reticleHitTestResult) {
            const modelViewer = document.querySelector('model-viewer[ar-status="presenting"]');
            if (modelViewer) {
                const hitPose = reticleHitTestResult.getPose(xrRefSpace);
                if (hitPose) {
                    // Place model at hit location
                    modelViewer.arPlacement = 'floor';
                    modelViewer.arPlacement = hitPose.transform.matrix;
                    showStatus('Model placed successfully!');
                }
            }
        }
    }

    // XR Frame update
    function onXRFrame(timestamp, frame) {
        const session = frame.session;
        const pose = frame.getViewerPose(xrRefSpace);

        // Update reticle visibility
        const reticle = document.getElementById('reticle');
        reticle.style.display = 'none';

        // Perform hit testing
        if (xrHitTestSource && pose) {
            const hitTestResults = frame.getHitTestResults(xrHitTestSource);
            if (hitTestResults.length > 0) {
                const hitPose = hitTestResults[0].getPose(xrRefSpace);
                reticle.style.display = 'block';
                reticle.style.transform = `translate3d(${hitPose.transform.position.x}px, ${hitPose.transform.position.y}px, ${hitPose.transform.position.z}px)`;
                reticleHitTestResult = hitTestResults[0];
            }
        }

        // Request next frame
        session.requestAnimationFrame(onXRFrame);
    }

    // Show status message
    function showStatus(message, isError = false) {
        hitTestStatus.textContent = message;
        hitTestStatus.style.display = 'block';
        hitTestStatus.style.backgroundColor = isError ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.8)';
        console.log('Status:', message);
        setTimeout(() => {
            hitTestStatus.style.display = 'none';
        }, 3000);
    }

    // Initialize XR
    initXR();

    // Handle model loading
    modelViewers.forEach(modelViewer => {
        const progressBar = modelViewer.querySelector('.progress-bar');
        const updateBar = modelViewer.querySelector('.update-bar');
        const arButton = modelViewer.querySelector('.ar-button');

        modelViewer.addEventListener('progress', (event) => {
            const progress = event.detail.totalProgress;
            updateBar.style.transform = `scaleX(${progress})`;
            progressBar.classList.remove('hide');
            console.log('Loading progress:', progress * 100 + '%');
        });

        modelViewer.addEventListener('load', () => {
            progressBar.classList.add('hide');
            arButton.style.display = 'block';
            console.log('Model fully loaded');
        });

        modelViewer.addEventListener('error', (error) => {
            console.error('Error loading model:', error);
            progressBar.classList.add('hide');
            showStatus('Error loading model: ' + error.detail, true);
        });
    });
}); 
