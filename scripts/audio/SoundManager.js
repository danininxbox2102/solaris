class AudioChannel {
    constructor(context, name, volume = 1) {
        this.context = context;
        this.name = name;
        this.gainNode = context.createGain();
        this.volume = volume;
        this.isMuted = false;

        this.gainNode.gain.value = volume;
        this.gainNode.connect(context.destination);
    }

    get input() {
        return this.gainNode;
    }

    setVolume(volume) {
        this.volume = clampVolume(volume);
        this.applyVolume();
    }

    mute() {
        this.isMuted = true;
        this.applyVolume();
    }

    unmute() {
        this.isMuted = false;
        this.applyVolume();
    }

    applyVolume() {
        this.gainNode.gain.value = this.isMuted ? 0 : this.volume;
    }

    dispose() {
        this.gainNode.disconnect();
    }
}

class SoundAsset {
    constructor({ id, url, type = 'sfx', volume = 1, loop = false }) {
        if (!id) {
            throw new Error('Sound asset requires an id.');
        }

        if (!url) {
            throw new Error(`Sound asset "${id}" requires an url.`);
        }

        this.id = id;
        this.url = url;
        this.type = type;
        this.volume = clampVolume(volume);
        this.loop = loop;
        this.buffer = null;
        this.loadingPromise = null;
    }

