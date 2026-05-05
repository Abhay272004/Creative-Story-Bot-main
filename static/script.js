// ============================================
// State Management
// ============================================
let sessionId = null;
let messageCount = 0;
let currentLayer = 'chat';
let conversationHistory = [];
let isWaitingForResponse = false;

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    initializeSession();
    loadRecentChats();
    setupEventListeners();
    attachSliderListeners();
});

// ============================================
// Session Management
// ============================================
async function loadRecentChats() {
    try {
        const response = await fetch('/api/get-all-sessions');
        const data = await response.json();
        if (data.status === 'success') {
            const pagesList = document.getElementById('pagesList');
            if (!pagesList) return;
            pagesList.innerHTML = '';
            data.sessions.forEach(session => {
                const btn = document.createElement('button');
                btn.className = 'nav-item page-item';
                btn.onclick = () => loadSession(session.id);
                const dateStart = new Date(session.created_at).toLocaleDateString();
                btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg><span>${dateStart} - ${session.id.substring(0, 6)}</span>`;
                pagesList.appendChild(btn);
            });
        }
    } catch (error) {
        console.error('Failed to load recent chats:', error);
    }
}

async function loadSession(targetSessionId) {
    try {
        const response = await fetch(`/api/get-session?session_id=${targetSessionId}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            sessionId = targetSessionId;
            conversationHistory = data.history;
            messageCount = Math.floor(conversationHistory.length / 2);
            
            // UI cleanup
            const messagesContainer = document.getElementById('messages');
            messagesContainer.innerHTML = '';
            
            // Re-render
            conversationHistory.forEach((msg, i) => {
                addMessage(msg.content, msg.role === 'user' ? 'user' : 'bot', i);
            });
            
            updateMessageCount();
            switchView('chat'); // Assuming a switchView implementation exists
        }
    } catch (err) {
        console.error('Failed to load session:', err);
    }
}

async function initializeSession() {
    try {
        const response = await fetch('/api/new-session', { method: 'POST' });
        const data = await response.json();
        sessionId = data.session_id;
        updateSessionNumber(1);
    } catch (error) {
        console.error('Session initialization failed:', error);
    }
}

function updateSessionNumber(num) {
    const sessionEl = document.getElementById('sessionNumber');
    if (sessionEl) {
        sessionEl.textContent = `Session ${num}`;
    }
}

function startNewChat() {
    conversationHistory = [];
    messageCount = 0;
    document.getElementById('messages').innerHTML = '';
    document.getElementById('messageCount').textContent = '0';
    initializeSession();
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    const userInput = document.getElementById('userInput');
    const chatForm = document.getElementById('chatForm');

    if (chatForm) {
        chatForm.addEventListener('submit', (e) => sendMessage(e));
    }

    if (userInput) {
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
            }
        });
    }
}

// ============================================
// Message Sending & Chat Logic
// ============================================
async function sendMessage(event) {
    event.preventDefault();

    const userInput = document.getElementById('userInput');
    const messages = document.getElementById('messages');

    if (!userInput.value.trim() || !sessionId) return;

    const userMessage = userInput.value.trim();

    // Add user message to UI
    addMessage(userMessage, 'user', conversationHistory.length);
    conversationHistory.push({
        role: 'user',
        content: userMessage
    });

    userInput.value = '';
    messageCount++;
    updateMessageCount();

    // Show skeleton loader
    isWaitingForResponse = true;
    const loaderElement = createSkeletonLoader();
    messages.appendChild(loaderElement);
    scrollToBottom();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                message: userMessage,
                history: conversationHistory
            })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const botMessage = data.response;

        // Remove skeleton loader
        if (loaderElement.parentNode) {
            loaderElement.parentNode.removeChild(loaderElement);
        }

        // Add bot message with glowing effect
        addMessage(botMessage, 'bot', conversationHistory.length);
        conversationHistory.push({
            role: 'assistant',
            content: botMessage
        });

    } catch (error) {
        console.error('Chat error:', error);
        if (loaderElement.parentNode) {
            loaderElement.parentNode.removeChild(loaderElement);
        }
        addMessage(`Error: ${error.message}`, 'error', conversationHistory.length);
    } finally {
        isWaitingForResponse = false;
        scrollToBottom();
    }
}

