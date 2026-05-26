export class LoadingOverlay {
    constructor(selector) {
        this.element = document.querySelector(selector);
    }

    setProgress(progress) {
        if (!this.element) {
            return;
        }

        this.element.textContent = `Загрузка... ${progress}%`;
    }

    setError(message) {
        if (!this.element) {
            return;
        }

        this.element.textContent = message;
        this.element.style.display = 'block';
    }

    hide() {
        if (!this.element) {
            return;
        }

        this.element.style.display = 'none';
    }
}