    async load(context) {
        if (this.buffer) {
            return this.buffer;
        }

        if (!this.loadingPromise) {
            this.loadingPromise = fetch(this.url)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Failed to load sound "${this.id}" from ${this.url}.`);
                    }

                    return response.arrayBuffer();
                })
                .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
                .then((buffer) => {
                    this.buffer = buffer;
                    return buffer;
                })
                .finally(() => {
                    this.loadingPromise = null;
                });
        }

        return this.loadingPromise;
    }
}

class SoundInstance {
    constructor({ context, buffer, output, volume = 1, loop = false, onEnded }) {
        this.context = context;
        this.source = context.createBufferSource();
        this.gainNode = context.createGain();
        this.isStopped = false;
        this.onEnded = onEnded;

        this.source.buffer = buffer;
        this.source.loop = loop;
        this.gainNode.gain.value = clampVolume(volume);

        this.source.connect(this.gainNode);
        this.gainNode.connect(output);

        this.source.addEventListener('ended', () => {
            this.dispose();

            if (this.onEnded) {
                this.onEnded(this);
            }
        }, { once: true });
    }

    start({ offset = 0, fadeIn = 0 } = {}) {
        if (fadeIn > 0) {
            this.fadeTo(this.gainNode.gain.value, fadeIn, 0);
        }

        this.source.start(0, offset);
        return this;
    }

    stop({ fadeOut = 0 } = {}) {
        if (this.isStopped) {
            return;
        }

        this.isStopped = true;

        if (fadeOut > 0) {
            this.fadeTo(0, fadeOut);
            this.source.stop(this.context.currentTime + fadeOut);
            return;
        }

        this.source.stop();
    }

    setVolume(volume) {
        this.gainNode.gain.value = clampVolume(volume);
    }

    fadeTo(targetVolume, duration, fromVolume = this.gainNode.gain.value) {
        const gain = this.gainNode.gain;
        const now = this.context.currentTime;

        gain.cancelScheduledValues(now);
        gain.setValueAtTime(clampVolume(fromVolume), now);
        gain.linearRampToValueAtTime(clampVolume(targetVolume), now + Math.max(duration, 0));
    }

    dispose() {
        this.source.disconnect();
        this.gainNode.disconnect();
    }
}

class MusicController {
    constructor(soundManager) {
        this.soundManager = soundManager;
        this.instancesById = new Map();
        this.playingIds = new Set();
        this.pendingPlayTokens = new Map();
    }

    async play(id, { restart = false, fadeIn = 0.5, fadeOut = 0.5, volume } = {}) {
        const current = this.instancesById.get(id);

        if (current && !restart) {
            return current;
        }

        if (restart) {
            this.stop(id, { fadeOut });
        }

        const playToken = Symbol(id);
        this.pendingPlayTokens.set(id, playToken);

        const instance = await this.soundManager.createInstance(id, {
            channelName: 'music',
            loop: true,
            volume,
            fadeIn
        });

        if (this.pendingPlayTokens.get(id) !== playToken) {
            instance.dispose();
            return null;
        }

        this.pendingPlayTokens.delete(id);
        this.instancesById.set(id, instance);
        this.playingIds.add(id);
        return instance.start({ fadeIn });
    }

    stop(idOrOptions, options) {
        const { id, stopOptions } = normalizeStopArguments(idOrOptions, options, { fadeOut: 0.5 });

        if (!id) {
            return this.stopAll(stopOptions);
        }

        this.pendingPlayTokens.delete(id);

        const current = this.instancesById.get(id);

        if (!current) {
            return false;
        }

        current.stop(stopOptions);
        this.instancesById.delete(id);
        this.playingIds.delete(id);
        return true;
    }

    stopAll(options = {}) {
        const stoppedCount = this.instancesById.size;

        this.pendingPlayTokens.clear();

        for (const instance of this.instancesById.values()) {
            instance.stop(options);
        }

        this.instancesById.clear();
        this.playingIds.clear();
        return stoppedCount;
    }
}

class SfxController {
    constructor(soundManager) {
        this.soundManager = soundManager;
        this.instances = new Set();
        this.instancesById = new Map();
    }

    async play(id, { volume, loop = false } = {}) {
        const instance = await this.soundManager.createInstance(id, {
            channelName: 'sfx',
            volume,
            loop,
            onEnded: (endedInstance) => this.removeInstance(id, endedInstance)
        });

        this.instances.add(instance);
        this.addInstance(id, instance);
        return instance.start();
    }

    stop(idOrOptions, options) {
        const { id, stopOptions } = normalizeStopArguments(idOrOptions, options);

        if (!id) {
            return this.stopAll(stopOptions);
        }

        const instances = this.instancesById.get(id);

        if (!instances) {
            return 0;
        }

        const stoppedCount = instances.size;

        for (const instance of instances) {
            instance.stop(stopOptions);
            this.instances.delete(instance);
        }

        this.instancesById.delete(id);
        return stoppedCount;
    }

    stopAll(options = {}) {
        const stoppedCount = this.instances.size;

        for (const instance of this.instances) {
            instance.stop(options);
        }

        this.instances.clear();
        this.instancesById.clear();
        return stoppedCount;
    }

    addInstance(id, instance) {
        if (!this.instancesById.has(id)) {
            this.instancesById.set(id, new Set());
        }

        this.instancesById.get(id).add(instance);
    }

    removeInstance(id, instance) {
        this.instances.delete(instance);

        const instances = this.instancesById.get(id);

        if (!instances) {
            return;
        }

        instances.delete(instance);

        if (instances.size === 0) {
            this.instancesById.delete(id);
        }
    }
}

export class SoundManager {
    constructor({ masterVolume = 1, musicVolume = 0.75, sfxVolume = 1 } = {}) {
        this.context = this.createAudioContext();
        this.master = new AudioChannel(this.context, 'master', masterVolume);
        this.channels = new Map([
            ['music', new AudioChannel(this.context, 'music', musicVolume)],
            ['sfx', new AudioChannel(this.context, 'sfx', sfxVolume)]
        ]);
        this.assets = new Map();
        this.music = new MusicController(this);
        this.sfx = new SfxController(this);
        this.isUnlocked = false;

        for (const channel of this.channels.values()) {
            channel.input.disconnect();
            channel.input.connect(this.master.input);
        }
    }

    register(id, options) {
        const asset = new SoundAsset({ id, ...options });
        this.assets.set(id, asset);
        return asset;
    }

    registerMany(manifest = {}) {
        for (const [id, options] of Object.entries(manifest)) {
            this.register(id, options);
        }
    }

    async load(id) {
        return this.getAsset(id).load(this.context);
    }

    async loadAll() {
        return Promise.all([...this.assets.keys()].map((id) => this.load(id)));
    }

    async playMusic(id, options) {
        await this.unlock();
        return this.music.play(id, options);
    }

    stopMusic(idOrOptions, options) {
        return this.music.stop(idOrOptions, options);
    }

    async playSfx(id, options) {
        await this.unlock();
        return this.sfx.play(id, options);
    }

    stopSfx(idOrOptions, options) {
        return this.sfx.stop(idOrOptions, options);
    }

    setMasterVolume(volume) {
        this.master.setVolume(volume);
    }

    setMusicVolume(volume) {
        this.getChannel('music').setVolume(volume);
    }

    setSfxVolume(volume) {
        this.getChannel('sfx').setVolume(volume);
    }

    mute(channelName) {
        if (channelName) {
            this.getChannel(channelName).mute();
            return;
        }

        this.master.mute();
    }

    unmute(channelName) {
        if (channelName) {
            this.getChannel(channelName).unmute();
            return;
        }

        this.master.unmute();
    }

    installUnlockListeners(target = window) {
        const unlock = () => this.unlock();
        const options = { once: true, passive: true };

        target.addEventListener('pointerdown', unlock, options);
        target.addEventListener('keydown', unlock, { once: true });
        target.addEventListener('touchstart', unlock, options);
    }

    async unlock() {
        if (this.isUnlocked) {
            return;
        }

        if (this.context.state === 'suspended') {
            await this.context.resume();
        }

        this.isUnlocked = true;
    }

    async createInstance(id, { channelName, volume, loop, fadeIn, onEnded } = {}) {
        const asset = this.getAsset(id);
        const buffer = await asset.load(this.context);
        const channel = this.getChannel(channelName ?? asset.type);

        return new SoundInstance({
            context: this.context,
            buffer,
            output: channel.input,
            volume: volume ?? asset.volume,
            loop: loop ?? asset.loop,
            fadeIn,
            onEnded
        });
    }

    getAsset(id) {
        const asset = this.assets.get(id);

        if (!asset) {
            throw new Error(`Sound asset "${id}" is not registered.`);
        }

        return asset;
    }

    getChannel(name) {
        const channel = this.channels.get(name);

        if (!channel) {
            throw new Error(`Unknown audio channel "${name}".`);
        }

        return channel;
    }

    createAudioContext() {
        const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;

        if (!AudioContextConstructor) {
            throw new Error('Web Audio API is not supported in this browser.');
        }

        return new AudioContextConstructor();
    }

    dispose() {
        this.stopMusic({ fadeOut: 0 });
        this.stopSfx();

        for (const channel of this.channels.values()) {
            channel.dispose();
        }

        this.master.dispose();
        this.context.close();
    }
}

function clampVolume(volume) {
    return Math.min(Math.max(volume, 0), 1);
}

function normalizeStopArguments(idOrOptions, options, defaults = {}) {
    if (typeof idOrOptions === 'string') {
        return {
            id: idOrOptions,
            stopOptions: { ...defaults, ...options }
        };
    }

    return {
        id: null,
        stopOptions: { ...defaults, ...idOrOptions }
    };
}