// ============================================
// Branching Logic
// ============================================
async function branchSession(oldSessionId, index) {
    if (!confirm('Start a new story branch from this point?')) return;
    
    try {
        const response = await fetch('/api/branch-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: oldSessionId, message_index: index })
        });
        
        if (!response.ok) throw new Error('Failed to branch session');
        
        const data = await response.json();
        
        // Update to new session and history
        sessionId = data.session_id;
        conversationHistory = data.history;
        messageCount = Math.floor(conversationHistory.length / 2);
        
        // Re-render UI
        document.getElementById('messages').innerHTML = '';
        conversationHistory.forEach((msg, i) => {
            addMessage(msg.content, msg.role === 'user' ? 'user' : 'bot', i);
        });
        
        updateMessageCount();
        loadRecentChats(); // Update sidebar
        const notification = document.createElement('div');
        notification.className = 'message system';
        notification.innerHTML = '<div class="message-content">分岐 Created! This is a new alternative timeline.</div>';
        document.getElementById('messages').appendChild(notification);
        scrollToBottom();
        
    } catch(err) {
        console.error(err);
        alert('Failed to branch story.');
    }
}

// ============================================
// Text to Speech
// ============================================
function speakText(btnElement, text) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        // Strip image tags and markdown formatting for cleaner reading
        let cleanText = text.replace(/\[IMAGE:(.*?)\]/g, ''); 
        cleanText = cleanText.replace(/[#*]/g, '');
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        // Optional: Pick a good voice if available
        const voices = window.speechSynthesis.getVoices();
        const englishVoices = voices.filter(voice => voice.lang.includes('en'));
        if (englishVoices.length > 0) utterance.voice = englishVoices[0];
        
        window.speechSynthesis.speak(utterance);
        
        btnElement.style.color = '#4CAF50';
        utterance.onend = () => {
            btnElement.style.color = '#666';
        }
    } else {
        alert('Text-to-speech is not supported in this browser.');
    }
}

// ============================================
// Export functionality
// ============================================
function exportChatMarkDown() {
    if(!conversationHistory || conversationHistory.length === 0) {
        alert("There is no chat history to export.");
        return;
    }
    
    let mdContent = `# Fantasy Engine Export - Session ${sessionId}\n\n`;
    conversationHistory.forEach((msg) => {
        mdContent += `### ${msg.role === 'user' ? 'User' : 'Megha (AI)'}\n`;
        mdContent += `${msg.content}\n\n`;
    });
    
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Fantasy_Session_${sessionId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================
// Message Display
// ============================================
function addMessage(text, sender, index) {
    const messagesContainer = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.dataset.index = index;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    let processedText = text;
    // Render IMAGE placeholder
    processedText = processedText.replace(/\[IMAGE:\s*(.*?)\]/gi, '<div class="image-prompt" style="background-color: var(--sidebar-bg, #f7f7f7); border: 1px dashed var(--border-color, #eaeaea); padding: 15px; margin: 15px 0; border-radius: 8px; text-align: center; color: var(--text-secondary, #666); font-size: 0.9em; font-style: italic;">🖼️ $1</div>');
    
    if (typeof marked !== 'undefined' && sender === 'bot') {
        contentDiv.innerHTML = marked.parse(processedText);
    } else {
        contentDiv.innerHTML = processedText;
    }

    messageDiv.appendChild(contentDiv);
    
    // Add branching button for older messages (not the very latest one we just sent)
    if (index !== undefined && index > 0) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        
        let ttsBtn = '';
        if (sender === 'bot') {
            ttsBtn = `<button class="branch-btn" onclick="speakText(this, \`${text.replace(/"/g, '&quot;').replace(/'/g, "\\'")}\`)" title="Read Aloud">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg> Read
            </button> `;
        }
        
        actionsDiv.innerHTML = `${ttsBtn}<button class="branch-btn" onclick="branchSession('${sessionId}', ${index})" title="Branch from here">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 4v4m0 0l-4-4m4 4l4-4m-4 8v4m0 0l4 4m-4-4l-4 4"></path>
            </svg> Branch
        </button>`;
        
        // Hide by default, show on hover via CSS
        messageDiv.appendChild(actionsDiv);
    }
    
    messagesContainer.appendChild(messageDiv);

    scrollToBottom();
}

function createSkeletonLoader() {
    const loader = document.createElement('div');
    loader.className = 'message bot';

    const content = document.createElement('div');
    content.className = 'skeleton-loader';

    for (let i = 0; i < 3; i++) {
        const line = document.createElement('div');
        line.className = 'skeleton-line';
        content.appendChild(line);
    }

    loader.appendChild(content);
    return loader;
}

function updateMessageCount() {
    document.getElementById('messageCount').textContent = messageCount;
}

function scrollToBottom() {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
    }
}

