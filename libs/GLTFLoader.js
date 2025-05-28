import * as THREE from './three.min.js';

class GLTFLoader {
    constructor(manager) {
        this.manager = manager || THREE.DefaultLoadingManager;
    }

    load(url, onLoad, onProgress, onError) {
        const loader = new THREE.FileLoader(this.manager);
        loader.setPath(this.path);
        loader.setResponseType('arraybuffer');
        loader.setRequestHeader(this.requestHeader);
        loader.setWithCredentials(this.withCredentials);

        loader.load(url, 
            (buffer) => {
                try {
                    this.parse(buffer, url)
                        .then(onLoad)
                        .catch(onError);
                } catch (error) {
                    if (onError) {
                        onError(error);
                    } else {
                        console.error(error);
                    }
                    this.manager.itemError(url);
                }
            },
            onProgress,
            onError
        );
    }

    setPath(path) {
        this.path = path;
        return this;
    }

    setResourcePath(path) {
        this.resourcePath = path;
        return this;
    }

    setRequestHeader(value) {
        this.requestHeader = value;
        return this;
    }

    setWithCredentials(value) {
        this.withCredentials = value;
        return this;
    }

    async parse(buffer, path) {
        const scene = new THREE.Scene();
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0x808080 });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        return { scene: scene };
    }
}

export { GLTFLoader }; 