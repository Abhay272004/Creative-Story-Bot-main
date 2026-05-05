let sessionId = null;
let isLoading = false;
let messageCount = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeSession();
    addInitialMessage();
});

async function initializeSession() {
    try {
        const response = await fetch('/api/new-session', {
            method: 'POST'
        });
        const data = await response.json();
        sessionId = data.session_id;
    } catch (error) {
        console.error('Error initializing session:', error);
    }
}

function addInitialMessage() {
    const messagesDiv = document.getElementById('messages');
    
    const initialMessage = `Welcome to the Fantasy World & Character Engine! 🌟

I'm your AI assistant specialized in creating:
• 🐉 Epic fantasy characters with rich backstories
• 📖 Engaging fantasy narratives and adventures
• 🌍 Entire fantasy worlds with unique systems
• 👑 Kingdoms, cultures, and political landscapes
• ✨ Magic systems and mystical elements

What would you like to create today? Ask me anything about your fantasy world!`;
    
    const messageEl = createMessageElement('bot', initialMessage);
    messagesDiv.appendChild(messageEl);
    scrollToBottom();
}

async function sendMessage(event) {
    event.preventDefault();
    
    if (isLoading) return;
    
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    
    if (!message) return;
    
    // Add user message to UI
    const messagesDiv = document.getElementById('messages');
    const userMessageEl = createMessageElement('user', message);
    messagesDiv.appendChild(userMessageEl);
    
    messageCount++;
    updateMessageCount();
    
    // Clear input
    userInput.value = '';
    userInput.focus();
    
    scrollToBottom();
    
    // Show skeleton loading state
    isLoading = true;
    const skeletonEl = createSkeletonLoader();
    messagesDiv.appendChild(skeletonEl);
    scrollToBottom();
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                session_id: sessionId
            })
        });
        
        messagesDiv.removeChild(skeletonEl);
        
        if (!response.ok) {
            throw new Error('Failed to get response');
        }
        
        const data = await response.json();
        
        if (data.success) {
            const botMessageEl = createMessageElement('bot', data.response);
            messagesDiv.appendChild(botMessageEl);
            messageCount++;
            updateMessageCount();
        } else {
            const errorEl = createMessageElement('bot', 
                `❌ Error: ${data.error || 'Something went wrong'}`);
            messagesDiv.appendChild(errorEl);
        }
        
    } catch (error) {
        console.error('Error:', error);
        if (messagesDiv.contains(skeletonEl)) {
            messagesDiv.removeChild(skeletonEl);
        }
        const errorEl = createMessageElement('bot', `❌ Error: ${error.message}`);
        messagesDiv.appendChild(errorEl);
    } finally {
        isLoading = false;
        scrollToBottom();
    }
}

function createMessageElement(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? '👤' : '✨';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = content.replace(/\n/g, '<br>');
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    return messageDiv;
}

function createSkeletonLoader() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar skeleton skeleton-avatar';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.style.minWidth = '200px';
    
    const line1 = document.createElement('div');
    line1.className = 'skeleton skeleton-text';
    line1.style.width = '100%';
    
    const line2 = document.createElement('div');
    line2.className = 'skeleton skeleton-text';
    line2.style.width = '85%';
    
    const line3 = document.createElement('div');
    line3.className = 'skeleton skeleton-text';
    line3.style.width = '90%';
    
    contentDiv.appendChild(line1);
    contentDiv.appendChild(line2);
    contentDiv.appendChild(line3);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    return messageDiv;
}

function scrollToBottom() {
    const container = document.querySelector('.messages-container');
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 0);
}

function startNewChat() {
    document.getElementById('messages').innerHTML = '';
    messageCount = 0;
    updateMessageCount();
    initializeSession();
    addInitialMessage();
    document.getElementById('userInput').focus();
}

function quickStart(prompt) {
    const userInput = document.getElementById('userInput');
    userInput.value = prompt;
    userInput.focus();
    setTimeout(() => {
        document.getElementById('chatForm').dispatchEvent(new Event('submit'));
    }, 100);
}

function switchLayer(layer) {
    document.querySelectorAll('.layer-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelector(`[data-layer="${layer}"]`).classList.add('active');
    
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    const selectedPanel = document.getElementById(`${layer}Panel`);
    if (selectedPanel) {
        selectedPanel.classList.add('active');
    }
}

function updateMessageCount() {
    const countEl = document.getElementById('messageCount');
    if (countEl) {
        countEl.textContent = messageCount;
    }
}
