// API Configuration
const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' || 
                window.location.hostname.startsWith('192.168.');

const API_URL = isLocal ? `http://${window.location.hostname}:5000` : `https://${window.location.hostname}`;
console.log('API_URL configured as:', API_URL);

// State management
let currentUser = null;
let selectedTopics = [];
let customPracticeText = '';
let dictionary = [];
let learningLog = [];
let currentExercise = null;
let selectedDictionaryWords = new Set();
let touchTimer = null;
let touchStartPos = { x: 0, y: 0 };

// Practice state
let practiceMode = null;
let practiceWords = [];
let practiceIndex = 0;
let practiceLanguage = 'english';
let practiceDirection = 'german-to-target'; // or 'target-to-german'
let quizScore = { correct: 0, total: 0 };
let quizAnswered = false;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('App initialized - MongoDB version with Auth');
    checkAuthentication();
});

async function checkAuthentication() {
    try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            currentUser = await response.json();
            console.log('Logged in as:', currentUser.user.username);
            initializeApp();
        } else {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
    }
}

function initializeApp() {
    loadLocalSettings();
    loadServerData();
    initializeEventListeners();
    updateUI();
    testBackendConnection();
    updateUserInfo();
}

function updateUserInfo() {
    const header = document.querySelector('.header-content');
    if (currentUser && !document.getElementById('user-info')) {
        const userInfo = document.createElement('div');
        userInfo.id = 'user-info';
        userInfo.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);';
        userInfo.innerHTML = `
            <span style="color: #bdc3c7; font-size: 14px;">
                <i class="fas fa-user-circle"></i> ${currentUser.user.username}
            </span>
            <button onclick="handleLogout()" style="padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #bdc3c7; border-radius: 4px; cursor: pointer; font-size: 12px;">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        `;
        header.appendChild(userInfo);
    }
}

async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            localStorage.clear();
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Logout failed. Please try again.');
        }
    }
}

async function testBackendConnection() {
    try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        console.log('Backend connection successful:', data);
        
        if (!data.api_key_configured) {
            console.warn('WARNING: OpenAI API key is not configured!');
        }
        if (data.mongodb_status !== 'connected') {
            console.warn('WARNING: MongoDB is not connected!');
        }
    } catch (error) {
        console.error('Backend connection failed:', error);
    }
}

async function loadServerData() {
    try {
        showLoading(true);
        
        const dictResponse = await apiRequest(`${API_URL}/api/dictionary`, {
            credentials: 'include'
        });
        
        if (dictResponse && dictResponse.ok) {
            dictionary = await dictResponse.json();
            console.log(`✓ Loaded ${dictionary.length} words from server`);
        }
        
        const logResponse = await apiRequest(`${API_URL}/api/log`, {
            credentials: 'include'
        });
        
        if (logResponse && logResponse.ok) {
            learningLog = await logResponse.json();
            console.log(`✓ Loaded ${learningLog.length} log entries from server`);
        }
        
    } catch (error) {
        console.error('Error loading server data:', error);
    } finally {
        showLoading(false);
    }
}

function loadLocalSettings() {
    const savedTopics = localStorage.getItem('selectedTopics');
    if (savedTopics) selectedTopics = JSON.parse(savedTopics);
    
    const savedCustom = localStorage.getItem('customPracticeText');
    if (savedCustom) customPracticeText = savedCustom;
}

