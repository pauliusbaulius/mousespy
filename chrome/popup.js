document.addEventListener('DOMContentLoaded', function() {
    const apiEndpointInput = document.getElementById('apiEndpoint');
    const updateEndpointButton = document.getElementById('updateEndpointButton');
    const statusDiv = document.getElementById('status');

    // Load current configuration
    loadExtensionStatus();

    // Health check function to test API endpoint
    async function testApiEndpoint(endpoint) {
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                return { success: true, status: response.status };
            } else {
                return { success: false, status: response.status, error: `HTTP ${response.status}` };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Load extension status
    function loadExtensionStatus() {
        chrome.runtime.sendMessage({ type: "getStatus" }, (response) => {
            if (response) {
                // Update API endpoint only if input is empty or not focused
                if (response.apiEndpoint && (!apiEndpointInput.value || !apiEndpointInput.matches(':focus'))) {
                    apiEndpointInput.value = response.apiEndpoint;
                }
            } else {
                showStatus('Failed to load extension status', 'error');
            }
        });
    }



    // Update endpoint button click handler
    updateEndpointButton.addEventListener('click', async function() {
        const newEndpoint = apiEndpointInput.value.trim();
        
        // Validate inputs
        if (!newEndpoint) {
            showStatus('Please enter a valid API endpoint', 'error');
            return;
        }

        // Validate URL format
        try {
            new URL(newEndpoint);
        } catch (e) {
            showStatus('Please enter a valid URL', 'error');
            return;
        }

        // Disable update button and show testing status
        updateEndpointButton.disabled = true;
        updateEndpointButton.textContent = 'Testing...';
        showStatus('Testing API endpoint...', 'info');

        // Test the API endpoint
        const testResult = await testApiEndpoint(newEndpoint);
        
        if (!testResult.success) {
            showStatus(`API endpoint test failed: ${testResult.error}`, 'error');
            updateEndpointButton.disabled = false;
            updateEndpointButton.textContent = 'Update';
            return;
        }

        // If test passes, save the endpoint
        chrome.runtime.sendMessage({ 
            type: "updateApiEndpoint", 
            endpoint: newEndpoint 
        }, (response) => {
            if (response && response.success) {
                showStatus(`API endpoint updated successfully! (Status: ${testResult.status})`, 'success');
                loadExtensionStatus(); // Refresh status
            } else {
                showStatus('Failed to update API endpoint', 'error');
            }
            updateEndpointButton.disabled = false;
            updateEndpointButton.textContent = 'Update';
        });
    });



    // Refresh status every 2 seconds
    setInterval(loadExtensionStatus, 2000);

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = 'status ' + type;
        statusDiv.style.display = 'block';
        
        // Hide status after 5 seconds for success/error, keep info visible
        if (type !== 'info') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    }
}); 