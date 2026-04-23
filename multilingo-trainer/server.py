from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from deep_translator import GoogleTranslator
from gtts import gTTS
import base64
import os
import re

app = Flask(__name__, static_url_path='', static_folder='.')
CORS(app)

# Custom translations for common phrases in different languages
CUSTOM_TRANSLATIONS = {
    # Arabic to other languages
    ('السلام عليكم', 'en'): 'Peace be upon you',
    ('السلام عليكم', 'ur'): 'السلام علیکم',
    ('السلام عليكم', 'zh'): '你好 (Nǐ hǎo)',
    ('السلام عليكم', 'ja'): 'こんにちは (Konnichiwa)',
    
    # Urdu to other languages
    ('السلام علیکم', 'en'): 'Peace be upon you',
    ('السلام علیکم', 'zh'): '你好 (Nǐ hǎo)',
    ('السلام علیکم', 'ja'): 'こんにちは (Konnichiwa)',
    ('السلام علیکم', 'ar'): 'السلام عليكم',
    
    # English greetings
    ('Hello', 'ur'): 'السلام علیکم',
    ('Hello', 'ar'): 'السلام عليكم',
    ('Hello', 'zh'): '你好 (Nǐ hǎo)',
    ('Hello', 'ja'): 'こんにちは (Konnichiwa)',
    
    ('How are you', 'ur'): 'آپ کیسے ہیں؟',
    ('How are you', 'ar'): 'كيف حالك؟',
    ('How are you', 'zh'): '你好吗？(Nǐ hǎo ma)',
    ('How are you', 'ja'): 'お元気ですか？(Ogenki desu ka)',
    
    ('Good morning', 'ur'): 'صبح بخیر',
    ('Good morning', 'ar'): 'صباح الخير',
    ('Good morning', 'zh'): '早上好 (Zǎoshang hǎo)',
    ('Good morning', 'ja'): 'おはようございます (Ohayō gozaimasu)',
}

# Language codes mapping
LANG_CODES = {
    'en': 'english',
    'ur': 'urdu',
    'ar': 'arabic',
    'ja': 'japanese',
    'zh': 'chinese (simplified)'
}

def translate_text(text, source_lang, target_lang):
    """Translate text using custom translations first, then API"""
    
    # Check custom translations first
    custom_key = (text, target_lang)
    if custom_key in CUSTOM_TRANSLATIONS:
        return CUSTOM_TRANSLATIONS[custom_key]
    
    # Also try case-insensitive matching
    for (orig, lang), trans in CUSTOM_TRANSLATIONS.items():
        if orig.lower() == text.lower() and lang == target_lang:
            return trans
    
    try:
        # Use Google Translator
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated = translator.translate(text)
        return translated
    except Exception as e:
        print(f"Translation error: {e}")
        # Fallback basic translation
        return f"[{LANG_CODES.get(target_lang, target_lang)}] {text}"

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/translate', methods=['POST'])
def translate():
    data = request.json
    text = data.get('text', '')
    source = data.get('source', 'auto')
    target = data.get('target', 'en')
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    
    translated = translate_text(text, source, target)
    
    # Get pronunciation guide
    pronunciation = get_pronunciation_guide(translated, target)
    
    return jsonify({
        'original': text,
        'translated': translated,
        'pronunciation': pronunciation,
        'source_lang': source,
        'target_lang': target
    })

@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    data = request.json
    text = data.get('text', '')
    lang = data.get('lang', 'en')
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    
    try:
        # Map language codes to gTTS format
        tts_lang = {
            'en': 'en',
            'ur': 'ur',
            'ar': 'ar',
            'ja': 'ja',
            'zh': 'zh-CN'
        }.get(lang, 'en')
        
        tts = gTTS(text=text, lang=tts_lang, slow=False)
        audio_file = "temp_audio.mp3"
        tts.save(audio_file)
        
        with open(audio_file, "rb") as f:
            audio_base64 = base64.b64encode(f.read()).decode()
        
        os.remove(audio_file)
        return jsonify({'audio': audio_base64})
    except Exception as e:
        print(f"TTS error: {e}")
        return jsonify({'error': str(e)}), 500

def get_pronunciation_guide(text, lang):
    """Generate pronunciation guide for the text"""
    guides = {
        'ur': f"تلفظ: {text}",
        'ar': f"النطق: {text}",
        'zh': f"拼音: {text}",
        'ja': f"発音: {text}",
        'en': f"Pronunciation: {text}"
    }
    return guides.get(lang, f"Pronounce: {text}")

if __name__ == '__main__':
    print("\n" + "="*50)
    print("🌟 MultiLingo Trainer Server Started!")
    print("📍 Open http://localhost:5000 in your browser")
    print("="*50 + "\n")
    app.run(host='0.0.0.0', port=5000, debug=True)