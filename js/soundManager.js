export class SoundManager {
    constructor() {
        // Initialize audio context
        this.audioContext = null;
        this.masterGain = null;
        this.isMuted = false;
        
        // Sound buffers
        this.sounds = {
            kick: null,
            goal: null,
            whistle: null,
            crowd: null,
            gameOver: null,
            miss: null  // Add miss sound
        };
        
        // Background sounds
        this.backgroundSounds = {
            crowd: null
        };
        
        // Initialize audio
        this.initAudio();
    }
    
    initAudio() {
        // Create audio context when user interacts with the page
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.setupAudioContext();
                this.loadSounds();
            }
        }, { once: true });
    }
    
    setupAudioContext() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create master gain node
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.5; // Default volume
            this.masterGain.connect(this.audioContext.destination);
            
            console.log('Audio context initialized');
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
        }
    }
    
    loadSounds() {
        // Don't try to load sounds if audio context isn't available
        if (!this.audioContext) return;
        
        // Load all sound effects programmatically
        this.loadKickSound();
        this.loadGoalSound();
        this.loadWhistleSound();
        this.loadCrowdSound();
        this.loadGameOverSound();
        this.loadMissSound();  // Add loading miss sound
    }
    
    // Create sounds with oscillators and audio processing
    loadKickSound() {
        // Create a short percussive sound for ball kicks
        const kickBuffer = this.createBuffer(0.3);
        const channels = kickBuffer.numberOfChannels;
        
        for (let channel = 0; channel < channels; channel++) {
            const data = kickBuffer.getChannelData(channel);
            
            // Create a punchy percussive sound
            for (let i = 0; i < data.length; i++) {
                // Sharp attack, quick decay
                const t = i / kickBuffer.sampleRate;
                const envelope = Math.exp(-20 * t);
                
                // Add some noise for texture
                const noise = Math.random() * 2 - 1;
                
                // Combine for final sound
                data[i] = noise * envelope * 0.8;
            }
        }
        
        this.sounds.kick = kickBuffer;
    }
    
    loadGoalSound() {
        // Create a triumphant sound for goals
        const goalBuffer = this.createBuffer(1.0);
        const channels = goalBuffer.numberOfChannels;
        
        for (let channel = 0; channel < channels; channel++) {
            const data = goalBuffer.getChannelData(channel);
            
            // Create a more complex sound with multiple frequencies
            for (let i = 0; i < data.length; i++) {
                const t = i / goalBuffer.sampleRate;
                
                // Use multiple frequencies for a rich sound
                const freq1 = 440; // A4
                const freq2 = 554.37; // C#5
                const freq3 = 659.25; // E5
                
                // Create a chord with attack and decay
                const envelope = Math.exp(-3 * t);
                const tone1 = Math.sin(2 * Math.PI * freq1 * t);
                const tone2 = Math.sin(2 * Math.PI * freq2 * t) * 0.8;
                const tone3 = Math.sin(2 * Math.PI * freq3 * t) * 0.6;
                
                // Combine for final sound
                data[i] = (tone1 + tone2 + tone3) * envelope * 0.3;
            }
        }
        
        this.sounds.goal = goalBuffer;
    }
    
    loadWhistleSound() {
        // Create a referee whistle sound
        const whistleBuffer = this.createBuffer(0.5);
        const channels = whistleBuffer.numberOfChannels;
        
        for (let channel = 0; channel < channels; channel++) {
            const data = whistleBuffer.getChannelData(channel);
            
            // Create a whistle-like sound
            for (let i = 0; i < data.length; i++) {
                const t = i / whistleBuffer.sampleRate;
                
                // Whistle frequency with some frequency modulation
                const baseFreq = 3000;
                const modFreq = 30;
                const modDepth = 200;
                
                const modulation = modDepth * Math.sin(2 * Math.PI * modFreq * t);
                const freq = baseFreq + modulation;
                
                // Add some noise for realism
                const noise = Math.random() * 0.1;
                const tone = Math.sin(2 * Math.PI * freq * t);
                
                // Envelope for attack and decay
                let envelope;
                if (t < 0.1) {
                    envelope = t / 0.1; // Attack
                } else {
                    envelope = Math.exp(-3 * (t - 0.1)); // Decay
                }
                
                // Combine for final sound
                data[i] = (tone * 0.9 + noise) * envelope * 0.5;
            }
        }
        
        this.sounds.whistle = whistleBuffer;
    }
    
    loadCrowdSound() {
        // Create crowd ambient sound
        const crowdBuffer = this.createBuffer(4.0);
        const channels = crowdBuffer.numberOfChannels;
        
        for (let channel = 0; channel < channels; channel++) {
            const data = crowdBuffer.getChannelData(channel);
            
            // Create a continuous ambient crowd noise
            for (let i = 0; i < data.length; i++) {
                const t = i / crowdBuffer.sampleRate;
                
                // Use filtered noise for crowd effect
                let noise = 0;
                
                // Sum multiple noise components for a richer sound
                for (let j = 1; j <= 5; j++) {
                    noise += (Math.random() * 2 - 1) * (1 / j);
                }
                
                // Add some slow modulation to make it sound more natural
                const modulation = 0.3 * Math.sin(2 * Math.PI * 0.2 * t) + 
                                  0.2 * Math.sin(2 * Math.PI * 0.5 * t) +
                                  0.1 * Math.sin(2 * Math.PI * 1.2 * t);
                
                // Combine for final sound
                data[i] = noise * (0.2 + modulation * 0.1) * 0.3;
            }
        }
        
        this.sounds.crowd = crowdBuffer;
    }
    
    loadGameOverSound() {
        // Create game over sound
        const gameOverBuffer = this.createBuffer(2.0);
        const channels = gameOverBuffer.numberOfChannels;
        
        for (let channel = 0; channel < channels; channel++) {
            const data = gameOverBuffer.getChannelData(channel);
            
            // Create a descending tone sequence
            for (let i = 0; i < data.length; i++) {
                const t = i / gameOverBuffer.sampleRate;
                
                // Descending tones
                const freq1Start = 440;
                const freq1End = 220;
                const freq1 = freq1Start - (freq1Start - freq1End) * (t / 2);
                
                // Second tone for richness
                const freq2 = freq1 * 1.5;
                
                const tone1 = Math.sin(2 * Math.PI * freq1 * t);
                const tone2 = Math.sin(2 * Math.PI * freq2 * t) * 0.5;
                
                // Envelope for the sound
                const envelope = Math.exp(-1.5 * t);
                
                // Combine for final sound
                data[i] = (tone1 + tone2) * envelope * 0.3;
            }
        }
        
        this.sounds.gameOver = gameOverBuffer;
    }
    
    // Add new method to load miss sound
    loadMissSound() {
        if (!this.audioContext) return;
        
        // Create a short buffer for miss sound
        const buffer = this.createBuffer(0.5);
        
        // Get audio data
        const channelData = [
            buffer.getChannelData(0),
            buffer.getChannelData(1)
        ];
        
        // Generate a short "swoosh" sound for miss
        const sampleRate = this.audioContext.sampleRate;
        
        for (let i = 0; i < buffer.length; i++) {
            // Create falling tone sound
            const t = i / sampleRate;
            const frequency = 400 - 200 * t;
            const amplitude = 0.5 * Math.max(0, 1 - t * 4);
            
            // Generate stereo sound with slight phase difference
            const value = amplitude * Math.sin(frequency * t * Math.PI * 2);
            
            // Apply to both channels with slight offset
            channelData[0][i] = value;
            channelData[1][i] = value * 0.8;
        }
        
        // Store buffer
        this.sounds.miss = buffer;
    }
    
    // Helper method to create an audio buffer
    createBuffer(duration) {
        const sampleRate = this.audioContext.sampleRate;
        const bufferSize = sampleRate * duration;
        return this.audioContext.createBuffer(2, bufferSize, sampleRate);
    }
    
    // Play a sound with specified parameters
    playSound(soundName, volume = 1.0, pitch = 1.0) {
        if (!this.audioContext || this.isMuted) return;
        
        const buffer = this.sounds[soundName];
        if (!buffer) return;
        
        // Create source node
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        
        // Set playback rate for pitch adjustment
        source.playbackRate.value = pitch;
        
        // Create gain node for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume;
        
        // Connect nodes
        source.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        // Play the sound
        source.start();
        
        return source;
    }
    
    // Play continuous crowd ambient sound
    playCrowdAmbience(volume = 0.2) {
        if (!this.audioContext || this.isMuted || this.backgroundSounds.crowd) return;
        
        const buffer = this.sounds.crowd;
        if (!buffer) return;
        
        // Create source node
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        
        // Create gain node for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume;
        
        // Connect nodes
        source.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        // Play the sound
        source.start();
        
        // Store reference to the crowd sound
        this.backgroundSounds.crowd = {
            source: source,
            gain: gainNode
        };
    }
    
    stopCrowdAmbience() {
        if (this.backgroundSounds.crowd) {
            try {
                this.backgroundSounds.crowd.source.stop();
            } catch (e) {
                console.warn('Error stopping crowd sound:', e);
            }
            this.backgroundSounds.crowd = null;
        }
    }
    
    // Convenience methods for specific game sounds
    playKickSound() {
        // Randomize pitch slightly for variety
        const pitch = 0.9 + Math.random() * 0.2;
        return this.playSound('kick', 0.7, pitch);
    }
    
    playGoalSound() {
        this.playSound('goal', 1.0, 1.0);
        this.playSound('whistle', 0.7, 1.0);
    }
    
    playWhistleSound() {
        return this.playSound('whistle', 0.7, 1.0);
    }
    
    playGameOverSound() {
        return this.playSound('gameOver', 0.8, 1.0);
    }
    
    // Add method to play miss sound
    playMissSound() {
        // Randomize pitch slightly for variety
        const pitch = 0.95 + Math.random() * 0.1;
        return this.playSound('miss', 0.5, pitch);
    }
    
    setMasterVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }
    
    mute() {
        this.isMuted = true;
        if (this.masterGain) {
            this.masterGain.gain.value = 0;
        }
    }
    
    unmute() {
        this.isMuted = false;
        if (this.masterGain) {
            this.masterGain.gain.value = 0.5;
        }
    }
} 