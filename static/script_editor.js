// ============================================
// Global State
// ============================================
window.currentUseCase = 'story';
let currentView = 'home';
let currentPageId = null;
let pages = [];
let pageCounter = 1;

// Load pages from localStorage
function loadPages() {
    const saved = localStorage.getItem('storyPages');
    if (saved) {
        pages = JSON.parse(saved);
        pageCounter = Math.max(...pages.map(p => p.id), 0) + 1;
    }
}

// Save pages to localStorage
function savePages() {
    localStorage.setItem('storyPages', JSON.stringify(pages));
}

// ============================================
// View Management
// ============================================
function switchView(view) {
    // Hide all views
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
    
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-view') === view) {
            item.classList.add('active');
        }
    });
    
    currentView = view;
    
    // Comic mode shares the home view container
    const targetViewId = view === 'comic' ? 'homeView' : `${view}View`;
    
    // Show selected view
    const viewEl = document.getElementById(targetViewId);
    if (viewEl) {
        viewEl.classList.add('active');
    }
    
    // Clear page selection when switching away from editor
    if (view !== 'editor') {
        currentPageId = null;
        document.querySelectorAll('.page-item').forEach(item => {
            item.classList.remove('active');
        });
    }
}

// ============================================
// Page Management
// ============================================
function addNewPage() {
    const pageId = pageCounter++;
    const now = new Date().toISOString();
    const newPage = {
        id: pageId,
        title: `Untitled Chat ${pageId}`,
        content: '',
        type: window.currentUseCase || 'story',
        sessionId: 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        createdAt: now,
        modifiedAt: now
    };
    
    pages.push(newPage);
    savePages();
    renderPagesList();
    openPage(pageId);
    return pageId;
}

function extractChatHistory(htmlContent) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const history = [];
    const messages = tempDiv.querySelectorAll('.chat-message');
    messages.forEach(msg => {
        const role = msg.classList.contains('chat-ai') ? 'assistant' : 'user';
        const contentNode = msg.querySelector('.chat-content');
        if (contentNode) {
            history.push({ role: role, content: contentNode.innerText || contentNode.textContent });
        }
    });
    return history;
}

function openPage(pageId) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    // Automatically switch to the mode the chat belongs to
    const pageType = page.type || 'story';
    if (window.currentUseCase !== pageType) {
        setMode(pageType);
    }
    
    currentPageId = pageId;
    
    // Add sessionId if it's missing (for older chats)
    if (!page.sessionId) {
        page.sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        savePages();
    }

    // Extract history and inform backend
    const extractedHistory = extractChatHistory(page.content || '');
    fetch('/api/load_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session_id: page.sessionId,
            history: extractedHistory
        })
    }).catch(err => console.error("Could not sync chat history with backend", err));
    
    // Update page title input
    document.getElementById('pageTitle').value = page.title;
    
    // Update editor content
    const editor = document.getElementById('editor-content');
    editor.textContent = page.content;
    
    // Switch to editor view
    switchView('editor');
    
    // Update page list active state
    document.querySelectorAll('.page-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page-id') === String(pageId)) {
            item.classList.add('active');
        }
    });
}

function deletePage(pageId) {
    if (confirm('Are you sure you want to delete this page?')) {
        pages = pages.filter(p => p.id !== pageId);
        savePages();
        renderPagesList();
        
        if (currentPageId === pageId) {
            currentPageId = null;
            switchView('home');
        }
    }
}

function savePage() {
    if (!currentPageId) return;
    
    const page = pages.find(p => p.id === currentPageId);
    if (!page) return;
    
    page.title = document.getElementById('pageTitle').value || 'Untitled';
    page.content = document.getElementById('editor-content').innerHTML; // We now store HTML because it acts as chat log
    page.modifiedAt = new Date().toISOString();
    
    savePages();
    renderPagesList();
}

function processOlderPages() {
    // Sort pages by modifiedAt or createdAt (newest first)
    pages.sort((a, b) => {
        const t1 = new Date(b.modifiedAt || b.createdAt).getTime();
        const t2 = new Date(a.modifiedAt || a.createdAt).getTime();
        return t1 - t2;
    });

    if (pages.length > 5) {
        pages = pages.slice(0, 5); // Keep the 5 most recent
        savePages();
    }
}

