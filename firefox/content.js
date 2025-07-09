// Mouse data sampling system
class MouseDataSampler {
    constructor() {
        this.currentSample = {
            events: [],
            startTime: null,
            domain: window.location.hostname,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        };
        
        // Fixed sampling configuration
        this.sampleDuration = 5000; // 5 seconds per sample
        this.sleepDuration = 60000; // 60 seconds sleep
        this.isActive = true;
        this.isSampling = true;
        this.isPageVisible = true;
        
        // Start the first sample
        this.startNewSample();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up sample timer
        this.sampleTimer = setInterval(() => {
            this.finalizeCurrentSample();
        }, this.sampleDuration);
        
        console.log('[MouseSpy] Content script initialized with fixed sampling (5s sample, 60s sleep)');
    }
    

    
    setupEventListeners() {
        // Capture all mouse events
        document.addEventListener('mousemove', (event) => this.captureEvent(event), { passive: true });
        document.addEventListener('click', (event) => this.captureEvent(event), { passive: true });
        document.addEventListener('scroll', (event) => this.captureEvent(event), { passive: true });
        
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            if (document.hidden) {
                this.handlePageHidden();
            } else {
                this.handlePageVisible();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.currentSample.viewportWidth = window.innerWidth;
            this.currentSample.viewportHeight = window.innerHeight;
        });
        
        // Handle page unload (navigation, close, refresh)
        window.addEventListener('beforeunload', () => {
            this.handlePageUnload();
        });
        
        // Handle page focus/blur (tab switching)
        window.addEventListener('focus', () => {
            this.handlePageFocus();
        });
        
