let globalUserId = null;

// Sample queue and processing
let sampleQueue = [];
let isProcessing = false;
let retryQueue = [];
let maxRetries = 3;
let retryDelay = 5000; // 5 seconds

function initializeUserId() {
    browser.storage.sync.get(['userId']).then((result) => {
        if (!result.userId) {
            // Generate new userId if none exists
            const newUserId = Math.random().toString(36).substring(2);
            browser.storage.sync.set({ userId: newUserId }).then(() => {
                console.log('[MouseSpy] Generated new userId:', newUserId);
                globalUserId = newUserId;
            });
        } else {
            console.log('[MouseSpy] Using existing userId:', result.userId);
            globalUserId = result.userId;
        }
    });
}

initializeUserId();

// Process sample queue
async function processSampleQueue() {
    if (isProcessing || sampleQueue.length === 0) {
        return;
    }
    
    isProcessing = true;
    console.log(`[MouseSpy] Processing ${sampleQueue.length} samples`);
    
    while (sampleQueue.length > 0) {
        const sample = sampleQueue.shift();
        await submitSample(sample);
        
        // Small delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    isProcessing = false;
    
    // Process retry queue if there are failed samples
    if (retryQueue.length > 0) {
        setTimeout(processRetryQueue, retryDelay);
    }
}

// Submit a single sample as a separate request
async function submitSample(sample) {
    if (!globalUserId) {
        console.warn('[MouseSpy] No userId available, skipping sample');
        return;
    }
    
    // Get API endpoint from storage
    const result = await browser.storage.sync.get(['apiEndpoint']);
    const apiEndpoint = result.apiEndpoint;
    
    if (!apiEndpoint) {
        console.warn('[MouseSpy] No API endpoint configured, skipping sample');
        return;
    }
    
    try {
        console.log(`[MouseSpy] Submitting sample with ${sample.events.length} events to ${apiEndpoint}`);
        
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: globalUserId,
                mouseData: sample.events,
            }),
        });
        
        if (response.ok) {
            console.log('[MouseSpy] Sample submitted successfully');
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('[MouseSpy] Failed to submit sample:', error.message);
        
        // Add to retry queue
        sample.retryCount = (sample.retryCount || 0) + 1;
        if (sample.retryCount <= maxRetries) {
            retryQueue.push(sample);
            console.log(`[MouseSpy] Added sample to retry queue (attempt ${sample.retryCount}/${maxRetries})`);
        } else {
            console.error('[MouseSpy] Sample failed after max retries, discarding');
        }
    }
}

// Process retry queue with exponential backoff
async function processRetryQueue() {
    if (retryQueue.length === 0) {
        return;
    }
    
    console.log(`[MouseSpy] Processing ${retryQueue.length} retry samples`);
    
    const currentRetryQueue = [...retryQueue];
    retryQueue = [];
    
    for (const sample of currentRetryQueue) {
        await submitSample(sample);
        await new Promise(resolve => setTimeout(resolve, 200)); // Longer delay for retries
    }
    
    // If there are still retries, schedule next attempt with longer delay
    if (retryQueue.length > 0) {
        const nextDelay = Math.min(retryDelay * 2, 30000); // Max 30 seconds
        setTimeout(processRetryQueue, nextDelay);
    }
}

// Handle messages from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.debug("[MouseSpy] Received message:", message.type);
    
    if (message.type === "mouseSample") {
        // Add sample to queue
        sampleQueue.push(message.data);
        console.log(`[MouseSpy] Added sample to queue (${sampleQueue.length} pending)`);
        
        // Process queue if not already processing
        if (!isProcessing) {
            processSampleQueue();
        }
        
        sendResponse({ success: true });
        
    } else if (message.type === "updateApiEndpoint") {
        browser.storage.sync.set({ apiEndpoint: message.endpoint }).then(() => {
            console.log('[MouseSpy] Updated API endpoint:', message.endpoint);
            sendResponse({ success: true });
        });
        return true; // Keep message channel open for async response
        
    } else if (message.type === "getApiEndpoint") {
        browser.storage.sync.get(['apiEndpoint']).then((result) => {
            sendResponse({ endpoint: result.apiEndpoint || '' });
        });
        return true; // Keep message channel open for async response
        
    } else if (message.type === "getStatus") {
        browser.storage.sync.get(['apiEndpoint']).then((result) => {
            sendResponse({
                userId: globalUserId,
                apiEndpoint: result.apiEndpoint || '',
                queueLength: sampleQueue.length,
                retryLength: retryQueue.length,
                isProcessing: isProcessing
            });
        });
        return true; // Keep message channel open for async response

    }
});

// Periodic cleanup and status check
setInterval(() => {
    // Log status every 30 seconds
    console.log(`[MouseSpy] Status - Queue: ${sampleQueue.length}, Retries: ${retryQueue.length}, Processing: ${isProcessing}`);
    
    // Process queue if there are pending samples
    if (sampleQueue.length > 0 && !isProcessing) {
        processSampleQueue();
    }
}, 30000);

// Handle extension startup
browser.runtime.onStartup.addListener(() => {
    console.log('[MouseSpy] Extension started');
    initializeUserId();
});

// Handle extension installation
browser.runtime.onInstalled.addListener(() => {
    console.log('[MouseSpy] Extension installed');
    initializeUserId();
});