function renderPagesList() {
    const pagesList = document.getElementById('pagesList');
    pagesList.innerHTML = '';
    
    // Apply limit to ensure we only render the latest 5 chats
    processOlderPages();
    
    // Add a clear "New Chat" button at the top
    const newChatBtn = document.createElement('button');
    newChatBtn.className = 'page-item';
    newChatBtn.style.cssText = 'background: rgba(16, 163, 127, 0.1); color: var(--accent-color); border: 1px dashed var(--accent-color); justify-content: center; margin-bottom: 12px; font-weight: 500;';
    newChatBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
            <path d="M12 5v14M5 12h14"></path>
        </svg>
        <span>${window.currentUseCase === 'comic' ? 'New Comic' : 'New Chat'}</span>
    `;
    newChatBtn.onclick = () => {
        const pageId = addNewPage();
        openPage(pageId);
    };
    pagesList.appendChild(newChatBtn);
    
    // Update the Sidebar Title Dynamic Text 
    const pagesTitle = document.querySelector('.pages-title');
    if (pagesTitle) pagesTitle.innerText = window.currentUseCase === 'comic' ? 'Recent Comics' : 'Recent Chats';
    
    // Filter chats based on current mode
    const filteredPages = pages.filter(p => 
        window.currentUseCase === 'comic' ? p.type === 'comic' : (p.type === 'story' || !p.type)
    );

    filteredPages.forEach(page => {
        const pageBtn = document.createElement('button');
        pageBtn.className = 'page-item' + (page.id === currentPageId ? ' active' : '');
        pageBtn.setAttribute('data-page-id', page.id);
        pageBtn.innerHTML = `
            <span class="page-item-name">${page.title}</span>
            <button class="page-item-delete" onclick="event.stopPropagation(); deletePage(${page.id})" title="Delete">×</button>
        `;
        pageBtn.onclick = () => openPage(page.id);
        pagesList.appendChild(pageBtn);
    });
}

// ============================================
// Shared function to render AI output and generate heavy Hugging Face images in background
// ============================================
async function processAIImagesAndMarkdown(text, container) {
    const hfToken = localStorage.getItem('hf_api_key');
    let processedText = text;
    const imgRegex = /\[IMAGE:\s*([^\]]+)\]/gi;
    let match;
    const pendingImages = [];

    // Find all images and replace with loading placeholders
    while ((match = imgRegex.exec(text)) !== null) {
        const prompt = match[1];
        const safeId = 'img-' + Math.random().toString(36).substr(2, 9);
        pendingImages.push({ prompt, id: safeId });
        let floatDir = (pendingImages.length % 2 === 1) ? 'float-right' : 'float-left';
        processedText = processedText.replace(match[0], `\n\n<div class="image-wrapper ${floatDir}"><p id="${safeId}-msg" style="color: #888; font-style: italic;">🖼️ <i>Sketching: ${prompt}...</i></p><img id="${safeId}" style="display:none;" /><div style="margin-top: 4px; font-style: italic;">Fig 1. ${prompt}</div></div>\n\n`);
    }

    // Render HTML quickly
    container.innerHTML = (typeof marked !== 'undefined') ? marked.parse(processedText) : processedText;
    
    // Auto scroll once text renders
    const editorMain = document.querySelector('.editor-main');
    if (editorMain) editorMain.scrollTop = editorMain.scrollHeight;

    // Fetch images asynchronously to not freeze UI
    for (const img of pendingImages) {
        const msgEl = document.getElementById(img.id + '-msg');
        const imgEl = document.getElementById(img.id);

        try {
            const response = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    prompt: "minimalist black and white newspaper ink sketch illustration, " + img.prompt
                })
            });

            if (response.ok) {
                const data = await response.json();
                
                if(data.url) {
                    imgEl.src = data.url;
                    imgEl.onload = () => {
                        imgEl.style.display = 'block';
                        msgEl.style.display = 'none';
                        if (editorMain) editorMain.scrollTop = editorMain.scrollHeight;
                        
                        // Add to Image Gallery
                        addImageToGallery(img.prompt, data.url);
                    };
                } else {
                    msgEl.innerText = '⚠️ Image generation failed - Try again later.';
                }
            } else {
                msgEl.innerText = '⚠️ Image generation failed limit or model loading - Try again later.';
            }
        } catch(e) {
            msgEl.innerText = '⚠️ Network error creating image.';
        }
    }
}

// ============================================
// Settings Management
// ============================================
function saveSettings() {
    const key = document.getElementById('userApiKey').value.trim();
    const model = document.getElementById('aiModelSelect').value;
    const hfKey = document.getElementById('hfApiKey').value.trim();
    const elKey = document.getElementById('elevenLabsKey')?.value.trim();
    
    if (key) {
        localStorage.setItem('groq_api_key', key);
    } else {
        localStorage.removeItem('groq_api_key');
    }

    if (hfKey) {
        localStorage.setItem('hf_api_key', hfKey);
    } else {
        localStorage.removeItem('hf_api_key');
    }
    
    if (elKey) {
        localStorage.setItem('elevenlabs_api_key', elKey);
    } else {
        localStorage.removeItem('elevenlabs_api_key');
    }

    localStorage.setItem('groq_model', model);
    
    const status = document.getElementById('settingsStatus');
    status.textContent = 'Settings saved!';
    setTimeout(() => { status.textContent = ''; }, 3000);
}

// ============================================
// Editor Auto-save
// ============================================
let autoSaveTimeout;
document.addEventListener('DOMContentLoaded', function() {
    // Load Settings
    const savedModel = localStorage.getItem('groq_model');
    const savedKey = localStorage.getItem('groq_api_key');
    if (savedModel) {
        const select = document.getElementById('aiModelSelect');
        if(select) select.value = savedModel;
    }
    if (savedKey) {
        const input = document.getElementById('userApiKey');
        if(input) input.value = savedKey;
    }
    const savedHf = localStorage.getItem('hf_api_key');
    if (savedHf) {
        const hfInput = document.getElementById('hfApiKey');
        if(hfInput) hfInput.value = savedHf;
    }
    
    const savedEl = localStorage.getItem('elevenlabs_api_key');
    if (savedEl) {
        const elInput = document.getElementById('elevenLabsKey');
        if(elInput) elInput.value = savedEl;
    }

    const editor = document.getElementById('editor-content');
    const titleInput = document.getElementById('pageTitle');
    
    if (editor) {
        editor.addEventListener('input', () => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(savePage, 1000);
        });
    }
    
    if (titleInput) {
        titleInput.addEventListener('input', () => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(savePage, 1000);
        });
    }
    
    // Add click handlers to suggestions
    const suggestions = document.querySelectorAll('.suggestion-item');
    suggestions.forEach(suggestion => {
        suggestion.addEventListener('click', function() {
            const text = this.querySelector('strong').textContent;
            const input = document.getElementById('greetingAIInput');
            if (input) {
                input.value = text;
                input.focus();
            }
        });
    });
    
    // Load pages and render
    loadPages();
    renderPagesList();
});

// ============================================
// AI Unified Prompt (Home & Editor)
// ============================================

const imageGalleryList = [];

function addImageToGallery(prompt, url) {
    imageGalleryList.push({ prompt, url, timestamp: new Date().toISOString() });
    
    const galleryGrid = document.getElementById('generatedImagesGrid');
    if (!galleryGrid) return;
    
    const card = document.createElement('div');
    card.style.border = '1px solid #e5e7eb';
    card.style.borderRadius = '8px';
    card.style.overflow = 'hidden';
    card.style.backgroundColor = '#fff';
    card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    
    card.innerHTML = `
        <div style="height: 200px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f9fafb;">
            <img src="${url}" style="max-width: 100%; max-height: 100%; object-fit: cover;" alt="${prompt.replace(/"/g, '&quot;')}">
        </div>
        <div style="padding: 12px; font-size: 12px; color: #4b5563; border-top: 1px solid #e5e7eb;">
            <strong>Prompt:</strong> ${prompt}
        </div>
    `;
    // Insert at front
    galleryGrid.prepend(card);
}

let isImageGenerationMode = false;

function toggleImageGenerationMode(btn) {
    isImageGenerationMode = !isImageGenerationMode;
    const allBtns = document.querySelectorAll('button[title="Generate Image"]');
    
    allBtns.forEach(b => {
        if (isImageGenerationMode) {
            b.classList.add('image-mode-active');
            b.style.backgroundColor = '#e0f2fe'; /* light blue circle */
            b.style.borderRadius = '50%';
            b.style.color = '#0284c7';
        } else {
            b.classList.remove('image-mode-active');
            b.style.backgroundColor = '';
            b.style.borderRadius = '';
            b.style.color = '';
        }
    });
}

function setHomePrompt(text) {
    const input = document.getElementById('homeAIInput');
    if (input) {
        input.value = text;
        submitUnifiedPrompt({ preventDefault: () => {} }, 'home');
    }
}

function triggerImageGeneration(source) {
    toggleImageGenerationMode(null);
}

let uploadedBase64Image = null;

function handleImageSelect(source) {
    const inputId = source === 'home' ? 'homeImageUpload' : 'editorImageUpload';
    const previewId = source === 'home' ? 'homeImagePreview' : 'editorImagePreview';
    const fileInput = document.getElementById(inputId);
    const previewContainer = document.getElementById(previewId);
    
    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedBase64Image = e.target.result;
            previewContainer.innerHTML = `
                <div style="position:relative; display:inline-block; margin-top:8px;">
                    <img src="${uploadedBase64Image}" style="height: 60px; max-width: 100px; border-radius: 4px; border: 1px solid #ccc; object-fit: cover;">
                    <span onclick="clearUploadedImage('${source}')" style="position:absolute; top:-6px; right:-6px; background:#ef4444; color:white; border-radius:50%; width:18px; height:18px; text-align:center; font-size:12px; cursor:pointer; line-height:16px;">×</span>
                </div>
            `;
            previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function clearUploadedImage(source) {
    uploadedBase64Image = null;
    const inputId = source === 'home' ? 'homeImageUpload' : 'editorImageUpload';
    const previewId = source === 'home' ? 'homeImagePreview' : 'editorImagePreview';
    document.getElementById(inputId).value = '';
    document.getElementById(previewId).innerHTML = '';
    document.getElementById(previewId).style.display = 'none';
}

function submitUnifiedPrompt(event, source) {
    event.preventDefault();
    
    const inputId = source === 'home' ? 'homeAIInput' : 'editorAIInput';
    const input = document.getElementById(inputId);
    const prompt = input.value.trim();
    
    if (!prompt) return;
    
    if (source === 'home') {
        // Create a new page with the prompt
        const pageId = pageCounter++;
        const newPage = {
            id: pageId,
            title: prompt.substring(0, 50) || 'Untitled',
            content: '',
            type: window.currentUseCase || 'story',
            createdAt: new Date().toISOString()
        };
        
        pages.push(newPage);
        savePages();
        currentPageId = pageId;
        
        // Immediately switch to the editor view and append user message
        switchView('editor');
        appendToEditorAsChat('user', prompt);
    } else {
        appendToEditorAsChat('user', prompt);
    }
    
    input.value = '';
    input.style.height = 'auto'; // Reset textarea height
    
    // Check if we are in Image Generation Mode
    if (isImageGenerationMode) {
        showResponseLoading();
        
        // Immediately trigger image rendering block
        setTimeout(() => {
            hideResponseLoading();
            const { wrapper, contentContainer } = createEmptyAIChatBubble();
            const imageMarkdown = `[IMAGE: ${prompt}]`;
            
            processAIImagesAndMarkdown(imageMarkdown, contentContainer);
            
            const cp = pages.find(p => p.id === currentPageId);
            if (cp) {
                cp.content += `\n\n**User**: ${prompt}\n\n**AI**: ${imageMarkdown}\n\n`;
                savePages();
            }
            
            // Auto turn off after completion
            toggleImageGenerationMode();
        }, 300);
        return; // Don't proceed to chat API
    }
    
    // Send to AI and update editor
    showResponseLoading();
    
    const cp = pages.find(p => p.id === currentPageId); 
    
    // Check for vision model
    let modelToUse = localStorage.getItem('groq_model') || 'llama-3.1-8b-instant';
    if(uploadedBase64Image) {
        modelToUse = 'llama-3.2-11b-vision-preview'; // Automatically switch to a vision model if available in Groq
    }

    const payload = {
        message: prompt,
        image_data: uploadedBase64Image ? uploadedBase64Image.split(',')[1] : null,
        use_case: window.currentUseCase, 
        session_id: cp ? cp.sessionId : 'default',
        model: modelToUse,
        api_key: localStorage.getItem('groq_api_key') || null
    };

    const tempImg = uploadedBase64Image;

    // Before sending off, clear the uploaded image from UI
    if(uploadedBase64Image) {
        clearUploadedImage(source);
    }

    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(async response => {
        hideResponseLoading();
        
        if (!response.ok) {
            console.error("API error:", await response.text());
            appendToEditorAsChat('ai', '**Error**: Unable to reach AI server. Please try again.');
            return;
        }
        
        // Create an empty AI chat bubble to stream into
        const { wrapper, contentContainer } = createEmptyAIChatBubble();
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const dataPattern = line.slice(6);
                        if (!dataPattern.trim()) continue;
                        
                        const data = JSON.parse(dataPattern);
                        
                        if (data.error) {
                            console.error('API Error:', data.error);
                            const errorMsg = data.error.includes("Rate limit") 
                                ? "**Error:** AI rate limit reached. Please wait a minute or change your API key." 
                                : `**Error:** ${data.error}`;
                            contentContainer.innerHTML = marked.parse ? marked.parse(errorMsg) : errorMsg;
                            break;
                        }
                        
                        if (data.done) {
                            // Check if the response contains an image prompt
                            // Only automatically generate images if it's a long "complete story" (e.g. > 800 chars)
                            if (!/\[IMAGE:\s*([^\]]+)\]/i.test(fullText) && fullText.length > 800) {
                                // Automatically request two images if they weren't provided and the text is substantial
                                const middleIndex = Math.floor(fullText.length / 2);
                                // Find a newline near the middle to break smoothly
                                let breakPoint = fullText.lastIndexOf('\n', middleIndex);
                                if (breakPoint === -1) breakPoint = middleIndex;
                                
                                const firstHalf = fullText.substring(0, breakPoint);
                                const secondHalf = fullText.substring(breakPoint);
                                
                                const summary1 = firstHalf.slice(0, 150).replace(/\n/g, ' ').replace(/[*_`#]/g, '').trim();
                                const summary2 = secondHalf.slice(0, 150).replace(/\n/g, ' ').replace(/[*_`#]/g, '').trim();
                                
                                fullText = firstHalf + 
                                           `\n\n[IMAGE: A fantasy scene illustrating: ${summary1}]\n\n` + 
                                           secondHalf + 
                                           `\n\n[IMAGE: A fantasy scene illustrating: ${summary2}]`;
                            }
                            processAIImagesAndMarkdown(fullText, contentContainer);
                            break; 
                        }
                        
                        if (data.text) {
                            fullText += data.text;
                            
                            // Convert to string during stream just to show placeholder
                            let processedText = fullText.replace(/\[IMAGE:\s*([^\]]+)\]/gi, '\n\n<div class="image-wrapper float-right" style="font-style:italic;">*🖼️ Sketching illustration...*</div>\n\n');
                            contentContainer.innerHTML = marked.parse ? marked.parse(processedText) : processedText;
                            
                            // Auto scroll
                            const editorMain = document.querySelector('.editor-main');
                            if (editorMain) editorMain.scrollTop = editorMain.scrollHeight;
                        }
                    } catch (e) {
                        console.error('Error parsing JSON from SSE chunk:', line, e);
                    }
                }
            }
        }
        
        // Save history state after streaming finishes
        if (currentPageId) {
            const page = pages.find(p => p.id === currentPageId);
            if (page) {
                const editor = document.getElementById('editor-content');
                page.content = editor.innerHTML;
                savePages();
            }
        }
        
        // Show quick actions again
        const quickActions = document.querySelector('.quick-actions-container');
        if (quickActions) quickActions.style.display = 'flex';
    })
    .catch(error => {
        console.error('Error:', error);
        hideResponseLoading();
    });
}

function createEmptyAIChatBubble() {
    const editor = document.getElementById('editor-content');
    
    // Hide quick actions when AI generates
    const quickActions = document.querySelector('.quick-actions-container');
    if (quickActions) quickActions.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message chat-ai';
    
    // Add AI Logo Avatar for Gemini-like style
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar ai-avatar';
    // Static logo for completed output
    avatar.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 240 240">
            <circle cx="120" cy="120" r="105" fill="none" stroke="#1A1A1A" stroke-width="20" stroke-linecap="round"></circle>
            <circle cx="120" cy="120" r="35" fill="none" stroke="#1A1A1A" stroke-width="20" stroke-linecap="round"></circle>
            <circle cx="85" cy="120" r="70" fill="none" stroke="#1A1A1A" stroke-width="20" stroke-linecap="round"></circle>
            <circle cx="155" cy="120" r="70" fill="none" stroke="#1A1A1A" stroke-width="20" stroke-linecap="round"></circle>
        </svg>
    `;
    wrapper.appendChild(avatar);
    
    const content = document.createElement('div');
    content.className = 'chat-content markdown-body';
    content.innerHTML = '<span class="typing-indicator"></span>';
    
    wrapper.appendChild(content);
    editor.appendChild(wrapper);
    
    const editorMain = document.querySelector('.editor-main');
    if (editorMain) editorMain.scrollTop = editorMain.scrollHeight;
    
    return { wrapper, contentContainer: content };
}

function appendToEditorAsChat(role, text) {
    const editor = document.getElementById('editor-content');
    
    const wrapper = document.createElement('div');
    wrapper.className = `chat-message chat-${role}`;
    
    // Add AI Logo Avatar for Gemini-like style
    if (role === 'ai') {
        const avatar = document.createElement('div');
        avatar.className = 'chat-avatar ai-avatar';
        // Static logo for completed output
        avatar.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 240 240">
                <circle cx="120" cy="120" r="105" fill="none" stroke="#1A1A1A" stroke-width="20" stroke-linecap="round"></circle>
                <circle cx="120" cy="120" r="35" fill="none" stroke="#1A1A1A" stroke-width="20" stroke-linecap="round"></circle>
                <circle cx="85" cy="120" r="70" fill="none" stroke="#1A1A1A" stroke-width="20" stroke-linecap="round"></circle>
                <circle cx="155" cy="120" r="70" fill="none" stroke="#1A1A1A" stroke-width="20" stroke-linecap="round"></circle>
            </svg>
        `;
        wrapper.appendChild(avatar);
    }
    
    const content = document.createElement('div');
    content.className = role === 'ai' ? 'chat-content markdown-body' : 'chat-content';
    
    // Feature 1: TTS
    if (role === 'ai') {
        const ttsBtn = document.createElement('button');
        ttsBtn.className = 'tts-btn';
        ttsBtn.innerHTML = '<i class="fa-solid fa-play"></i> Read Aloud';
        ttsBtn.onclick = function() { playVoiceTTS(text, this); };
        wrapper.appendChild(ttsBtn);
    }
    
    let formattedText = text;
    if (role === 'ai') {
        processAIImagesAndMarkdown(text, content);
    } else {
        formattedText = formattedText.replace(/\n/g, '<br>');
        content.innerHTML = formattedText;
    }
    
    wrapper.appendChild(content);
    editor.appendChild(wrapper);
    
    // Scroll to bottom
    const editorMain = document.querySelector('.editor-main');
    if (editorMain) editorMain.scrollTop = editorMain.scrollHeight;
}

function switchToEditorForPage(pageId) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;
    
    // Update page title input
    document.getElementById('pageTitle').value = page.title;
    
    // Update editor content (now it contains HTML structure)
    const editor = document.getElementById('editor-content');
    editor.innerHTML = page.content;
    
    // Switch to editor view
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
    document.getElementById('editorView').classList.add('active');
    
    currentView = 'editor';
    
    // Update page list active state
    renderPagesList();
    document.querySelectorAll('.page-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page-id') === String(pageId)) {
            item.classList.add('active');
        }
    });
}

// ============================================
// AI Modal In Editor
// ============================================
function openAIModal() {
    const modal = document.getElementById('aiModal');
    const overlay = document.getElementById('aiOverlay');
    const input = document.getElementById('aiInput');
    
    modal.style.display = 'block';
    overlay.style.display = 'block';
    input.focus();
}

function closeAIModal() {
    const modal = document.getElementById('aiModal');
    const overlay = document.getElementById('aiOverlay');
    
    modal.style.display = 'none';
    overlay.style.display = 'none';
}

function submitAIPrompt(event) {
    event.preventDefault();
    
    const input = document.getElementById('aiInput');
    const prompt = input.value.trim();
    
    if (!prompt) return;
    
    showResponseLoading();
    
    const cp = pages.find(p => p.id === currentPageId); fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: prompt,
            use_case: window.currentUseCase, session_id: cp ? cp.sessionId : 'default',
            model: localStorage.getItem('groq_model') || 'llama-3.1-8b-instant',
            api_key: localStorage.getItem('groq_api_key') || null
        })
    })
    .then(response => response.json())
    .then(data => {
        hideResponseLoading();
        
        if (data.response) {
            addToEditor(data.response);
            savePage();
        }
        
        closeAIModal();
        input.value = '';
    })
    .catch(error => {
        console.error('Error:', error);
        hideResponseLoading();
        closeAIModal();
    });
}

function addToEditor(text) {
    const editor = document.getElementById('editor-content');
    const currentText = editor.textContent;
    
    if (currentText && !currentText.endsWith('\n\n')) {
        editor.textContent += '\n\n';
    }
    
    editor.textContent += text;
}

function showResponseLoading() {
    const editor = document.getElementById('editor-content');
    if (!editor) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message chat-ai loading-bubble';
    wrapper.id = 'ai-loading-bubble';
    
    // Add animated AI Logo Avatar
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar ai-avatar';
    avatar.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 240 240">
            <circle class="pl__ring pl__ring--a" cx="120" cy="120" r="105" fill="none" stroke="#1A1A1A" stroke-width="20" stroke-dasharray="0 660" stroke-dashoffset="-330" stroke-linecap="round"></circle>
            <circle class="pl__ring pl__ring--b" cx="120" cy="120" r="35" fill="none" stroke="#1A1A1A" stroke-width="20" stroke-dasharray="0 220" stroke-dashoffset="-110" stroke-linecap="round"></circle>
            <circle class="pl__ring pl__ring--c" cx="85" cy="120" r="70" fill="none" stroke="#1A1A1A" stroke-width="20" stroke-dasharray="0 440" stroke-linecap="round"></circle>
            <circle class="pl__ring pl__ring--d" cx="155" cy="120" r="70" fill="none" stroke="#1A1A1A" stroke-width="20" stroke-dasharray="0 440" stroke-linecap="round"></circle>
        </svg>
    `;
    
    wrapper.appendChild(avatar);
    editor.appendChild(wrapper);
    
    const editorMain = document.querySelector('.editor-main');
    if (editorMain) {
        editorMain.scrollTop = editorMain.scrollHeight;
    }
}

function hideResponseLoading() {
    const bubble = document.getElementById('ai-loading-bubble');
    if (bubble) {
        bubble.remove();
    }
}

// ============================================
// Keyboard Shortcuts
// ============================================
document.addEventListener('keydown', function(event) {
    // Cmd+K or Ctrl+K to open AI modal (only in editor view)
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        if (currentView === 'editor') {
            event.preventDefault();
            openAIModal();
        }
    }
    
    // Escape to close modal
    if (event.key === 'Escape') {
        const modal = document.getElementById('aiModal');
        if (modal && modal.style.display === 'block') {
            closeAIModal();
        }
    }
    
    // Ctrl+S or Cmd+S to save
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        savePage();
    }
});