// ============================================
// Quick Start Presets
// ============================================
function quickStart(prompt) {
    const userInput = document.getElementById('userInput');
    if (userInput) {
        userInput.value = prompt;
        userInput.focus();
        sendMessage(new Event('submit'));
    }
}

// ============================================
// Layer Switching
// ============================================
function switchLayer(layerName) {
    currentLayer = layerName;

    // Update active button
    document.querySelectorAll('.layer-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layer === layerName);
    });

    // Show/hide panels
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const targetPanel = document.getElementById(`${layerName}Panel`);
    if (targetPanel) {
        targetPanel.classList.add('active');
    } else if (layerName === 'chat') {
        document.querySelector('.chat-panel').classList.add('active');
    }
}

// ============================================
// Collapsible Tree Navigation
// ============================================
function toggleCollapsible(button) {
    const content = button.nextElementSibling;
    if (!content) return;

    const isOpen = content.classList.contains('open');
    
    content.classList.toggle('open');
    button.setAttribute('aria-expanded', !isOpen);

    // Rotate collapse icon
    const icon = button.querySelector('.collapse-icon');
    if (icon) {
        icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
    }
}

// ============================================
// Asset Tree Toggle
// ============================================
function toggleTree(toggleBtn) {
    const treeItem = toggleBtn.parentElement;
    const children = treeItem.querySelector('.tree-children');

    if (!children) return;

    const isOpen = children.style.display !== 'none';
    children.style.display = isOpen ? 'none' : 'flex';
    toggleBtn.classList.toggle('open', !isOpen);
}

// ============================================
// World Parameter Sliders
// ============================================
function attachSliderListeners() {
    // World Chaos Slider
    const chaosSlider = document.getElementById('chaosSlider');
    if (chaosSlider) {
        chaosSlider.addEventListener('input', function() {
            document.getElementById('chaosValue').textContent = this.value + '%';
            updateChartData('chaos', this.value);
        });
    }

    // Magic Saturation Slider
    const magicSlider = document.getElementById('magicSlider');
    if (magicSlider) {
        magicSlider.addEventListener('input', function() {
            document.getElementById('magicValue').textContent = this.value + '%';
            updateChartData('magic', this.value);
        });
    }

    // Historical Age Slider
    const ageSlider = document.getElementById('ageSlider');
    if (ageSlider) {
        ageSlider.addEventListener('input', function() {
            document.getElementById('ageValue').textContent = this.value + '%';
            updateChartData('age', this.value);
        });
    }
}