async function apiRequest(url, options = {}) {
    options.credentials = 'include';
    
    try {
        const response = await fetch(url, options);
        
        if (response.status === 401) {
            window.location.href = '/login.html';
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

function initializeEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            switchView(this.dataset.view);
        });
    });

    document.getElementById('save-topics-btn').addEventListener('click', saveTopics);
    document.getElementById('select-all-topics-btn').addEventListener('click', selectAllTopics);
    document.getElementById('deselect-all-topics-btn').addEventListener('click', deselectAllTopics);
    
    document.getElementById('start-exercise-btn').addEventListener('click', startExercise);
    document.getElementById('practice-selected-btn').addEventListener('click', practiceSelectedWords);
    
    document.getElementById('manual-add-btn').addEventListener('click', () => openManualAddModal());
    document.getElementById('search-dictionary').addEventListener('input', filterDictionary);
    document.getElementById('filter-type').addEventListener('change', filterDictionary);
    document.getElementById('filter-category').addEventListener('change', filterDictionary);
    document.getElementById('select-all-words-btn').addEventListener('click', selectAllWords);
    document.getElementById('deselect-all-words-btn').addEventListener('click', deselectAllWords);
    
    document.getElementById('close-modal-btn').addEventListener('click', closeWordModal);
    document.getElementById('add-selected-word-btn').addEventListener('click', addSelectedWord);
    document.getElementById('close-manual-modal-btn').addEventListener('click', closeManualModal);
    document.getElementById('save-manual-word-btn').addEventListener('click', saveManualWord);
    document.getElementById('close-edit-modal-btn').addEventListener('click', closeEditModal);
    document.getElementById('save-edit-word-btn').addEventListener('click', saveEditWord);
    
    document.getElementById('clear-log-btn').addEventListener('click', clearLog);
    
    document.getElementById('export-dictionary-btn').addEventListener('click', exportDictionary);
    document.getElementById('import-dictionary-btn').addEventListener('click', importDictionary);
    document.getElementById('import-file-input').addEventListener('change', handleFileImport);

    document.querySelectorAll('.topic-section-header').forEach(header => {
        header.addEventListener('click', function() {
            const section = this.parentElement;
            section.classList.toggle('collapsed');
        });
    });
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(viewName + '-view').classList.add('active');
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
    
    if (viewName === 'dictionary') {
        renderDictionary();
    } else if (viewName === 'log') {
        renderLog();
    } else if (viewName === 'training') {
        checkTrainingAvailability();
    } else if (viewName === 'practice') {
        // FIXED: Reset practice state completely when entering practice view
        exitPractice();
        checkPracticeAvailability();
    }
}

function selectAllTopics() {
    document.querySelectorAll('.topic-checkbox').forEach(cb => cb.checked = true);
}

function deselectAllTopics() {
    document.querySelectorAll('.topic-checkbox').forEach(cb => cb.checked = false);
}

function saveTopics() {
    customPracticeText = document.getElementById('custom-practice-input').value.trim();
    
    const checkboxes = document.querySelectorAll('.topic-checkbox:checked');
    selectedTopics = Array.from(checkboxes).map(cb => ({
        value: cb.value,
        category: cb.dataset.category
    }));
    
    localStorage.setItem('selectedTopics', JSON.stringify(selectedTopics));
    localStorage.setItem('customPracticeText', customPracticeText);
    
    const message = document.getElementById('topics-message');
    
    if (customPracticeText.length > 0 || selectedTopics.length > 0) {
        let messageText = '';
        if (customPracticeText.length > 0) {
            messageText = `Custom practice topic saved: "${customPracticeText.substring(0, 50)}${customPracticeText.length > 50 ? '...' : ''}"`;
            addLog(`Custom practice: ${customPracticeText}`);
        }
        if (selectedTopics.length > 0) {
            if (messageText) messageText += ' | ';
            messageText += `${selectedTopics.length} topic(s) selected`;
            addLog(`Selected topics: ${selectedTopics.map(t => t.value).join(', ')}`);
        }
        message.textContent = messageText;
        message.className = 'message success';
    } else {
        message.textContent = 'Please either enter a custom practice topic or select at least one topic.';
        message.className = 'message error';
    }
    
    setTimeout(() => {
        message.textContent = '';
        message.className = 'message';
    }, 4000);
}

function checkTrainingAvailability() {
    const noTopicsMsg = document.getElementById('no-topics-message');
    const trainingArea = document.getElementById('training-area');
    
    if (selectedTopics.length === 0 && dictionary.length === 0 && !customPracticeText) {
        noTopicsMsg.style.display = 'block';
        trainingArea.style.display = 'none';
    } else {
        noTopicsMsg.style.display = 'none';
        trainingArea.style.display = 'block';
        updatePracticeButton();
    }
}

function updatePracticeButton() {
    const btn = document.getElementById('practice-selected-btn');
    const count = selectedDictionaryWords.size;
    if (count > 0) {
        btn.textContent = `🎯 Practice Selected Words (${count})`;
        btn.style.display = 'inline-block';
    } else {
        btn.style.display = 'none';
    }
}