        window.addEventListener('blur', () => {
            this.handlePageBlur();
        });
    }
    
    captureEvent(event) {
        if (!this.isActive || !this.isSampling || !this.isPageVisible) return;
        
        const eventData = this.formatEvent(event);
        this.currentSample.events.push(eventData);
    }
    
    formatEvent(event) {
        const baseData = {
            timestamp: new Date().toISOString(),
            type: event.type,
            domain: window.location.hostname,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        };
        
        switch (event.type) {
            case 'mousemove':
                return {
                    ...baseData,
                    x: event.clientX,
                    y: event.clientY,
                };
                
            case 'click':
                return {
                    ...baseData,
                    x: event.clientX,
                    y: event.clientY,
                };
                
            case 'scroll':
                return {
                    ...baseData,
                    x: document.documentElement.scrollLeft,
                    y: document.documentElement.scrollTop,
                };
                
            default:
                console.debug("Unknown event type:", event.type);
                return null;
        }
    }
    
    startNewSample() {
        this.currentSample = {
            events: [],
            startTime: new Date().toISOString(),
            domain: window.location.hostname,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        };
        
        console.debug('[MouseSpy] Started new sample');
    }
    
    finalizeCurrentSample() {
        if (!this.isActive) {
            this.startNewSample();
            return;
        }
        
        if (this.isSampling) {
            // Finalize current sample if it has events
            if (this.currentSample.events.length > 0) {
                const endTime = new Date();
                const startTime = new Date(this.currentSample.startTime);
                const durationSeconds = (endTime - startTime) / 1000;
                
                this.currentSample.endTime = endTime.toISOString();
                this.currentSample.eventCount = this.currentSample.events.length;
                this.currentSample.durationSeconds = durationSeconds;
                
                console.debug(`[MouseSpy] Finalizing sample with ${this.currentSample.events.length} events (${durationSeconds.toFixed(1)}s)`);
                this.sendSampleToBackground(this.currentSample);
            }
            
            // Start sleep period
            this.startSleepPeriod();
        } else {
            // End sleep period and start new sample
            this.startSamplingPeriod();
        }
    }
    
    startSleepPeriod() {
        this.isSampling = false;
        console.log(`[MouseSpy] Entering sleep period for ${this.sleepDuration/1000} seconds`);
        
        // Update timer for sleep duration
        clearInterval(this.sampleTimer);
        this.sampleTimer = setInterval(() => {
            this.finalizeCurrentSample();
        }, this.sleepDuration);
    }
    
    startSamplingPeriod() {
        this.isSampling = true;
        console.log(`[MouseSpy] Starting sampling period for ${this.sampleDuration/1000} seconds`);
        
        // Start new sample
        this.startNewSample();
        
        // Update timer for sample duration
        clearInterval(this.sampleTimer);
        this.sampleTimer = setInterval(() => {
            this.finalizeCurrentSample();
        }, this.sampleDuration);
    }
    
    sendSampleToBackground(sample) {
        if (browser.runtime && browser.runtime.id) {
            try {
                browser.runtime.sendMessage({ 
                    type: "mouseSample", 
                    data: sample 
                }).then((response) => {
                    // Response handling if needed
                }).catch((error) => {
                    console.debug("Extension context error:", error.message);
                });
            } catch (error) {
                console.debug("Failed to send sample to extension:", error.message);
            }
        } else {
            console.debug("Extension context is invalid, skipping sample send");
        }
    }
    
    // Handle page becoming hidden (tab switch, minimize)
    handlePageHidden() {
        console.debug('[MouseSpy] Page hidden - pausing sampling');
        this.isActive = false;
        
        // Immediately finalize current sample if we have events
        if (this.isSampling && this.currentSample.events.length > 0) {
            this.forceFinalizeSample();
        }
    }
    
    // Handle page becoming visible (tab switch back, restore)
    handlePageVisible() {
        console.debug('[MouseSpy] Page visible - resuming sampling');
        this.isActive = true;
        
        // If we were in a sample period, continue it
        // If we were in sleep, continue the sleep
        // The timer will handle the next transition
    }
    
    // Handle page unload (navigation, close, refresh)
    handlePageUnload() {
        console.debug('[MouseSpy] Page unloading - finalizing sample');
        
        // Immediately finalize current sample if we have events
        if (this.isSampling && this.currentSample.events.length > 0) {
            this.forceFinalizeSample();
        }
        
        // Clean up timers
        if (this.sampleTimer) {
            clearInterval(this.sampleTimer);
        }
    }
    
    // Handle page focus (tab becomes active)
    handlePageFocus() {
        console.debug('[MouseSpy] Page focused');
        this.isPageVisible = true;
    }
    
    // Handle page blur (tab becomes inactive)
    handlePageBlur() {
        console.debug('[MouseSpy] Page blurred');
        this.isPageVisible = false;
    }
    
    // Force finalize sample immediately (for page unload/hidden)
    forceFinalizeSample() {
        if (this.currentSample.events.length === 0) {
            console.debug('[MouseSpy] No events to finalize, discarding sample');
            return;
        }
        
        // Calculate sample duration
        const startTime = new Date(this.currentSample.startTime);
        const endTime = new Date();
        const durationMs = endTime - startTime;
        const durationSeconds = durationMs / 1000;
        
        // Minimum sample duration (2 seconds) to consider it worth keeping
        const minSampleDuration = 2;
        
        if (durationSeconds >= minSampleDuration) {
            this.currentSample.endTime = endTime.toISOString();
            this.currentSample.eventCount = this.currentSample.events.length;
            this.currentSample.durationSeconds = durationSeconds;
            this.currentSample.forced = true; // Mark as forced finalization
            
            console.debug(`[MouseSpy] Force finalizing sample with ${this.currentSample.events.length} events (${durationSeconds.toFixed(1)}s)`);
            this.sendSampleToBackground(this.currentSample);
        } else {
            console.debug(`[MouseSpy] Discarding short sample (${durationSeconds.toFixed(1)}s < ${minSampleDuration}s)`);
        }
    }
    
    pauseSampling() {
        this.isActive = false;
        console.debug('[MouseSpy] Sampling paused (page hidden)');
    }
    
    resumeSampling() {
        this.isActive = true;
        console.debug('[MouseSpy] Sampling resumed (page visible)');
    }
    

    
    destroy() {
        // Force finalize current sample before destroying
        if (this.isSampling && this.currentSample.events.length > 0) {
            this.forceFinalizeSample();
        }
        
        // Clear timer
        if (this.sampleTimer) {
            clearInterval(this.sampleTimer);
        }
        
        // Remove event listeners
        document.removeEventListener('mousemove', this.captureEvent);
        document.removeEventListener('click', this.captureEvent);
        document.removeEventListener('scroll', this.captureEvent);
        
        console.log('[MouseSpy] Content script destroyed');
    }
}

// Initialize the sampler when the script loads
const mouseSampler = new MouseDataSampler();
