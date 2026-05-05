from groq import Groq

def create_interactive_fantasy_bot():
    """
    Interactive Fantasy World AI Bot
    Academic Assignment: Create an interactive AI Bot for generating fantasy world stories and characters
    Similar to ChatGPT/Gemini style interactions
    """
    print("="*70)
    print("🧙 INTERACTIVE FANTASY WORLD AI BOT 🧙")
    print("="*70)
    print("\nWelcome to the Fantasy World Creator!")
    print("I'll help you create amazing fantasy stories and characters.")
    print("Type 'quit' or 'exit' to end the conversation.\n")
    
    import os
    from dotenv import load_dotenv
    load_dotenv()
    
    # Initialize Groq client
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("Error: Missing GROQ_API_KEY environment variable. Please check your .env file.")
        return
        
    client = Groq(api_key=api_key)
    
    # Enhanced system prompt for interactive storytelling
    system_message = """You are an interactive fantasy world builder and storyteller, similar to ChatGPT or Gemini.
Your role is to:
1. Ask clarifying questions to understand what the user wants (character, story, world)
2. Gather details through conversational questions (not all at once)
3. Build the fantasy narrative step by step based on user responses
4. Show enthusiasm and creativity
5. Ask follow-up questions like "What kind of magic interests you?" or "What should be their greatest fear?"
6. Create vivid, detailed fantasy content based on user preferences
7. Guide the user through the creative process naturally

IMPORTANT: Ask 1-2 questions at a time, not too many. Make it feel like a natural conversation.
Be engaging, creative, and help the user co-create their fantasy world or story."""
    
    conversation_history = []
    
    # Initial greeting from bot
    initial_greeting = """Hello! I'm your Fantasy World AI Assistant! 🌟

I'd love to help you create something amazing. We can:
🐉 Create a detailed fantasy character with an epic backstory
📖 Write an engaging fantasy story or adventure
🌍 Build an entire fantasy world with its own magic system, cultures, and locations
⚔️ Design encounters and quests

What would you like to create today?"""
    
    print(f"Bot: {initial_greeting}\n")
    
    # Add initial context
    conversation_history.append({
        "role": "assistant",
        "content": initial_greeting
    })
    
    while True:
        # Get user input
        user_input = input("You: ").strip()
        
        if not user_input:
            print("Please enter something to continue.")
            continue
        
        if user_input.lower() in ['quit', 'exit', 'bye']:
            print("\nBot: Thank you for creating with me! Your fantasy world is waiting to be explored. Goodbye! 👋\n")
            break
        
        # Add user message to history
        conversation_history.append({
            "role": "user",
            "content": user_input
        })
        
        try:
            print("\n⏳ Bot is thinking...\n")
            
            # Create message with Groq API
            message = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_message},
                    *conversation_history
                ],
                temperature=0.85,  # High temperature for creativity
                max_tokens=1024,
                top_p=0.9
            )
            
            # Extract and display response
            bot_response = message.choices[0].message.content
            print(f"Bot: {bot_response}\n")
            
            # Add bot response to history
            conversation_history.append({
                "role": "assistant",
                "content": bot_response
            })
            
        except Exception as e:
            print(f"❌ Error: {e}")
            print("Please try again.\n")

if __name__ == "__main__":
    create_interactive_fantasy_bot()