async function startExercise() {
    if (selectedTopics.length === 0 && !customPracticeText && dictionary.length === 0) {
        alert('Please select topics, enter custom practice text, or add words to your dictionary first!');
        return;
    }
    
    const exerciseType = document.getElementById('exercise-type').value;
    showLoading(true);
    
    let topicsToSend = [...selectedTopics];
    if (customPracticeText) {
        topicsToSend.push({
            value: 'custom_practice',
            category: 'custom',
            text: customPracticeText
        });
    }
    
    try {
        const response = await apiRequest(`${API_URL}/exercise`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topics: topicsToSend,
                exercise_type: exerciseType,
                dictionary_words: []
            })
        });
        
        if (!response) return;
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get exercise');
        }
        
        currentExercise = await response.json();
        renderExercise(currentExercise);
        addLog(`Started ${exerciseType} exercise`);
    } catch (error) {
        console.error('Error:', error);
        alert(`Failed to load exercise: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

async function practiceSelectedWords() {
    if (selectedDictionaryWords.size === 0) {
        alert('Please select words from your dictionary to practice!');
        return;
    }
    
    const selectedWords = Array.from(selectedDictionaryWords).map(id => 
        dictionary.find(w => w.id === id)
    ).filter(w => w);
    
    const exerciseType = document.getElementById('exercise-type').value;
    showLoading(true);
    
    try {
        const response = await apiRequest(`${API_URL}/exercise`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topics: selectedTopics,
                exercise_type: exerciseType,
                dictionary_words: selectedWords
            })
        });
        
        if (!response) return;
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get exercise');
        }
        
        currentExercise = await response.json();
        renderExercise(currentExercise);
        addLog(`Practiced ${selectedWords.length} selected words`);
    } catch (error) {
        console.error('Error:', error);
        alert(`Failed to load exercise: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function renderExercise(exercise) {
    const container = document.getElementById('exercise-container');
    
    let formattedQuestion = exercise.question
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    
    const usingDict = exercise.using_dictionary ? 
        '<div class="info-badge">🎯 Using your dictionary words!</div>' : '';
    
    container.innerHTML = `
        ${usingDict}
        <div class="word-select-hint mobile-hint">
            <span class="desktop-hint">💡 Double-click any word to add it to your dictionary!</span>
            <span class="mobile-hint-text">💡 Tap and hold any word to add it to your dictionary!</span>
        </div>
        <div class="exercise-question selectable-text" id="exercise-text">${formattedQuestion}</div>
        <textarea class="exercise-input" id="exercise-answer" rows="4" placeholder="Type your answer here..."></textarea>
        <button class="btn-primary" onclick="submitAnswer()">Submit Answer</button>
        <button class="btn-secondary" onclick="startExercise()">New Exercise</button>
        <div id="exercise-feedback"></div>
    `;
    
    const exerciseText = document.getElementById('exercise-text');
    exerciseText.addEventListener('dblclick', handleWordSelection);
    exerciseText.addEventListener('touchstart', handleTouchStart, { passive: false });
    exerciseText.addEventListener('touchend', handleTouchEnd);
    exerciseText.addEventListener('touchmove', handleTouchMove);
}

function handleTouchStart(event) {
    const touch = event.touches[0];
    touchStartPos = {
        x: touch.clientX,
        y: touch.clientY
    };
    
    touchTimer = setTimeout(() => {
        handleWordSelectionFromTouch(event);
    }, 500);
}

function handleTouchMove(event) {
    if (touchTimer) {
        const touch = event.touches[0];
        const moveDistance = Math.sqrt(
            Math.pow(touch.clientX - touchStartPos.x, 2) + 
            Math.pow(touch.clientY - touchStartPos.y, 2)
        );
        
        if (moveDistance > 10) {
            clearTimeout(touchTimer);
            touchTimer = null;
        }
    }
}

function handleTouchEnd(event) {
    if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
    }
}

function handleWordSelectionFromTouch(event) {
    event.preventDefault();
    
    const touch = event.touches[0];
    const range = document.caretRangeFromPoint(touch.clientX, touch.clientY);
    
    if (range) {
        const textNode = range.startContainer;
        if (textNode.nodeType === Node.TEXT_NODE) {
            const text = textNode.textContent;
            let start = range.startOffset;
            let end = range.startOffset;
            
            while (start > 0 && /\S/.test(text[start - 1])) {
                start--;
            }
            
            while (end < text.length && /\S/.test(text[end])) {
                end++;
            }
            
            const word = text.substring(start, end).trim();
            
            if (word && word.length > 0 && word.split(' ').length <= 3) {
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
                
                openWordModal(word);
            }
        }
    }
}

function handleWordSelection(event) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText && selectedText.length > 0 && selectedText.split(' ').length <= 3) {
        openWordModal(selectedText);
    }
}

function openWordModal(word) {
    const modal = document.getElementById('word-selection-modal');
    document.getElementById('word-context').textContent = `Selected: "${word}"`;
    document.getElementById('selected-word-input').value = word;
    modal.classList.add('active');
    
    if (window.innerWidth > 768) {
        setTimeout(() => {
            document.getElementById('selected-word-input').focus();
        }, 100);
    }
}

function closeWordModal() {
    document.getElementById('word-selection-modal').classList.remove('active');
}

