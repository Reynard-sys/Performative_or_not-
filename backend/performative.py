from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import base64
from google import genai
from google.genai import types

load_dotenv()

app = FastAPI()

# Allow Next.js frontend to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://performative-or-not.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client(api_key=os.getenv("GENAI_API_KEY"))

@app.get("/health")
def health():
    return {"status": "ok"}

@app.on_event("startup")
def print_routes():
    import logging
    routes = []
    for r in app.routes:
        methods = ",".join(sorted(getattr(r, "methods", []) or []))
        routes.append(f"{methods} {getattr(r, 'path', r)}")
    logging.info("Registered routes:\n" + "\n".join(routes))

TWO_5_FLASH = "gemini-2.5-flash"

system_instruction = '''{
  "task": "Evaluate how 'performative' a person appears in an image on a scale of 0–10, and then continue the conversation in a warm, older-sister tone strictly about performativity, style, aesthetic choices, and anything that helps the user understand or achieve a performative look.",
  "tone_style": "Speak like a caring older sister: sweet, warm, supportive, gently teasing, encouraging, and emotionally intelligent. Avoid harshness or robotic phrasing.",
  "definition_of_performative": "A curated, soft-intellectual, aesthetically constructed persona that signals emotional depth, artistic sensitivity, political awareness, or non-toxic softness in a way that appears intentional, stylized, or posed rather than natural.",
  "applicable_to": ["male", "female", "nonbinary"],
  "scoring_criteria": {
    "0": "No visible performative traits. Natural, unstylized appearance.",
    "1-3": "Minimal performative cues; mild aesthetic curation but mostly authentic.",
    "4-6": "Moderate performative traits; clearly stylized or curated but not extreme.",
    "7-9": "Strongly curated persona; theatrically soft, intellectual, artsy, or politically signaling.",
    "10": "Highly performative; entire appearance reads as constructed aesthetic identity."
  },
  "visual_markers": {
    "colors": [
      "muted earth tones (olive, rust, beige, brown)",
      "washed-out pastels (dusty pink, lavender, slate blue)",
      "minimalist black-white-gray palettes"
    ],
    "fashion": [
      "soft-boy or soft-girl styling",
      "dangly earrings or multiple rings",
      "oversized sweaters, vintage pieces, curated thrift fits",
      "intentional messy curls or stylized hair"
    ],
    "props_and_context": [
      "iced oat lattes, matcha, herbal tea, kombucha, craft beverages",
      "books used as aesthetic objects",
      "vinyl, film cameras, polaroids",
      "artsy poses, moody lighting, shadowy photography"
    ],
    "behavioral_signals": [
      "visibly staged vulnerability or softness",
      "posed introspection",
      "symbolic or overly meaningful expressions",
      "political or emotional signaling as aesthetic rather than authentic"
    ]
  },
  "judgment_style": "Warm, big-sister energy. Be honest but gentle. Offer uplifting, conversational insight instead of robotic critique.",
  "output_format": {
    "score": "0–10 integer",
    "explanation": "One sentence explaining which visual markers influenced the score, expressed with gentle, sisterly tone."
  },
  "conversation_rules": {
    "allowed_topics": "Any conversational question about performativity, aesthetic styling, outfits, brands, poses, colors, personality expression, how to look more or less performative, and general performative lifestyle guidance. Must be answerable even without a new image.",
    "answers_should": [
      "Be sweet, encouraging, and gently teasing like an older sister.",
      "Give practical style advice when asked (brands, poses, colors, etc.).",
      "Explain performative aesthetics in a friendly, relatable way.",
      "Stay focused on the performative aesthetic domain only."
    ],
    "disallowed_topics": "Decline gently if user asks for anything unrelated to performativity, style, aesthetics, persona crafting, self-expression, or visual identity.",
    "followup_behavior": "After the initial image rating, treat the conversation like ongoing big-sister aesthetic coaching. No need for more images unless the user wants to provide them."
  }
}
'''

class ImageRequest(BaseModel):
    image: str  # base64 encoded image

def extract_text(response):
    try:
        parts = response.candidates[0].content.parts
        texts = []
        for p in parts:
            if hasattr(p, "text"):
                texts.append(p.text)
        return "\n".join(texts).strip()
    except Exception as e:
        print("FAILED TO EXTRACT TEXT:", e)
        return ""


@app.post("/api/analyze")
def evaluate_image(request: ImageRequest):
    try:
        image_data = request.image
        if image_data.startswith("data:"):
            image_data = image_data.split(",")[1]
        
        image_bytes = base64.b64decode(image_data)
        
        picture = types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/jpeg"
        )

        # Numerical rating
        rate = client.models.generate_content(
            model=TWO_5_FLASH,
            config=types.GenerateContentConfig(system_instruction=system_instruction),
            contents=[picture, '''
            Evaluate performative aesthetic, output only a single number from 0–10.
            ''']
        )

        # Feedback
        feedback = client.models.generate_content(
            model=TWO_5_FLASH,
            config=types.GenerateContentConfig(system_instruction=system_instruction, temperature=0.7),
            contents=[picture, '''
            Analyze the image and provide feedback on how performative it appears based on the previously defined performative aesthetic.

If the image successfully embodies strong performative traits, praise the elements contributing to that aesthetic.

If the performative aesthetic is weak or minimal, give concise suggestions for how the image could appear more performative.

Dont add any numerical ratings and Respond only in bullet points.

            ''']
        )

        raw_rating = extract_text(rate)
        raw_feedback = extract_text(feedback)

        print("RAW RATING:", repr(raw_rating))
        print("RAW FEEDBACK:", repr(raw_feedback))

        import re
        match = re.search(r"\b\d+\b", raw_rating)
        if not match:
            raise ValueError(f"Model did not return a number: {raw_rating}")

        rating = int(match.group(0))

        return {"rating": rating, "explanation": raw_feedback}

    
    except Exception as e:
        print("ERROR:", e)
        print("RATE RAW RESPONSE:", repr(rate) if 'rate' in locals() else "Rate not created")
        return {"error": str(e), "rating": 0, "explanation": "Failed to analyze image"}


# ---------------------------
# New text chat endpoint
# ---------------------------

class TextRequest(BaseModel):
    message: str

@app.post("/api/chat")
def chat_with_ai(request: TextRequest):
    """
    Receive a text message from the user and return AI-generated response.
    """
    try:
        user_message = request.message.strip()

        response = client.models.generate_content(
            model=TWO_5_FLASH,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7
            ),
            contents=[user_message]
        )

        return {"response": response.text}

    except Exception as e:
        return {"error": str(e), "response": "Failed to process message"}


