// API Configuration
const API_URL = 'http://localhost:5000/api';

// DOM Elements
let sourceLang, targetLang, inputText, translateBtn, voiceBtn, clearBtn;
let originalTextSpan, translatedTextSpan, pronunciationSpan;
let speakOriginalBtn, speakTranslatedBtn, recordBtn, scoreSpan, feedbackSpan;
let themeToggle;

// State
let currentOriginal = '';
let currentTranslated = '';
let currentTargetLang = 'ur';
let isRecording = false;
let recognition = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Get elements
    sourceLang = document.getElementById('sourceLang');
    targetLang = document.getElementById('targetLang');
    inputText = document.getElementById('inputText');
    translateBtn = document.getElementById('translateBtn');
    voiceBtn = document.getElementById('voiceBtn');
    clearBtn = document.getElementById('clearBtn');
    originalTextSpan = document.getElementById('originalText');
    translatedTextSpan = document.getElementById('translatedText');
    pronunciationSpan = document.getElementById('pronunciation');
    speakOriginalBtn = document.getElementById('speakOriginal');
    speakTranslatedBtn = document.getElementById('speakTranslated');
    recordBtn = document.getElementById('recordBtn');
    scoreSpan = document.getElementById('scoreValue');
    feedbackSpan = document.getElementById('feedbackText');
    themeToggle = document.getElementById('themeToggle');
    
    // Add event listeners
    translateBtn.addEventListener('click', handleTranslate);
    voiceBtn.addEventListener('click', handleVoiceInput);
    clearBtn.addEventListener('click', handleClear);
    speakOriginalBtn.addEventListener('click', () => speakText(currentOriginal, sourceLang.value));
    speakTranslatedBtn.addEventListener('click', () => speakText(currentTranslated, targetLang.value));
    recordBtn.addEventListener('click', handlePronunciationRecording);
    themeToggle.addEventListener('click', toggleTheme);
    targetLang.addEventListener('change', (e) => {
        currentTargetLang = e.target.value;
    });
    
    // Load daily phrase
    loadDailyPhrase();
});

async function handleTranslate() {
    const text = inputText.value.trim();
    if (!text) {
        showFeedback('Please enter some text to translate', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_URL}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                source: sourceLang.value,
                target: targetLang.value
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        currentOriginal = data.original;
        currentTranslated = data.translated;
        
        originalTextSpan.textContent = data.original;
        translatedTextSpan.textContent = data.translated;
        pronunciationSpan.textContent = data.pronunciation;
        
        showFeedback('Translation completed! Listen and practice.', 'success');
        
    } catch (error) {
        console.error('Translation error:', error);
        showFeedback('Translation failed. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

function handleVoiceInput() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showFeedback('Speech recognition not supported in this browser', 'error');
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = getSpeechLang(sourceLang.value);
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => {
        voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i> Listening...';
        voiceBtn.style.background = '#ef4444';
        showFeedback('Listening... Speak now', 'info');
    };
    
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        inputText.value = text;
        handleTranslate();
    };
    
    recognition.onerror = () => {
        showFeedback('Could not hear you. Please try again.', 'error');
        resetVoiceButton();
    };
    
    recognition.onend = resetVoiceButton;
    
    recognition.start();
}

function resetVoiceButton() {
    voiceBtn.innerHTML = '<i class="fas fa-microphone"></i> Speak';
    voiceBtn.style.background = '';
}

async function speakText(text, lang) {
    if (!text) {
        showFeedback('No text to speak', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, lang: lang })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audio.play();
        
    } catch (error) {
        console.error('TTS error:', error);
        showFeedback('Could not play audio', 'error');
    }
}