// Quick actions handler
function executeQuickAction(action) {
    const input = document.getElementById('editorAIInput');
    if (input) {
        input.value = action;
        submitUnifiedPrompt(new Event('submit', { cancelable: true, bubbles: true }), 'editor');
    }
}



// ============================================
// Notes and Projects Management
// ============================================

let stickyNotes = [];

// Zen, desaturated Notion-like pastel tones
const STICKY_COLORS = [
    '#F2EFE9', /* Warm Beige */
    '#E8EDF2', /* Cool Blue-Grey */
    '#E9F2EC', /* Sage Green */
    '#F2EAE9', /* Dusty Rose */
    '#F0E9F2', /* Soft Lavender */
    '#ECECEE'  /* Neutral Grey */
];

function saveGlobalNotes() {
    localStorage.setItem('stickyNotes', JSON.stringify(stickyNotes));
}

function loadGlobalNotes() {
    const saved = localStorage.getItem('stickyNotes');
    if(saved) {
        try {
            stickyNotes = JSON.parse(saved);
        } catch(e) {
            stickyNotes = [];
        }
    }
    renderStickyNotes();
}

function createNewNote() {
    switchView('notes');
    const newNote = {
        id: Date.now(),
        content: '',
        color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)]
    };
    stickyNotes.push(newNote);
    saveGlobalNotes();
    renderStickyNotes();
}