async function addSelectedWord() {
    const word = document.getElementById('selected-word-input').value.trim();

    if (!word) {
        alert('Please enter a word!');
        return;
    }

    showLoading(true);
    closeWordModal();

    try {
        const response = await apiRequest(`${API_URL}/analyze-word`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                word: word,
                context: currentExercise ? currentExercise.question : ''
            })
        });

        if (!response) return;

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to analyze word');
        }

        const wordData = await response.json();

        const dictionaryEntry = {
            id: Date.now(),
            german: wordData.german,
            english: wordData.english,
            russian: wordData.russian,
            type: wordData.type,
            category: wordData.category,
            explanation: wordData.explanation,
            examples: Array.isArray(wordData.examples) ? wordData.examples : [],
            timestamp: new Date().toISOString()
        };

        const addResponse = await apiRequest(`${API_URL}/api/dictionary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dictionaryEntry)
        });

        if (addResponse && addResponse.ok) {
            const serverWord = await addResponse.json();
            dictionary.push(serverWord);
            addLog(`Added: ${wordData.german}`);
            alert(`Word "${wordData.german}" added to dictionary!`);
        }

    } catch (error) {
        console.error('Error:', error);
        alert(`Failed to add word: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

async function submitAnswer() {
    const answer = document.getElementById('exercise-answer').value.trim();
    
    if (!answer) {
        alert('Please provide an answer!');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await apiRequest(`${API_URL}/check-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: currentExercise.question,
                answer: answer,
                exercise_type: document.getElementById('exercise-type').value
            })
        });
        
        if (!response) return;
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to check answer');
        }
        
        const result = await response.json();
        displayFeedback(result);
        addLog(`Completed exercise`);
    } catch (error) {
        console.error('Error:', error);
        alert(`Failed to check answer: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function displayFeedback(result) {
    const feedbackDiv = document.getElementById('exercise-feedback');
    feedbackDiv.className = 'exercise-feedback';
    feedbackDiv.innerHTML = result.feedback.replace(/\n/g, '<br>');
}

function openEditModal(id) {
    const word = dictionary.find(w => w.id === id);
    if (!word) return;
    
    document.getElementById('edit-word-id').value = word.id;
    document.getElementById('edit-german').value = word.german;
    document.getElementById('edit-english').value = word.english;
    document.getElementById('edit-russian').value = word.russian;
    document.getElementById('edit-type').value = word.type;
    document.getElementById('edit-category').value = word.category;
    document.getElementById('edit-explanation').value = word.explanation || '';
    document.getElementById('edit-examples').value = (word.examples || []).join('\n');
    
    document.getElementById('edit-word-modal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('edit-word-modal').classList.remove('active');
}

async function saveEditWord() {
    const id = parseInt(document.getElementById('edit-word-id').value);
    const word = dictionary.find(w => w.id === id);
    
    if (!word) return;
    
    const updatedData = {
        german: document.getElementById('edit-german').value.trim(),
        english: document.getElementById('edit-english').value.trim(),
        russian: document.getElementById('edit-russian').value.trim(),
        type: document.getElementById('edit-type').value,
        category: document.getElementById('edit-category').value,
        explanation: document.getElementById('edit-explanation').value.trim(),
        examples: document.getElementById('edit-examples').value.trim().split('\n').filter(e => e.trim())
    };
    
    const response = await apiRequest(`${API_URL}/api/dictionary/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
    });
    
    if (response && response.ok) {
        Object.assign(word, updatedData);
        closeEditModal();
        renderDictionary();
        showDictionaryMessage('Word updated successfully!', 'success');
        addLog(`Edited: ${word.german}`);
    } else {
        alert('Failed to update word on server');
    }
}

function toggleWordSelection(id) {
    if (selectedDictionaryWords.has(id)) {
        selectedDictionaryWords.delete(id);
    } else {
        selectedDictionaryWords.add(id);
    }
    updatePracticeButton();
    renderDictionary();
}

function selectAllWords() {
    dictionary.forEach(w => selectedDictionaryWords.add(w.id));
    updatePracticeButton();
    renderDictionary();
}

function deselectAllWords() {
    selectedDictionaryWords.clear();
    updatePracticeButton();
    renderDictionary();
}

function openManualAddModal() {
    document.getElementById('manual-add-modal').classList.add('active');
}

function closeManualModal() {
    document.getElementById('manual-add-modal').classList.remove('active');
    clearManualForm();
}

function clearManualForm() {
    document.getElementById('manual-german').value = '';
    document.getElementById('manual-english').value = '';
    document.getElementById('manual-russian').value = '';
    document.getElementById('manual-type').value = '';
    document.getElementById('manual-category').value = '';
    document.getElementById('manual-explanation').value = '';
    document.getElementById('manual-examples').value = '';
}

async function saveManualWord() {
    const german = document.getElementById('manual-german').value.trim();
    const english = document.getElementById('manual-english').value.trim();
    const russian = document.getElementById('manual-russian').value.trim();
    const type = document.getElementById('manual-type').value;
    const category = document.getElementById('manual-category').value;
    const explanation = document.getElementById('manual-explanation').value.trim();
    const examples = document.getElementById('manual-examples').value.trim();
    
    if (!german || !english || !russian || !type || !category) {
        alert('Please fill in all required fields');
        return;
    }
    
    const word = {
        id: Date.now(),
        german, english, russian, type, category, explanation,
        examples: examples.split('\n').filter(e => e.trim()),
        timestamp: new Date().toISOString()
    };
    
    const response = await apiRequest(`${API_URL}/api/dictionary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(word)
    });
    
    if (response && response.ok) {
        const serverWord = await response.json();
        dictionary.push(serverWord);
        closeManualModal();
        showDictionaryMessage('Word added successfully!', 'success');
        renderDictionary();
        addLog(`Manually added: ${german}`);
    }
}

async function deleteWord(id) {
    if (confirm('Are you sure you want to delete this word?')) {
        const word = dictionary.find(w => w.id === id);
        
        const response = await apiRequest(`${API_URL}/api/dictionary/${id}`, {
            method: 'DELETE'
        });
        
        if (response && response.ok) {
            dictionary = dictionary.filter(w => w.id !== id);
            selectedDictionaryWords.delete(id);
            renderDictionary();
            updatePracticeButton();
            addLog(`Deleted: ${word.german}`);
        } else {
            alert('Failed to delete word from server');
        }
    }
}

function filterDictionary() {
    const searchTerm = document.getElementById('search-dictionary').value.toLowerCase();
    const typeFilter = document.getElementById('filter-type').value;
    const categoryFilter = document.getElementById('filter-category').value;
    renderDictionary(searchTerm, typeFilter, categoryFilter);
}

function renderDictionary(search = '', typeFilter = '', categoryFilter = '') {
    const listDiv = document.getElementById('dictionary-list');
    
    let filtered = dictionary.filter(w => {
        const matchesSearch = !search || 
            w.german.toLowerCase().includes(search) || 
            w.english.toLowerCase().includes(search) ||
            w.russian.toLowerCase().includes(search);
        
        const matchesType = !typeFilter || w.type === typeFilter;
        const matchesCategory = !categoryFilter || w.category === categoryFilter;
        
        return matchesSearch && matchesType && matchesCategory;
    });
    
    if (filtered.length === 0) {
        listDiv.innerHTML = '<p style="text-align: center; padding: 20px; color: #7f8c8d;">No words found.</p>';
        return;
    }
    
    listDiv.innerHTML = filtered.map(word => {
        const isSelected = selectedDictionaryWords.has(word.id);
        const selectedClass = isSelected ? 'selected-for-practice' : '';
        
        return `
        <div class="dictionary-item ${selectedClass}">
            <div class="word-header">
                <div class="word-select-checkbox">
                    <input type="checkbox" 
                           ${isSelected ? 'checked' : ''} 
                           onchange="toggleWordSelection(${word.id})"
                           title="Select for practice">
                </div>
                <div class="word-main">
                    <div class="word-german">${word.german}</div>
                    <div class="word-translations">
                        <span class="word-english">🇬🇧 ${word.english}</span>
                        <span class="word-russian">🇷🇺 ${word.russian}</span>
                    </div>
                    <div class="word-meta">
                        <span class="word-badge badge-type">${word.type}</span>
                        <span class="word-badge badge-category">${word.category}</span>
                    </div>
                </div>
                <div class="word-actions">
                    <button onclick="openEditModal(${word.id})" title="Edit">✏️</button>
                    <button onclick="deleteWord(${word.id})" title="Delete">🗑️</button>
                </div>
            </div>
            ${word.explanation ? `
                <div class="word-details">
                    <div class="word-explanation"><strong>Explanation:</strong> ${word.explanation}</div>
                </div>
            ` : ''}
            ${word.examples && word.examples.length > 0 ? `
                <div class="word-details">
                    <div class="word-examples">
                        <strong>Examples:</strong>
                        ${word.examples.map(ex => `• ${ex}`).join('<br>')}
                    </div>
                </div>
            ` : ''}
        </div>
    `}).join('');
}

function showDictionaryMessage(text, type) {
    const message = document.getElementById('dictionary-message');
    message.textContent = text;
    message.className = `message ${type}`;
    setTimeout(() => {
        message.textContent = '';
        message.className = 'message';
    }, 3000);
}

async function addLog(content) {
    learningLog.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        content: content
    });
    
    await apiRequest(`${API_URL}/api/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    });
}

async function clearLog() {
    if (confirm('Clear entire log?')) {
        const response = await apiRequest(`${API_URL}/api/log`, {
            method: 'DELETE'
        });
        
        if (response && response.ok) {
            learningLog = [];
            renderLog();
        }
    }
}

function renderLog() {
    const listDiv = document.getElementById('log-list');
    
    if (learningLog.length === 0) {
        listDiv.innerHTML = '<p style="text-align: center; padding: 20px; color: #7f8c8d;">No log entries yet.</p>';
        return;
    }
    
    listDiv.innerHTML = learningLog.map(entry => `
        <div class="log-item">
            <div class="log-timestamp">${new Date(entry.timestamp).toLocaleString()}</div>
            <div class="log-content">${entry.content}</div>
        </div>
    `).join('');
}

function updateUI() {
    document.querySelectorAll('.topic-checkbox').forEach(checkbox => {
        checkbox.checked = selectedTopics.some(t => t.value === checkbox.value);
    });
    
    const customInput = document.getElementById('custom-practice-input');
    if (customInput && customPracticeText) {
        customInput.value = customPracticeText;
    }
}

function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

function exportDictionary() {
    if (dictionary.length === 0) {
        alert('Your dictionary is empty. Nothing to export.');
        return;
    }
    
    const dataStr = JSON.stringify(dictionary, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `german-dictionary-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addLog('Exported dictionary');
    showDictionaryMessage(`Exported ${dictionary.length} words successfully!`, 'success');
}

function importDictionary() {
    document.getElementById('import-file-input').click();
}

async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
        alert('Please select a valid JSON file.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (!Array.isArray(importedData)) {
                alert('Invalid file format. Expected an array of words.');
                return;
            }
            
            if (confirm(`Import ${importedData.length} words? This will add them to your dictionary on the server.`)) {
                showLoading(true);
                let addedCount = 0;
                
                for (const word of importedData) {
                    const exists = dictionary.some(w => w.german === word.german);
                    if (!exists) {
                        const response = await apiRequest(`${API_URL}/api/dictionary`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ...word,
                                id: Date.now() + Math.random(),
                                timestamp: word.timestamp || new Date().toISOString()
                            })
                        });
                        
                        if (response && response.ok) {
                            const serverWord = await response.json();
                            dictionary.push(serverWord);
                            addedCount++;
                        }
                    }
                }
                
                showLoading(false);
                renderDictionary();
                addLog(`Imported ${addedCount} new words`);
                showDictionaryMessage(`Successfully imported ${addedCount} new words!`, 'success');
            }
        } catch (error) {
            console.error('Import error:', error);
            alert('Error reading file. Please ensure it\'s a valid JSON file.');
            showLoading(false);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ==================== PRACTICE MODE FUNCTIONS ====================

function checkPracticeAvailability() {
    const noWordsMsg = document.getElementById('no-words-message');
    const practiceMenu = document.getElementById('practice-menu');
    const wordCount = document.getElementById('practice-word-count');
    
    if (dictionary.length === 0) {
        noWordsMsg.style.display = 'block';
        practiceMenu.style.display = 'none';
    } else {
        noWordsMsg.style.display = 'none';
        practiceMenu.style.display = 'block';
        wordCount.textContent = dictionary.length;
        
        // Update selected words count
        const selectedCount = document.getElementById('practice-selected-count');
        if (selectedCount) {
            selectedCount.textContent = selectedDictionaryWords.size;
        }
    }
}

function startFlashcards(language, direction = 'german-to-target') {
    const wordsToUse = selectedDictionaryWords.size > 0 
        ? Array.from(selectedDictionaryWords).map(id => dictionary.find(w => w.id === id)).filter(w => w)
        : dictionary;
    
    if (wordsToUse.length < 1) {
        alert('You need at least 1 word to practice!');
        return;
    }
    
    practiceMode = 'flashcard';
    practiceLanguage = language;
    practiceDirection = direction;
    practiceWords = [...wordsToUse].sort(() => Math.random() - 0.5);
    practiceIndex = 0;
    
    document.getElementById('practice-menu').style.display = 'none';
    document.getElementById('practice-area').style.display = 'block';
    document.getElementById('flashcard-container').style.display = 'block';
    document.getElementById('quiz-container').style.display = 'none';
    
    updatePracticeLanguageBadge();
    showFlashcard();
    
    const directionText = direction === 'german-to-target' 
        ? `German → ${language === 'english' ? 'English' : 'Russian'}`
        : `${language === 'english' ? 'English' : 'Russian'} → German`;
    addLog(`Started flashcard practice: ${directionText} (${wordsToUse.length} words)`);
}

function startQuiz(language, direction = 'german-to-target') {
    const wordsToUse = selectedDictionaryWords.size > 0 
        ? Array.from(selectedDictionaryWords).map(id => dictionary.find(w => w.id === id)).filter(w => w)
        : dictionary;
    
    if (wordsToUse.length < 4) {
        alert('You need at least 4 words for quiz mode!');
        return;
    }
    
    practiceMode = 'quiz';
    practiceLanguage = language;
    practiceDirection = direction;
    practiceWords = [...wordsToUse].sort(() => Math.random() - 0.5);
    practiceIndex = 0;
    quizScore = { correct: 0, total: 0 };
    quizAnswered = false;
    
    document.getElementById('practice-menu').style.display = 'none';
    document.getElementById('practice-area').style.display = 'block';
    document.getElementById('flashcard-container').style.display = 'none';
    document.getElementById('quiz-container').style.display = 'block';
    
    updatePracticeLanguageBadge();
    updateQuizScore();
    showQuizQuestion();
    
    const directionText = direction === 'german-to-target' 
        ? `German → ${language === 'english' ? 'English' : 'Russian'}`
        : `${language === 'english' ? 'English' : 'Russian'} → German`;
    addLog(`Started quiz: ${directionText} (${wordsToUse.length} words)`);
}

function updatePracticeLanguageBadge() {
    const badge = document.getElementById('practice-language-indicator');
    const flag = practiceLanguage === 'english' ? '🇬🇧' : '🇷🇺';
    const lang = practiceLanguage === 'english' ? 'English' : 'Russian';
    
    if (practiceDirection === 'german-to-target') {
        badge.textContent = `${flag} German → ${lang}`;
    } else {
        badge.textContent = `${flag} ${lang} → German`;
    }
    
    if (practiceMode === 'flashcard') {
        const frontLabel = document.getElementById('flashcard-front-label');
        const backLabel = document.getElementById('flashcard-back-label');
        
        if (practiceDirection === 'german-to-target') {
            frontLabel.textContent = 'German';
            backLabel.textContent = lang;
        } else {
            frontLabel.textContent = lang;
            backLabel.textContent = 'German';
        }
    }
}

function showFlashcard() {
    const word = practiceWords[practiceIndex];
    const flashcard = document.getElementById('flashcard');
    
    // FIXED: Reset flip state BEFORE updating content
    flashcard.classList.remove('flipped');
    
    // Use requestAnimationFrame to ensure smooth transition
    requestAnimationFrame(() => {
        if (practiceDirection === 'german-to-target') {
            document.getElementById('flashcard-german').textContent = word.german;
            document.getElementById('flashcard-type-front').textContent = word.type;
            document.getElementById('flashcard-translation').textContent = word[practiceLanguage];
            document.getElementById('flashcard-german-back').textContent = word.german;
        } else {
            document.getElementById('flashcard-german').textContent = word[practiceLanguage];
            document.getElementById('flashcard-type-front').textContent = word.type;
            document.getElementById('flashcard-translation').textContent = word.german;
            document.getElementById('flashcard-german-back').textContent = word[practiceLanguage];
        }
        
        updatePracticeProgress();
        updatePracticeNavButtons();
    });
}

function flipCard() {
    const flashcard = document.getElementById('flashcard');
    flashcard.classList.toggle('flipped');
}

function showQuizQuestion() {
    const word = practiceWords[practiceIndex];
    quizAnswered = false;
    
    if (practiceDirection === 'german-to-target') {
        document.getElementById('quiz-german').textContent = word.german;
    } else {
        document.getElementById('quiz-german').textContent = word[practiceLanguage];
    }
    
    document.getElementById('quiz-type').textContent = word.type;
    
    const correctAnswer = practiceDirection === 'german-to-target' 
        ? word[practiceLanguage]
        : word.german;
    
    const incorrectOptions = practiceWords
        .filter(w => w.id !== word.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => practiceDirection === 'german-to-target' ? w[practiceLanguage] : w.german);
    
    const allOptions = [...incorrectOptions, correctAnswer].sort(() => Math.random() - 0.5);
    
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = allOptions.map(option => `
        <button class="quiz-option" onclick="selectQuizAnswer('${option.replace(/'/g, "\\'")}', '${correctAnswer.replace(/'/g, "\\'")}')">
            ${option}
        </button>
    `).join('');
    
    document.getElementById('quiz-feedback').style.display = 'none';
    
    updatePracticeProgress();
    updatePracticeNavButtons();
}

function selectQuizAnswer(selected, correct) {
    if (quizAnswered) return;
    
    quizAnswered = true;
    const isCorrect = selected === correct;
    
    quizScore.total++;
    if (isCorrect) {
        quizScore.correct++;
    }
    updateQuizScore();
    
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(button => {
        button.classList.add('disabled');
        const buttonText = button.textContent.trim();
        
        if (buttonText === selected) {
            button.classList.add(isCorrect ? 'correct' : 'incorrect');
        } else if (buttonText === correct) {
            button.classList.add('show-correct');
        }
    });
    
    const feedback = document.getElementById('quiz-feedback');
    const word = practiceWords[practiceIndex];
    
    let feedbackText = '';
    if (practiceDirection === 'german-to-target') {
        feedbackText = `<strong>${word.german}</strong> = ${word[practiceLanguage]}`;
    } else {
        feedbackText = `<strong>${word[practiceLanguage]}</strong> = ${word.german}`;
    }
    
    feedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    feedback.innerHTML = `
        <div class="quiz-feedback-header">
            ${isCorrect ? '✅ Correct! 🎉' : '❌ Incorrect'}
        </div>
        <div class="quiz-feedback-text">
            ${feedbackText}
        </div>
    `;
    feedback.style.display = 'block';
    
    // FIXED: Update navigation buttons after answer
    updatePracticeNavButtons();
    
    if (practiceIndex === practiceWords.length - 1) {
        setTimeout(() => {
            showQuizComplete();
        }, 1500);
    }
}

function updateQuizScore() {
    document.getElementById('quiz-correct').textContent = quizScore.correct;
    document.getElementById('quiz-total').textContent = quizScore.total;
}

function showQuizComplete() {
    const percentage = Math.round((quizScore.correct / quizScore.total) * 100);
    const feedback = document.getElementById('quiz-feedback');
    
    feedback.className = 'quiz-complete';
    feedback.innerHTML = `
        <h3>Quiz Complete! 🎊</h3>
        <div class="quiz-complete-score">
            Final Score: <strong>${quizScore.correct}/${quizScore.total}</strong> (${percentage}%)
        </div>
        <button class="btn-primary" onclick="startQuiz('${practiceLanguage}', '${practiceDirection}')">
            <i class="fas fa-redo"></i> Try Again
        </button>
    `;
    feedback.style.display = 'block';
}

function updatePracticeProgress() {
    document.getElementById('practice-current').textContent = practiceIndex + 1;
    document.getElementById('practice-total').textContent = practiceWords.length;
}

function updatePracticeNavButtons() {
    const prevBtn = document.getElementById('practice-prev-btn');
    const nextBtn = document.getElementById('practice-next-btn');
    
    prevBtn.disabled = practiceIndex === 0;
    
    if (practiceMode === 'quiz') {
        nextBtn.disabled = !quizAnswered || practiceIndex === practiceWords.length - 1;
        nextBtn.innerHTML = practiceIndex === practiceWords.length - 1 ? 
            '<i class="fas fa-flag-checkered"></i> Finish' : 
            'Next <i class="fas fa-chevron-right"></i>';
    } else {
        nextBtn.disabled = practiceIndex === practiceWords.length - 1;
        nextBtn.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
    }
}

function nextCard() {
    if (practiceIndex < practiceWords.length - 1) {
        practiceIndex++;
        
        if (practiceMode === 'flashcard') {
            showFlashcard();
        } else {
            showQuizQuestion();
        }
    }
}

function previousCard() {
    if (practiceIndex > 0) {
        practiceIndex--;
        
        if (practiceMode === 'flashcard') {
            showFlashcard();
        } else {
            alert('Cannot go back in quiz mode!');
            practiceIndex++;
        }
    }
}

function shufflePractice() {
    practiceWords = practiceWords.sort(() => Math.random() - 0.5);
    practiceIndex = 0;
    
    if (practiceMode === 'flashcard') {
        showFlashcard();
    } else {
        quizScore = { correct: 0, total: 0 };
        updateQuizScore();
        showQuizQuestion();
    }
    
    addLog('Shuffled practice words');
}

function exitPractice() {
    document.getElementById('practice-menu').style.display = 'block';
    document.getElementById('practice-area').style.display = 'none';
    
    const flashcard = document.getElementById('flashcard');
    if (flashcard) {
        flashcard.classList.remove('flipped');
    }
    
    if (quizScore.total > 0) {
        addLog(`Quiz completed: ${quizScore.correct}/${quizScore.total} correct`);
    }
    
    practiceMode = null;
    practiceWords = [];
    practiceIndex = 0;
    quizScore = { correct: 0, total: 0 };
}