function handlePronunciationRecording() {
    if (!currentTranslated) {
        showFeedback('Please translate something first', 'warning');
        return;
    }
    
    if (!('webkitSpeechRecognition' in window)) {
        showFeedback('Recording not supported', 'error');
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const pronRecognition = new SpeechRecognition();
    pronRecognition.lang = getSpeechLang(targetLang.value);
    
    pronRecognition.onstart = () => {
        recordBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Recording...';
        recordBtn.classList.add('recording');
        showFeedback('Say the phrase...', 'info');
    };
    
    pronRecognition.onresult = (event) => {
        const spoken = event.results[0][0].transcript;
        const score = calculateSimilarity(spoken, currentTranslated);
        const feedback = getFeedbackMessage(score);
        
        scoreSpan.textContent = `${score}%`;
        feedbackSpan.innerHTML = `<i class="fas fa-comment-dots"></i> You said: "${spoken}"<br><br>${feedback}`;
        
        if (score >= 80) {
            feedbackSpan.style.background = 'rgba(16,185,129,0.2)';
            feedbackSpan.style.color = '#10b981';
        } else if (score >= 50) {
            feedbackSpan.style.background = 'rgba(245,158,11,0.2)';
            feedbackSpan.style.color = '#f59e0b';
        } else {
            feedbackSpan.style.background = 'rgba(239,68,68,0.2)';
            feedbackSpan.style.color = '#ef4444';
        }
    };
    
    pronRecognition.onerror = () => {
        showFeedback('Recording error. Please try again.', 'error');
    };
    
    pronRecognition.onend = () => {
        recordBtn.innerHTML = '<i class="fas fa-microphone"></i> Practice Pronunciation';
        recordBtn.classList.remove('recording');
    };
    
    pronRecognition.start();
}

function calculateSimilarity(spoken, target) {
    // Simple similarity calculation
    const s1 = spoken.toLowerCase().trim();
    const s2 = target.toLowerCase().trim();
    
    if (s1 === s2) return 100;
    
    // Word matching
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    
    let matches = 0;
    for (let w1 of words1) {
        for (let w2 of words2) {
            if (w1 === w2 || w2.includes(w1) || w1.includes(w2)) {
                matches++;
                break;
            }
        }
    }
    
    const maxLen = Math.max(words1.length, words2.length);
    let score = (matches / maxLen) * 100;
    
    // Length similarity
    const lenRatio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    score = score * (0.7 + lenRatio * 0.3);
    
    return Math.min(100, Math.floor(score));
}

function getFeedbackMessage(score) {
    if (score >= 90) {
        return "🎉 Excellent! Perfect pronunciation! Keep up the great work!";
    } else if (score >= 70) {
        return "👍 Good job! Just a little practice and you'll master it!";
    } else if (score >= 50) {
        return "📚 Getting there! Listen to the audio and try again.";
    } else {
        return "💪 Keep practicing! Click the speaker button to hear the correct pronunciation and try again.";
    }
}

function getSpeechLang(lang) {
    const map = {
        'en': 'en-US',
        'ur': 'ur-PK',
        'ar': 'ar-EG',
        'ja': 'ja-JP',
        'zh': 'zh-CN'
    };
    return map[lang] || 'en-US';
}

function handleClear() {
    inputText.value = '';
    originalTextSpan.textContent = '—';
    translatedTextSpan.textContent = '—';
    pronunciationSpan.textContent = '—';
    currentOriginal = '';
    currentTranslated = '';
    showFeedback('Cleared! Ready for new practice.', 'info');
}

function showFeedback(message, type) {
    const feedbackDiv = document.getElementById('feedbackText') || document.createElement('div');
    if (type === 'error') {
        console.error(message);
        alert(message);
    } else {
        console.log(message);
    }
}

function showLoading(show) {
    if (show) {
        translateBtn.classList.add('loading');
        translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
    } else {
        translateBtn.classList.remove('loading');
        translateBtn.innerHTML = '<i class="fas fa-language"></i> Translate';
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark');
    const icon = themeToggle.querySelector('i');
    if (document.body.classList.contains('dark')) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

function loadDailyPhrase() {
    const dailyWordDiv = document.querySelector('.word-card .word');
    if (dailyWordDiv) {
        const phrases = {
            'en': { word: 'Hello', meaning: 'Greeting' },
            'ur': { word: 'السلام علیکم', meaning: 'Peace be upon you' },
            'ar': { word: 'السلام عليكم', meaning: 'Peace be upon you' },
            'zh': { word: '你好 (Nǐ hǎo)', meaning: 'Hello' },
            'ja': { word: 'こんにちは', meaning: 'Hello' }
        };
        
        const currentLang = targetLang?.value || 'ur';
        const phrase = phrases[currentLang] || phrases['en'];
        
        if (dailyWordDiv) {
            dailyWordDiv.textContent = phrase.word;
            const meaningSpan = document.querySelector('.word-card .meaning');
            if (meaningSpan) meaningSpan.textContent = phrase.meaning;
        }
    }
}