function deleteStickyNote(id) {
    stickyNotes = stickyNotes.filter(n => n.id !== id);
    saveGlobalNotes();
    renderStickyNotes();
}

function updateStickyNote(id, content) {
    const note = stickyNotes.find(n => n.id === id);
    if(note) {
        note.content = content;
        saveGlobalNotes();
    }
}

function renderStickyNotes() {
    const container = document.getElementById('stickyNotesContainer');
    if(!container) return;
    
    container.innerHTML = '';
    
    if(stickyNotes.length === 0) {
        const empty = document.createElement('div');
        empty.innerHTML = "<p style='color: var(--text-secondary);'>No sticky notes yet. Click '+ Add Note' to create one!</p>";
        container.appendChild(empty);
        return;
    }
    
    stickyNotes.forEach(note => {
        const card = document.createElement('div');
        card.style.backgroundColor = note.color;
        card.style.borderRadius = '8px';
        card.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        card.style.padding = '15px';
        card.style.minHeight = '200px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.position = 'relative';
        card.style.transition = 'transform 0.2s';
        
        card.onmouseover = () => card.style.transform = 'scale(1.02)';
        card.onmouseout = () => card.style.transform = 'none';

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '10px';
        deleteBtn.style.right = '10px';
        deleteBtn.style.background = 'rgba(0,0,0,0.1)';
        deleteBtn.style.border = 'none';
        deleteBtn.style.borderRadius = '50%';
        deleteBtn.style.width = '24px';
        deleteBtn.style.height = '24px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.color = '#333';
        deleteBtn.onclick = () => deleteStickyNote(note.id);

        const textarea = document.createElement('textarea');
        textarea.value = note.content || '';
        textarea.placeholder = 'Type your note here...';
        textarea.style.flex = '1';
        textarea.style.marginTop = '20px';
        textarea.style.background = 'transparent';
        textarea.style.border = 'none';
        textarea.style.resize = 'none';
        textarea.style.color = '#111';
        textarea.style.fontFamily = 'var(--font-sans)';
        textarea.style.fontSize = '14px';
        textarea.style.outline = 'none';
        
        textarea.addEventListener('input', (e) => {
            updateStickyNote(note.id, e.target.value);
        });

        card.appendChild(deleteBtn);
        card.appendChild(textarea);
        container.appendChild(card);
    });
}

