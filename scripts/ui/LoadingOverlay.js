export class LoadingOverlay {
    constructor(selector) {
        this.element = document.querySelector(selector);
    }

    setProgress(progress) {
        this.setMessage(`Загрузка... ${progress}%`);
    }

    setMessage(message) {
        if (!this.element) {
            return;
        }

        this.element.style.display = 'block';
        this.element.textContent = message;
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
