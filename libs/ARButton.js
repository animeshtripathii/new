class ARButton {
    static createButton(renderer, options = {}) {
        const button = document.createElement('button');
        button.style.display = 'none';
        button.style.position = 'absolute';
        button.style.bottom = '24px';
        button.style.padding = '12px 24px';
        button.style.border = '1px solid #fff';
        button.style.borderRadius = '4px';
        button.style.background = 'rgba(0, 0, 0, 0.8)';
        button.style.color = '#fff';
        button.style.font = 'normal 13px sans-serif';
        button.style.textAlign = 'center';
        button.style.opacity = '0.9';
        button.style.outline = 'none';
        button.style.zIndex = '999';
        button.style.cursor = 'pointer';
        button.style.left = '50%';
        button.style.transform = 'translateX(-50%)';

        let currentSession = null;

        async function onSessionStarted(session) {
            session.addEventListener('end', onSessionEnded);

            await renderer.xr.setSession(session);
            button.textContent = 'EXIT AR';
            button.style.display = 'block';

            currentSession = session;
        }

        function onSessionEnded() {
            currentSession.removeEventListener('end', onSessionEnded);

            button.textContent = 'ENTER AR';
            button.style.display = 'block';

            currentSession = null;
        }

        async function onButtonClicked() {
            if (currentSession === null) {
                const sessionInit = {
                    requiredFeatures: options.requiredFeatures || ['local-floor'],
                    optionalFeatures: options.optionalFeatures || ['dom-overlay'],
                };

                if (options.domOverlay) {
                    sessionInit.domOverlay = { root: options.domOverlay.root };
                }

                try {
                    const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
                    await onSessionStarted(session);
                } catch (error) {
                    const message = document.createElement('div');
                    message.style.position = 'absolute';
                    message.style.top = '50%';
                    message.style.left = '50%';
                    message.style.transform = 'translate(-50%, -50%)';
                    message.style.background = 'rgba(0, 0, 0, 0.8)';
                    message.style.color = '#fff';
                    message.style.padding = '20px';
                    message.style.borderRadius = '10px';
                    message.style.textAlign = 'center';
                    message.textContent = `AR not available: ${error.message}`;
                    document.body.appendChild(message);
                    setTimeout(() => message.remove(), 5000);
                }
            } else {
                currentSession.end();
            }
        }

        button.style.display = '';
        button.style.right = '20px';
        button.style.width = '100px';
        button.style.height = '40px';
        button.textContent = 'ENTER AR';

        button.addEventListener('click', onButtonClicked);

        // Check if AR is supported
        if ('xr' in navigator) {
            navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
                if (!supported) {
                    button.textContent = 'AR NOT SUPPORTED';
                    button.disabled = true;
                    button.style.opacity = '0.5';
                }
            });
        } else {
            button.textContent = 'AR NOT SUPPORTED';
            button.disabled = true;
            button.style.opacity = '0.5';
        }

        return button;
    }
}

export { ARButton }; 