// ============================================
// Chart & Visualization Updates
// ============================================
function updateChartData(parameter, value) {
    // Update tension chart based on parameters
    const chaos = parseInt(document.getElementById('chaosSlider').value) || 0;
    const magic = parseInt(document.getElementById('magicSlider').value) || 0;
    const age = parseInt(document.getElementById('ageSlider').value) || 0;

    // Calculate story tension (average of parameters)
    const tension = (chaos + magic + age) / 3;

    // Update SVG chart
    updateTensionChart(tension);
}

function updateTensionChart(tension) {
    const chart = document.getElementById('tensionChart');
    if (!chart) return;

    // Create dynamic points based on tension
    const baselinePoints = [
        [0, 70],
        [20, 60 - (tension * 0.1)],
        [40, 55 - (tension * 0.15)],
        [60, 50 - (tension * 0.12)],
        [80, 45 - (tension * 0.2)],
        [100, 40 - (tension * 0.25)]
    ];

    const points = baselinePoints.map(p => p.join(',')).join(' ');

    // Remove old polyline and add new
    const existing = chart.querySelector('polyline');
    if (existing) existing.remove();

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points);
    polyline.setAttribute('stroke', '#1A1A1A');
    polyline.setAttribute('stroke-width', '1.5');
    polyline.setAttribute('fill', 'none');

    chart.appendChild(polyline);
}

// ============================================
// Character Web Network Visualization
// ============================================
function updateCharacterWeb(characters) {
    const svg = document.getElementById('characterWeb');
    if (!svg) return;

    // Clear existing connections and nodes
    svg.querySelectorAll('line, circle, text').forEach(el => {
        if (el.tagName !== 'defs') el.remove();
    });

    if (!characters || characters.length === 0) {
        // Show placeholder
        drawPlaceholderNetwork();
        return;
    }

    // Position characters in a circle
    const centerX = 100;
    const centerY = 70;
    const radius = 40;

    const positions = characters.map((char, i) => {
        const angle = (i / characters.length) * Math.PI * 2;
        return {
            name: char,
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        };
    });

    // Draw connections
    for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', positions[i].x);
            line.setAttribute('y1', positions[i].y);
            line.setAttribute('x2', positions[j].x);
            line.setAttribute('y2', positions[j].y);
            line.setAttribute('stroke', '#DCDCDC');
            line.setAttribute('stroke-width', '1');
            svg.appendChild(line);
        }
    }

    // Draw nodes
    positions.forEach(pos => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', '6');
        circle.setAttribute('fill', '#1A1A1A');
        svg.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', pos.x);
        text.setAttribute('y', pos.y + 16);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '9');
        text.setAttribute('fill', '#737373');
        text.textContent = pos.name;
        svg.appendChild(text);
    });
}

function drawPlaceholderNetwork() {
    const svg = document.getElementById('characterWeb');
    if (!svg) return;

    // Placeholder network
    const lines = [
        { x1: 50, y1: 40, x2: 150, y2: 40 },
        { x1: 150, y1: 40, x2: 100, y2: 100 },
        { x1: 50, y1: 40, x2: 100, y2: 100 }
    ];

    const nodes = [
        { x: 50, y: 40, label: 'Hero' },
        { x: 150, y: 40, label: 'Mentor' },
        { x: 100, y: 100, label: 'Ally' }
    ];

    // Draw placeholder connections
    lines.forEach(line => {
        const lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        lineEl.setAttribute('x1', line.x1);
        lineEl.setAttribute('y1', line.y1);
        lineEl.setAttribute('x2', line.x2);
        lineEl.setAttribute('y2', line.y2);
        lineEl.setAttribute('stroke', '#DCDCDC');
        lineEl.setAttribute('stroke-width', '1');
        svg.appendChild(lineEl);
    });

    // Draw placeholder nodes
    nodes.forEach(node => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', node.x);
        circle.setAttribute('cy', node.y);
        circle.setAttribute('r', '6');
        circle.setAttribute('fill', '#1A1A1A');
        svg.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y + 16);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '9');
        text.setAttribute('fill', '#737373');
        text.textContent = node.label;
        svg.appendChild(text);
    });
}