function renderProjectsGrid() {
    const grid = document.getElementById('projectsGrid');
    if(!grid) return;

    grid.innerHTML = '';
    
    // Add "Create New Project" Card as the first item
    const addCard = document.createElement('div');
    addCard.style.border = '2px dashed var(--border-color)';
    addCard.style.borderRadius = '8px';
    addCard.style.padding = '15px';
    addCard.style.display = 'flex';
    addCard.style.flexDirection = 'column';
    addCard.style.justifyContent = 'center';
    addCard.style.alignItems = 'center';
    addCard.style.cursor = 'pointer';
    addCard.style.minHeight = '180px';
    addCard.style.transition = 'all 0.2s ease'; // fixed typo

    addCard.innerHTML = '<div style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 10px;">+</div>' +
                        '<div style="color: var(--text-secondary); font-weight: bold;">New Project</div>';
    
    addCard.onmouseover = () => addCard.style.borderColor = 'var(--text-primary)';
    addCard.onmouseout = () => addCard.style.borderColor = 'var(--border-color)';
    addCard.onclick = () => window.addNewPage();

    grid.appendChild(addCard);

    // Filter projects based on current mode
    const filteredPages = pages.filter(p => 
        window.currentUseCase === 'comic' ? p.type === 'comic' : (p.type === 'story' || !p.type)
    );

    if(filteredPages.length > 0) {
        filteredPages.forEach(page => {
            const card = document.createElement('div');
            card.style.border = '1px solid var(--border-color)';
            card.style.borderRadius = '8px';
            card.style.padding = '20px';
            card.style.backgroundColor = 'var(--bg-secondary)';
            card.style.cursor = 'pointer';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.justifyContent = 'space-between';
            card.style.minHeight = '180px';
            card.style.transition = 'transform 0.2s, box-shadow 0.2s';
            card.style.position = 'relative';

            card.onmouseover = () => { card.style.transform = 'translateY(-2px)'; card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; };
            card.onmouseout = () => { card.style.transform = 'none'; card.style.boxShadow = 'none'; };

            const tmp = document.createElement('div');
            tmp.innerHTML = page.content || '';
            const previewText = tmp.textContent.substring(0, 100) + '...';

            card.innerHTML = '<div style="margin-bottom: 10px;">' +
                '<h3 style="margin:0 0 10px 0; color: var(--text-primary); font-size: 1.2rem;">' + page.title + '</h3>' +
                '<p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0;">' + previewText + '</p>' +
                '</div>' +
                '<div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 15px;">' +
                '<span style="font-size: 11px; color: var(--text-tertiary); background: var(--bg-primary); padding: 4px 8px; border-radius: 12px;">ID: #' + page.id + '</span>' +
                '<div style="display:flex; gap:8px;">' +
                '<button class="button-primary" style="padding: 6px 12px; font-size: 12px; border-radius: 4px;" onclick="event.stopPropagation(); window.openPage(' + page.id + ')">Open</button>' +
                '<button style="padding: 6px 12px; font-size: 12px; border-radius: 4px; background: transparent; border: 1px solid #ff4444; color: #ff4444; cursor: pointer;" onclick="event.stopPropagation(); window.deletePage(' + page.id + ')"><i class="fa-solid fa-trash"></i></button>' +
                '</div></div>';

            card.onclick = () => window.openPage(page.id);
            grid.appendChild(card);
        });
    }
}// Hook into existing initialization and render
const _originalRender = renderPagesList;
renderPagesList = function() {
    _originalRender();
    renderProjectsGrid();
};

document.addEventListener('DOMContentLoaded', () => {
    loadGlobalNotes();






});


// ============================================
// Slash Commands System
// ============================================
function insertSlashCommand(item) {
    const cmd = item.getAttribute('data-cmd');
    const input = document.getElementById('editorAIInput');
    
    let template = '';
    if (cmd === '/character') {
        template = 'Create a character sheet. Include Name & Title, Visual Hook, Motivation, and The Conflict for: ';
    } else if (cmd === '/location') {
        template = 'Describe a unique setting using the Rule of Three (sight, sound, and an unusual sense) located at: ';
    } else if (cmd === '/lore') {
        template = 'Generate three Lore Fragments (superstitions, conflicts, traits) regarding: ';
    } else if (cmd === '/magic-system') {
        template = 'Define a magic system outline. Detail its source, its physical or mental cost, and one common misconception.';
    }

    input.value = template;
    document.getElementById('slashCommandMenu').classList.add('hidden');
    input.focus();
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('editorAIInput');
    const slashMenu = document.getElementById('slashCommandMenu');
    
    if (input && slashMenu) {
        // Detect typing for slash commands
        input.addEventListener('input', (e) => {
            if (e.target.value.trim() === '/') {
                slashMenu.classList.remove('hidden');
            } else {
                slashMenu.classList.add('hidden');
            }
        });

        // Hide when losing focus
        input.addEventListener('blur', (e) => {
            // Need a slight delay so clicks on menu items register
            setTimeout(() => {
                slashMenu.classList.add('hidden');
            }, 150);
        });
    }
});


// ============================================
// Feature: Zen Presentation Mode
// ============================================
function toggleZenMode() {
    document.body.classList.toggle("zen-mode");
    const isZen = document.body.classList.contains("zen-mode");
    const zenBtn = document.getElementById("zenModeToggle");
    if(zenBtn) {
        zenBtn.innerHTML = isZen 
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg> <span>Exit Zen Mode</span>`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg> <span>Zen Mode</span>`;
    }
}

// ============================================
// Feature: Voice Integration (Speech-to-Text & TTS)
// ============================================
let recognition = null;
let activeVoiceInput = null;
let mediaRecorder = null;
let mediaStream = null;
let recordedChunks = [];
let usingBackendSTT = false;
let backendTranscribing = false;
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    
    recognition.onresult = function(event) {
        const transcript = Array.from(event.results).map(result => result[0]).map(result => result.transcript).join("");
        if (activeVoiceInput) {
            activeVoiceInput.value = transcript;
        }
    };
    recognition.onerror = function(event) {
        console.error("Speech Recognition Error", event.error);
        if (event.error === "no-speech") {
            alert("No speech was detected. Please speak clearly and try again.");
        } else {
            alert("Browser speech recognition failed. Switching to server transcription mode.");
        }
        stopVoiceRecording();
    };
    recognition.onend = function() { stopVoiceRecording(); };
}

