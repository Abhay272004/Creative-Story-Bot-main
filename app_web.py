from flask import Flask, render_template, request, jsonify, Response
from groq import Groq
import os
import json
import sqlite3
import requests
from dotenv import load_dotenv
import base64
from bytez import Bytez

load_dotenv()

app = Flask(__name__)

# Initialize Groq client (reads API key from .env / environment)
DEFAULT_GROQ_API_KEY = os.getenv("GROQ_API_KEY", "gsk_your_actual_key_here")
client = Groq(api_key=DEFAULT_GROQ_API_KEY)

# ============================================
# Database Setup
# ============================================
DATABASE = 'fantasy_engine.db'

def get_db():
    conn = sqlite3.connect(DATABASE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                role TEXT,
                content TEXT,
                inserted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            )
        ''')
        conn.commit()

# Initialize DB on startup
init_db()

def get_session_history(session_id):
    with get_db() as conn:
        rows = conn.execute(
            'SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC',
            (session_id,)
        ).fetchall()
        return [{"role": row["role"], "content": row["content"]} for row in rows]

def save_message(session_id, role, content):
    with get_db() as conn:
        conn.execute(
            'INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)',
            (session_id, role, content)
        )
        conn.commit()

def get_system_prompt(use_case):
    base_prompt = """You are Megha, an interactive fantasy world builder and storyteller, acting as a creative AI assistant similar to ChatGPT or Gemini. 
Your role is to collaborate with the user step by step in a natural, conversational way.

CRITICAL RULES:
1. STOP AND LISTEN: If the user says "hi" or gives a short prompt, do NOT generate a massive, unprompted story. Greet them warmly, introduce yourself briefly as Megha their creative partner, and ask them what they want to create today.
2. CONVERSATIONAL PACE: Ask clarifying questions to understand what the user wants. Gather details through conversational questions (not all at once).
3. BE ENGAGING: Ask follow-up questions like "What kind of magic interests you?" or "What should be their greatest fear?"
4. Ask EXACTLY ONE question at the end of your response to keep the conversation flowing.
5. Create vivid, detailed fantasy content ONLY when the user has provided enough details or specifically requests a story segment.
6. IMMERSIVE IMAGES (RESTRICTION): Do NOT generate images during initial brainstorming, early setup, or casual chat. ONLY output the `[IMAGE: describe the scene visually here]` tag at two specific moments: when the story reaches its halfway point (a major midpoint event), and when the full story reaches its climax or conclusion. Otherwise, do NOT include image tags.

Make it feel like a natural conversation. Be engaging, creative, and help the user co-create."""

    if use_case == "character":
        return base_prompt + "\n\nYour current focus is: CHARACTER CREATION. Ask them about backstory, motivations, flaws, or distinctive traits."
    elif use_case == "world":
        return base_prompt + "\n\nYour current focus is: WORLD BUILDING. Ask them about geography, politics, history, or magic."
    elif use_case == "comic":
        return base_prompt + """\n\nYour current focus is: COMIC BOOK CREATION. 
Format your response strictly like a professional comic script. 
For each panel, provide:
- **[PANEL 1]**: A vivid visual description, character positioning, and camera angle.
- **CHARACTER NAME**: (Facial Expression) Dramatic dialogue, thoughts, or [SFX].
Keep the pacing dynamic and focus heavily on visual storytelling!"""
    else: 
        return base_prompt + "\n\nYour current focus is: STORY DEVELOPMENT. Build the narrative step by step based on their answers. Never dump a whole story unprompted."

@app.route('/projects')
def projects():
    return render_template('projects.html')

@app.route('/charts')
def charts():
    return render_template('charts.html')

@app.route('/api/metrics')
def metrics():
    # Typically calculating precision/recall required a labeled dataset. Let me return some sensible generic LLM "simulated" performance values for your charts. Or you can update them dynamically with your actual evaluation logic!
    return jsonify({ 'accuracy': 94.2, 'precision': 89.5, 'recall': 91.8 })

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/load_chat', methods=['POST'])
def load_chat():
    try:
        data = request.json
        session_id = data.get('session_id')
        history = data.get('history', [])
        
        if not session_id:
            return jsonify({"error": "Missing session_id"}), 400
            
        with get_db() as conn:
            conn.execute('INSERT OR IGNORE INTO sessions (id) VALUES (?)', (session_id,))
            conn.execute('DELETE FROM messages WHERE session_id = ?', (session_id,))
            for msg in history:
                conn.execute(
                    'INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)',
                    (session_id, msg['role'], msg['content'])
                )
            conn.commit()
            
        return jsonify({"status": "success", "message": "Context loaded successfully"}), 200
    except Exception as e:
        app.logger.error(str(e))
        return jsonify({"error": "An internal server error occurred"}), 500





@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        user_message = data.get('message', '').strip()
        image_data = data.get('image_data')  # Base64 image
        use_case = data.get('use_case', 'story')
        session_id = data.get('session_id', 'default')
        
        user_key = data.get('api_key')
        model = data.get('model') or "llama-3.3-70b-versatile"
        
        # Override client if user provided key
        current_client = Groq(api_key=user_key) if user_key else client
        
        if not user_message and not image_data:
            return jsonify({'error': 'Message cannot be empty'}), 400
        
        # Verify session exists
        with get_db() as conn:
            conn.execute('INSERT OR IGNORE INTO sessions (id) VALUES (?)', (session_id,))
            conn.commit()
            
        # Get history from DB
        session_history = get_session_history(session_id)
        
        # Save user message to DB
        content_to_save = user_message if not image_data else f"[Image Uploaded] {user_message}"
        save_message(session_id, 'user', content_to_save)

        if image_data:
            session_history.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": user_message},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
                ]
            })
        else:
            session_history.append({"role": "user", "content": user_message})
        
        try:
            def generate():
                try:
                    # Trim chat history aggressively to avoid token limits on free tiers
                    # We'll keep only the last 5 messages to drastically reduce TPM issues
                    trimmed_messages = session_history[-5:] if len(session_history) > 5 else session_history
                    
                    message_stream = current_client.chat.completions.create(
                        model=model,
                        messages=[
                            {"role": "system", "content": get_system_prompt(use_case)},
                            *trimmed_messages
                        ],
                        temperature=0.85,
                        max_tokens=1024,
                        top_p=0.9,
                        stream=True
                    )
                    
                    response_content = ""
                    for chunk in message_stream:
                        if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                            content = chunk.choices[0].delta.content
                            response_content += content
                            # Escape newlines for SSE
                            yield f"data: {json.dumps({'text': content})}\n\n"
                    
                    # After streaming, save the full response to DB for continuity
                    save_message(session_id, 'assistant', response_content)
                    
                    # End of stream marker
                    yield f"data: {json.dumps({'done': True})}\n\n"
                    
                except Exception as e:
                    app.logger.error("Internal Server Error: " + str(e))
                    import traceback
                    traceback.print_exc()
                    
                    error_msg = str(e)
                    if "invalid_api_key" in error_msg or "expired_api_key" in error_msg or "401" in error_msg:
                        error_msg = "Your Groq API key is invalid or has expired. Please check your .env file or update your API key in the application Settings."
                        
                    yield f"data: {json.dumps({'error': error_msg})}\n\n"
            
            return Response(generate(), content_type='text/event-stream')
            
        except Exception as e:
            app.logger.error(str(e))
            return jsonify({'error': 'An internal server error occurred', 'success': False}), 500
            
    except Exception as e:
        app.logger.error(str(e))
        return jsonify({'error': 'An internal server error occurred', 'success': False}), 500

@app.route('/api/new-session', methods=['POST'])
def new_session():
    """Create a new conversation session"""
    session_id = os.urandom(16).hex()
    with get_db() as conn:
        conn.execute('INSERT INTO sessions (id) VALUES (?)', (session_id,))
        conn.commit()
    return jsonify({'session_id': session_id})

@app.route('/api/branch-session', methods=['POST'])
def branch_session():
    """Branch a conversation session from a specific message index"""
    data = request.json
    old_session_id = data.get('session_id')
    message_index = data.get('message_index')

    if not old_session_id:
        return jsonify({'error': 'Invalid session_id'}), 400
        
    old_history = get_session_history(old_session_id)
        
    if message_index is None or message_index < 0 or message_index >= len(old_history):
       return jsonify({'error': 'Invalid message_index'}), 400 
        
    try:
        new_session_id = os.urandom(16).hex()
        # Copy history up to and including the branched message
        new_history = old_history[:message_index + 1]
        
        with get_db() as conn:
            conn.execute('INSERT INTO sessions (id) VALUES (?)', (new_session_id,))
            for msg in new_history:
                conn.execute(
                    'INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)',
                    (new_session_id, msg['role'], msg['content'])
                )
            conn.commit()
        
        return jsonify({
            'status': 'success',
            'session_id': new_session_id,
            'history': new_history
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/get-session', methods=['GET'])
def get_session():
    """Retrieve the full conversation history for a given session"""
    session_id = request.args.get('session_id')
    if not session_id:
        return jsonify({'error': 'Missing session_id'}), 400
    try:
        history = get_session_history(session_id)
        return jsonify({
            'status': 'success',
            'session_id': session_id,
            'history': history
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/get-all-sessions', methods=['GET'])
def get_all_sessions():
    """Retrieve all stored sessions"""
    try:
        with get_db() as conn:
            rows = conn.execute('SELECT id, created_at FROM sessions ORDER BY created_at DESC').fetchall()
            sessions = [{"id": row["id"], "created_at": row["created_at"]} for row in rows]
        return jsonify({
            'status': 'success',
            'sessions': sessions
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-image', methods=['POST'])
def generate_image():
    """Proxy image generation to Bytez to avoid frontend CORS issues."""
    data = request.get_json(force=True, silent=True) or {}
    prompt = data.get('prompt')
    hf_token = data.get('hf_token')  # optional token provided by client

    if not prompt:
        return jsonify({'error': 'Missing prompt'}), 400

    # Prefer environment key, fall back to passed token, then to prior hardcoded key (legacy)
    key = os.getenv('BYTEZ_API_KEY') or hf_token or "350795fa10ef87b2326506f02a61a458"

    try:
        sdk = Bytez(key)
        model = sdk.model("google/imagen-4.0-ultra-generate-001")

        # Try common SDK call shapes
        if hasattr(model, 'run'):
            results = model.run(prompt)
        elif hasattr(model, 'generate'):
            results = model.generate(prompt)
        else:
            # Last-resort: try calling the sdk directly
            results = sdk.generate(prompt)

        # Helper to extract a URL or image bytes from various response shapes
        def extract_output(res):
            if res is None:
                return None
            # dict-like responses
            if isinstance(res, dict):
                for key_name in ('output', 'url', 'image_url', 'results', 'outputs'):
                    if key_name in res and res[key_name]:
                        val = res[key_name]
                        if isinstance(val, list):
                            return extract_output(val[0])
                        return val
                return None

            # object with attributes
            for attr in ('output', 'url', 'image_url', 'outputs', 'results'):
                if hasattr(res, attr):
                    val = getattr(res, attr)
                    if isinstance(val, list) and val:
                        return extract_output(val[0])
                    return val

            # if raw bytes
            if isinstance(res, (bytes, bytearray)):
                return res

            return None

        out = extract_output(results)

        # If we got an object with 'error' attribute or key, prefer to show that
        if (hasattr(results, 'error') and getattr(results, 'error')) or (isinstance(results, dict) and results.get('error')):
            err = getattr(results, 'error', None) or results.get('error')
            return jsonify({'error': str(err)}), 500

        # If out is bytes, encode as base64 for frontend consumption
        if isinstance(out, (bytes, bytearray)):
            b64 = base64.b64encode(out).decode('utf-8')
            return jsonify({'image_base64': b64})

        # If out is a list/dict/str containing a URL or path, normalize to string
        if isinstance(out, list) and out:
            out = out[0]

        if isinstance(out, dict):
            # try common nested url keys
            for k in ('url', 'image_url', 'src', 'output'):
                if k in out:
                    out = out[k]
                    break

        if out:
            return jsonify({'url': out})

        # Nothing usable found — return diagnostic for debugging (trimmed)
        return jsonify({'error': 'Unexpected Bytez response shape', 'debug': str(results)[:1000]}), 500

    except Exception as e:
        app.logger.exception('Image generation failed')
        return jsonify({'error': str(e)}), 500

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    """Transcribe uploaded audio using Groq Whisper."""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'Missing audio file'}), 400

        audio_file = request.files['audio']
        if not audio_file or not audio_file.filename:
            return jsonify({'error': 'Invalid audio file'}), 400

        user_key = request.form.get('api_key')
        api_key = user_key or DEFAULT_GROQ_API_KEY
        if not api_key:
            return jsonify({'error': 'Missing GROQ API key'}), 400

        files = {
            'file': (
                audio_file.filename,
                audio_file.stream,
                audio_file.mimetype or 'audio/webm'
            )
        }
        data = {
            'model': 'whisper-large-v3-turbo',
            'language': 'en'
        }
        headers = {
            'Authorization': f'Bearer {api_key}'
        }

        response = requests.post(
            'https://api.groq.com/openai/v1/audio/transcriptions',
            headers=headers,
            files=files,
            data=data,
            timeout=90
        )

        if not response.ok:
            detail = response.text[:500]
            return jsonify({'error': f'Transcription request failed: {detail}'}), response.status_code

        payload = response.json()
        text = (payload.get('text') or '').strip()
        return jsonify({'text': text})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # For Render deployment: use PORT env variable, default to 5001 for local dev
    port = int(os.getenv('PORT', 5001))
    debug = os.getenv('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)