let isRecording = false;
let currentVoiceBtn = null;

function getStoredGroqApiKey() {
    return localStorage.getItem("groq_api_key") || "";
}

function cleanupMediaStream() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
}

async function transcribeRecordedAudio(audioBlob) {
    const formData = new FormData();
    formData.append("audio", audioBlob, "speech.webm");

    const apiKey = getStoredGroqApiKey();
    if (apiKey) {
        formData.append("api_key", apiKey);
    }

    const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
    });

    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return (payload.text || "").trim();
}

// ============================================
// Feature: Mode Switching (Story vs Comic)
// ============================================
function setMode(mode) {
    if (window.currentUseCase === mode) return; // Already in this mode

    const comicBtn = document.getElementById("comicModeBtn");
    const logoSvg = document.getElementById("homeLogoSvg");
    const ghostSvg = document.getElementById("comicGhostSvg");
    const greetingText = document.getElementById("homeGreetingText");
    const bookViewBtn = document.getElementById("bookViewToggle");
    
    if (mode === 'comic') {
        window.currentUseCase = 'comic';
        document.body.classList.add("comic-mode");
        
        // Remove 'Exit Comic Mode' change, let it just be an active button
        if (comicBtn) comicBtn.style.color = "var(--primary)";
        if (bookViewBtn) bookViewBtn.style.display = "flex";
        
        if (logoSvg) logoSvg.style.display = "none";
        if (ghostSvg) ghostSvg.style.display = "block";
        if (greetingText) greetingText.innerText = "Welcome to Comic Creator!";
    } else {
        window.currentUseCase = 'story';
        document.body.classList.remove("comic-mode");

        if (comicBtn) comicBtn.style.color = "";
        if (bookViewBtn) bookViewBtn.style.display = "none";
        
        if (logoSvg) logoSvg.style.display = "block";
        if (ghostSvg) ghostSvg.style.display = "none";
        if (greetingText) greetingText.innerText = "How can I help you today?";
    }
    
    // Re-render sidebar lists + project grids to reflect mode filtering
    if (typeof renderPagesList === 'function') {
        renderPagesList();
    }
}

async function startBackendVoiceRecording(btn) {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
        throw new Error("MediaRecorder is not supported in this browser.");
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream);
    usingBackendSTT = true;

    mediaRecorder.ondataavailable = function(event) {
        if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async function() {
        cleanupMediaStream();
        if (recordedChunks.length === 0) {
            return;
        }

        backendTranscribing = true;
        try {
            const audioBlob = new Blob(recordedChunks, { type: "audio/webm" });
            const transcript = await transcribeRecordedAudio(audioBlob);
            if (activeVoiceInput) {
                activeVoiceInput.value = transcript;
            }
        } catch (error) {
            console.error("Backend transcription failed", error);
            alert(`Transcription failed: ${error.message}`);
        } finally {
            backendTranscribing = false;
            recordedChunks = [];
        }
    };

    mediaRecorder.start();
    isRecording = true;
    btn.classList.add("recording");
}

function stopBackendVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
    stopVoiceRecording();
}

async function toggleVoiceInput(btn) {
    if (backendTranscribing) return;

    const parentForm = btn.closest("form");
    activeVoiceInput = parentForm ? parentForm.querySelector(".unified-search-input") : null;
    if (!activeVoiceInput) {
        alert("Voice input target not found.");
        return;
    }

    currentVoiceBtn = btn;

    if (isRecording) {
        if (usingBackendSTT) {
            stopBackendVoiceRecording();
        } else if (recognition) {
            recognition.stop();
        } else {
            stopVoiceRecording();
        }
    } else {
        try {
            // Prefer backend transcription for consistent behavior across browsers.
            await startBackendVoiceRecording(btn);
        } catch (error) {
            console.error("Unable to start backend voice recording", error);
            if (recognition) {
                try {
                    recognition.start();
                    isRecording = true;
                    usingBackendSTT = false;
                    btn.classList.add("recording");
                    return;
                } catch (fallbackError) {
                    console.error("Speech recognition fallback failed", fallbackError);
                }
            }
            alert("Unable to start voice input. Please allow microphone access and try again.");
        }
    }
}

function stopVoiceRecording() {
    isRecording = false;
    usingBackendSTT = false;
    if (currentVoiceBtn) {
        currentVoiceBtn.classList.remove("recording");
    }
    activeVoiceInput = null;
}

let currentAudioAudio = null;

async function playVoiceTTS(text, btnElement) {
    const elKey = localStorage.getItem('elevenlabs_api_key');
    const ttsText = text.replace(/\[IMAGE:.*?\]/g, ""); // Strip image tags
    
    if (elKey) {
        // ElevenLabs handling
        if (currentAudioAudio && !currentAudioAudio.paused) {
            currentAudioAudio.pause();
            btnElement.innerHTML = `<i class="fa-solid fa-play"></i> Read Aloud`;
            return;
        }
        
        btnElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating...`;
        try {
            // Using a default voice ID, eg, 'Adam' or 'Rachel'
            const voiceId = "pNInz6obpgDQGcFmaJgB"; // Replace with your preferred ElevenLabs voice ID
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: {
                    'accept': 'audio/mpeg',
                    'xi-api-key': elKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: ttsText,
                    model_id: "eleven_monolingual_v1",
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.5
                    }
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                currentAudioAudio = new Audio(url);
                currentAudioAudio.onended = () => {
                    btnElement.innerHTML = `<i class="fa-solid fa-play"></i> Read Aloud`;
                };
                currentAudioAudio.play();
                btnElement.innerHTML = `<i class="fa-solid fa-stop"></i> Stop Reading`;
            } else {
                console.error("ElevenLabs Error:", await response.text());
                alert("Error calling ElevenLabs API. Check console or your API key.");
                btnElement.innerHTML = `<i class="fa-solid fa-play"></i> Read Aloud`;
            }
        } catch (error) {
            console.error("TTS Error:", error);
            btnElement.innerHTML = `<i class="fa-solid fa-play"></i> Read Aloud`;
        }
        return;
    }
    
    // Fallback standard Browser TTS
    if (!("speechSynthesis" in window)) return;
    
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        btnElement.innerHTML = `<i class="fa-solid fa-play"></i> Read Aloud`;
        return;
    }

    const utterance = new SpeechSynthesisUtterance(ttsText);
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 0.95; // Slightly deeper voice

    // Look for a British or distinct voice
    const voices = window.speechSynthesis.getVoices();
    const specificVoice = voices.find(v => v.lang === "en-GB" || v.name.includes("Google UK English Male"));
    if (specificVoice) {
        utterance.voice = specificVoice;
    }

    utterance.onend = function() {
        btnElement.innerHTML = `<i class="fa-solid fa-play"></i> Read Aloud`;
    };

    btnElement.innerHTML = `<i class="fa-solid fa-stop"></i> Stop Reading`;
    window.speechSynthesis.speak(utterance);
}



// ============================================
// Feature: Tour / Onboarding Flow
// ============================================
const tourSteps = [
    { selector: ".sidebar-notion", title: "Your Creative Hub", text: "This is your workspace. Navigate between your dashboard, recent projects, and globally saved notes here." },
    { selector: "#editorAIInput", title: "Talk to Megha", text: "This is where the magic happens. Type your prompts here, try slash commands (like /character), or click the mic to use Voice Input!" },
    { selector: ".pages-title:nth-of-type(2)", title: "Chat Memory", text: "Your recent chats automatically save here. We keep your latest 5 active sessions so you never lose context!" },
    { selector: "#zenModeToggle", title: "Zen Mode", text: "Click this to hide the UI and focus purely on your generated story. Great for presenting!" }
];

let currentTourStep = 0;

function startTour(force = false) {
    if (!force && localStorage.getItem("tourCompleted_v1")) return;
    
    currentTourStep = 0;
    
    const overlay = document.createElement("div");
    overlay.className = "tour-overlay";
    overlay.id = "tourOverlay";
    document.body.appendChild(overlay);

    const popup = document.createElement("div");
    popup.className = "tour-popup";
    popup.id = "tourPopup";
    
    // Create button next to it
    popup.innerHTML = `
        <h3 id="tourTitle"></h3>
        <p id="tourText"></p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <button onclick="endTour()" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer;">Skip</button>
            <button onclick="nextTourStep()" style="background:var(--text-primary); color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;" id="tourNextBtn">Next</button>
        </div>
    `;
    document.body.appendChild(popup);
    
    showTourStep();
}

function showTourStep() {
    // Clear previous
    document.querySelectorAll(".tour-highlight").forEach(el => el.classList.remove("tour-highlight"));
    
    if (currentTourStep >= tourSteps.length) {
        endTour();
        return;
    }
    
    const step = tourSteps[currentTourStep];
    const target = document.querySelector(step.selector);
    
    document.getElementById("tourTitle").textContent = step.title;
    document.getElementById("tourText").textContent = step.text;
    
    const nextBtn = document.getElementById("tourNextBtn");
    if (currentTourStep === tourSteps.length - 1) {
        nextBtn.textContent = "Finish";
    } else {
        nextBtn.textContent = "Next";
    }
    
    if (target) {
        target.classList.add("tour-highlight");
        const rect = target.getBoundingClientRect();
        
        const popup = document.getElementById("tourPopup");
        
        // Position popup near target
        let top = rect.bottom + 20;
        let left = rect.left;
        
        // Adjust for edges
        if (top + 150 > window.innerHeight) top = rect.top - 170;
        if (left + 300 > window.innerWidth) left = window.innerWidth - 320;
        
        popup.style.top = top + "px";
        popup.style.left = Math.max(20, left) + "px";
    }
}

function nextTourStep() {
    currentTourStep++;
    showTourStep();
}

function endTour() {
    localStorage.setItem("tourCompleted_v1", "true");
    const overlay = document.getElementById("tourOverlay");
    const popup = document.getElementById("tourPopup");
    
    if(overlay) overlay.remove();
    if(popup) popup.remove();
    
    document.querySelectorAll(".tour-highlight").forEach(el => el.classList.remove("tour-highlight"));
}

document.addEventListener("DOMContentLoaded", () => {
    // Slight delay to ensure layout
    setTimeout(() => startTour(), 500);
});


function exportChatMarkDown() {
    const page = pages.find(p => p.id === currentPageId);
    if (!page) {
        alert('No active page to export.');
        return;
    }
    
    // Fallback: extract from UI if needed
    const history = extractChatHistory(page.content);
    if(history.length === 0) {
        alert('There is no chat history to export.');
        return;
    }
    
    let mdContent = '# Fantasy Engine Export - ' + page.title + '\n\n';
    history.forEach((msg) => {
        if (msg.role !== 'user') {
            // Strip out markdown image placeholders if desired, or keep them.
            // We just append the AI content cleanly without the User prompts.
            mdContent += msg.content + '\n\n';
        }
    });

    // If there were only user messages, or somehow it's empty
    if (mdContent.trim() === '# Fantasy Engine Export - ' + page.title) {
        alert('There is no story to export.');
        return;
    }
    
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (page.title.replace(/ /g, '_') || 'Export') + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportToPDF() {
    // Add print styles dynamically
    let printStyle = document.getElementById('print-style');
    if (!printStyle) {
        printStyle = document.createElement('style');
        printStyle.id = 'print-style';
        printStyle.innerHTML = `
            @media print {
                body * { visibility: hidden; }
                .editor-main * { visibility: visible; }
                .editor-main { position: absolute; left: 0; top: 0; box-shadow: none !important; margin: 0 !important; width: 100% !important; overflow: visible !important;}
                button, .bottom-unified-box, .sidebar, .action-buttons { display: none !important; }
                .chat-ai, .chat-user { break-inside: avoid; margin-bottom: 20px; }
            }
        `;
        document.head.appendChild(printStyle);
    }
    
    // Give time for layout, then open browser's print dialog
    setTimeout(() => {
        window.print();
    }, 100);
}


document.addEventListener('DOMContentLoaded', () => {
    const textareas = document.querySelectorAll('.unified-search-input');
    textareas.forEach(textarea => {
        // Auto-resize on input
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            const newHeight = Math.min(this.scrollHeight, 150); // max height ~150px
            this.style.height = newHeight + 'px';
            if (this.scrollHeight > 150) {
                this.style.overflowY = 'auto';
            } else {
                this.style.overflowY = 'hidden';
            }
        });

        // Submit on Enter, Newline on Shift+Enter
        textarea.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                // trigger form submit
                this.closest('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                
                // reset height
                this.style.height = 'auto';
                this.style.overflowY = 'hidden';
            }
        });
    });
});

// =========================================================================
// Comic Book View Logic
// =========================================================================

let bookPages = [];
let currentBookPageIndex = 0;

function toggleBookView() {
    const modal = document.getElementById('comicBookModal');
    const editorContent = document.getElementById('editor-content');
    
    // Group content into pages
    if (editorContent) {
        const messages = Array.from(editorContent.querySelectorAll('.chat-message'));
        bookPages = [];
        
        if (messages.length > 0) {
            // Intelligent grouping of chat messages to break long AI responses
            let currentPair = '';
            
            messages.forEach((msg) => {
                const isUser = msg.classList.contains('chat-user');
                
                if (isUser) {
                    // Flush previous
                    if (currentPair) {
                        bookPages.push(currentPair);
                        currentPair = '';
                    }
                    currentPair += msg.outerHTML;
                } else {
                    // It's an AI message, it could be long
                    const contentNode = msg.querySelector('.chat-content');
                    if (contentNode && contentNode.children.length > 0) {
                        const rawNodes = Array.from(contentNode.children);
                        let chunk = '';
                        let itemCount = 0;
                        
                        rawNodes.forEach(node => {
                            if (node.tagName === 'HR') {
                                if (chunk || currentPair) {
                                    bookPages.push(currentPair + `<div class="chat-message chat-ai"><div class="chat-content markdown-body" style="width:100%;">${chunk}</div></div>`);
                                    currentPair = '';
                                    chunk = '';
                                    itemCount = 0;
                                }
                            } else if (node.classList.contains('image-wrapper') || node.tagName === 'IMG') {
                                chunk += node.outerHTML;
                                bookPages.push(currentPair + `<div class="chat-message chat-ai"><div class="chat-content markdown-body" style="width:100%;">${chunk}</div></div>`);
                                currentPair = '';
                                chunk = '';
                                itemCount = 0;
                            } else {
                                chunk += node.outerHTML;
                                itemCount++;
                                if (itemCount >= 4 || chunk.length > 800) { // Break every 4 elements OR if string gets too large
                                    bookPages.push(currentPair + `<div class="chat-message chat-ai"><div class="chat-content markdown-body" style="width:100%;">${chunk}</div></div>`);
                                    currentPair = '';
                                    chunk = '';
                                    itemCount = 0;
                                }
                            }
                        });
                        
                        if (chunk) {
                            currentPair += `<div class="chat-message chat-ai"><div class="chat-content markdown-body" style="width:100%;">${chunk}</div></div>`;
                        }
                    } else {
                        currentPair += msg.outerHTML;
                    }
                }
            });
            
            if (currentPair) {
                bookPages.push(currentPair);
            }
            
        } else if (editorContent.innerHTML.trim().length > 0) {
            // Fallback if empty chat messages, but text exists (regular stories formatted as comic)
            const rawNodes = Array.from(editorContent.children);
            if (rawNodes.length > 0) {
                let chunk = '';
                rawNodes.forEach((node, index) => {
                    chunk += node.outerHTML;
                    // Split roughly by HR or every few elements to simulate pages
                    if (node.tagName === 'HR' || node.tagName === 'IMG' || node.classList.contains('image-wrapper') || (index > 0 && index % 4 === 0) || chunk.length > 800) {
                        bookPages.push(`<div class="chat-message chat-ai" style="padding-top:15px;"><div class="chat-content markdown-body" style="width:100%;">${chunk}</div></div>`);
                        chunk = '';
                    }
                });
                if (chunk) bookPages.push(`<div class="chat-message chat-ai" style="padding-top:15px;"><div class="chat-content markdown-body" style="width:100%;">${chunk}</div></div>`);
            } else {
                bookPages.push(`<div class="chat-message chat-ai" style="padding-top:15px;"><div class="chat-content markdown-body" style="width:100%;">${editorContent.innerHTML}</div></div>`);
            }
        }
        
        // Final fallback if totally empty
        if (bookPages.length === 0) {
            bookPages = ["<div style='text-align:center; padding-top:100px;'><h3>No pages yet!</h3><p>Generate some comic panels first.</p></div>"];
        }
        
        currentBookPageIndex = 0;
        updateBookPage(false); // pass false for no animation on open
    }
    
    modal.classList.add('active');
    
    // Hide nav buttons until cover is formally opened
    const prevBtn = document.getElementById('bookPrevBtn');
    const nextBtn = document.getElementById('bookNextBtn');
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
}

function updateBookNavVisibility() {
    const book = document.getElementById('comicBookContainer');
    const prevBtn = document.getElementById('bookPrevBtn');
    const nextBtn = document.getElementById('bookNextBtn');
    
    if (book && book.classList.contains('open')) {
        if(prevBtn) prevBtn.style.display = currentBookPageIndex > 0 ? 'inline-block' : 'none';
        if(nextBtn) nextBtn.style.display = currentBookPageIndex < bookPages.length - 1 ? 'inline-block' : 'none';
    } else {
        if(prevBtn) prevBtn.style.display = 'none';
        if(nextBtn) nextBtn.style.display = 'none';
    }
}

function getPageHTMLContent(index, side='right') {
    if (index < 0 || index >= bookPages.length) return '';
    let content = bookPages[index] + `<div style="text-align: center; margin-top: 20px; margin-bottom: 20px; color: #777; font-weight: bold;">- Page ${index + 1} of ${bookPages.length} -</div>`;
    
    if (side === 'right') {
        content += `<div class="page-corner page-corner-right" onclick="nextBookPage(event)"></div>`;
    } else if (side === 'left') {
        content += `<div class="page-corner page-corner-left" onclick="prevBookPage(event)"></div>`;
    }
    
    return content;
}

function updateBookPage(animateFlip = true, direction = 'next') {
    const insideContent = document.getElementById('bookInsideContent');
    const leftContent = document.getElementById('bookLeftPage');
    const book = document.getElementById('comicBookContainer');
    if (!insideContent || !book || bookPages.length === 0) return;

    if (!animateFlip) {
        insideContent.innerHTML = getPageHTMLContent(currentBookPageIndex, 'right');
        insideContent.scrollTop = 0;
        if(leftContent) {
            leftContent.innerHTML = currentBookPageIndex > 0 ? getPageHTMLContent(currentBookPageIndex - 1, 'left') : '';
            leftContent.scrollTop = 0;
        }
        updateBookNavVisibility();
        return;
    }

    // Realistic Flip Effect
    const flipLayer = document.createElement('div');
    flipLayer.className = 'real-page-turn';
    
    // Cleanup any existing previous layers just in case
    const existingLayers = book.querySelectorAll('.real-page-turn');
    existingLayers.forEach(el => el.parentNode.removeChild(el));
    
    const flipFront = document.createElement('div');
    flipFront.className = 'page-turn-face page-turn-front';
    
    const flipBack = document.createElement('div');
    flipBack.className = 'page-turn-face page-turn-back';
    
    flipLayer.appendChild(flipFront);
    flipLayer.appendChild(flipBack);
    
    if (direction === 'next') {
        const oldPageIndex = currentBookPageIndex - 1;
        
        // Front shows the old page (turning left)
        flipFront.innerHTML = getPageHTMLContent(oldPageIndex, 'right');
        // Back shows the current page's left side
        flipBack.innerHTML = getPageHTMLContent(currentBookPageIndex - 1, 'left');
        
        // As the page swings, reveal the new right page immediately
        insideContent.innerHTML = getPageHTMLContent(currentBookPageIndex, 'right');
        
        flipLayer.classList.add('animating-next');
    } else {
        const targetPageIndex = currentBookPageIndex;
        const oldPageIndex = currentBookPageIndex + 1;
        
        // Front shows target page (right side view when settling at 0deg)
        flipFront.innerHTML = getPageHTMLContent(targetPageIndex, 'right');
        // Back shows oldPageIndex coming from the left
        flipBack.innerHTML = getPageHTMLContent(oldPageIndex, 'left'); 
        
        // Book-inside still shows the old Page underneath during animation
        insideContent.innerHTML = getPageHTMLContent(oldPageIndex, 'right');
        
        flipLayer.classList.add('animating-prev');
    }

    book.appendChild(flipLayer);
    updateBookNavVisibility();
    insideContent.scrollTop = 0;

    // Remove layer and properly align state after animation
    setTimeout(() => {
        insideContent.innerHTML = getPageHTMLContent(currentBookPageIndex, 'right');
        insideContent.scrollTop = 0;
        if(leftContent) {
            leftContent.innerHTML = currentBookPageIndex > 0 ? getPageHTMLContent(currentBookPageIndex - 1, 'left') : '';
            leftContent.scrollTop = 0;
        }
        if (flipLayer.parentNode) {
            book.removeChild(flipLayer);
        }
    }, 700); // 0.7s matching CSS animation
}

function handleBookClick(event) {
    // Only handle if book is physically open
    const book = document.getElementById('comicBookContainer');
    if (!book || !book.classList.contains('open')) return;

    if(event.currentTarget.id === 'bookLeftPage') {
        prevBookPage(event);
    } else {
        nextBookPage(event);
    }
}

function nextBookPage(event) {
    if(event) event.stopPropagation();
    if (currentBookPageIndex < bookPages.length - 1) {
        currentBookPageIndex++;
        updateBookPage(true, 'next');
    }
}

function prevBookPage(event) {
    if(event) event.stopPropagation();
    if (currentBookPageIndex > 0) {
        currentBookPageIndex--;
        updateBookPage(true, 'prev');
    }
}

function closeBookView(event) {
    if (!event) {
        document.getElementById('comicBookModal').classList.remove('active');
        return;
    }
    
    const modal = document.getElementById('comicBookModal');
    
    // Check if the click was exactly on the modal overlay or the close button
    if (event.target === modal || event.target.closest('button')) {
        const book = document.getElementById('comicBookContainer');
        modal.classList.remove('active');
        if (book) book.classList.remove('open');
    }
}

