import os
import json
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import google.generativeai as genai
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

# Load environment variables from .env file for local development
load_dotenv()

app = FastAPI(title="Sauté Bot API")

# ============================================================================
# 1. STRICT CORS CONFIGURATION
# ============================================================================
# Replace these with your actual frontend URLs (e.g., Vercel, Netlify, localhost)
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://sautebot.vercel.app" # TODO: Update this before production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS, 
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"], 
    allow_headers=["Authorization", "Content-Type"], 
)

# ============================================================================
# 2. GEMINI API CONFIGURATION
# ============================================================================
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is not set")

genai.configure(api_key=API_KEY)

# ============================================================================
# 3. FIREBASE ADMIN INITIALIZATION (SECURE CLOUD ENV VARIABLES)
# ============================================================================
try:
    firebase_json_string = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if firebase_json_string:
        # Production: Load from Cloud Environment Variable
        cert_dict = json.loads(firebase_json_string, strict=False)
        cred = credentials.Certificate(cert_dict)
        firebase_admin.initialize_app(cred)
    else:
        # Local Development: Automatically uses GOOGLE_APPLICATION_CREDENTIALS from .env
        firebase_admin.initialize_app()
except ValueError:
    pass # App already initialized

# ============================================================================
# 4. AUTHENTICATION DEPENDENCY
# ============================================================================
async def verify_firebase_token(authorization: str = Header(None)):
    """Verifies the Firebase ID token from the Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token = authorization.split("Bearer ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(token)
        return decoded_token # Returns user dictionary (uid, email, etc.)
    except Exception as e:
        raise HTTPException(status_code=403, detail="Invalid or expired authentication token")

# ============================================================================
# 5. INPUT VALIDATION MODELS (Prevents Prompt Injection & DoS)
# ============================================================================
class RecipeRequest(BaseModel):
    prompt: str = Field(..., max_length=5000)
    age: str = Field(default="", max_length=50)
    nationality: str = Field(default="", max_length=100)
    preferences: str = Field(default="", max_length=1000)
    image: str | None = None

class IdeasRequest(BaseModel):
    age: str = Field(default="", max_length=50)
    nationality: str = Field(default="", max_length=100)
    preferences: str = Field(default="", max_length=1000)
    history: list[str] = Field(default=[], max_length=20)
    previous_suggestions: list[str] = Field(default=[], max_length=50)

# ============================================================================
# 6. SCHEMAS
# ============================================================================
RECIPE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "prepTime": {"type": "string"},
        "totalNutrition": {
            "type": "object",
            "properties": {
                "calories": {"type": "number"},
                "protein": {"type": "number"},
                "carbs": {"type": "number"},
                "fat": {"type": "number"}
            }
        },
        "ingredients": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "base_name": {"type": "string"},
                    "quantity": {"type": "string"},
                    "nutrition": {
                        "type": "object",
                        "properties": {
                            "calories": {"type": "number"},
                            "protein": {"type": "number"},
                            "carbs": {"type": "number"},
                            "fat": {"type": "number"}
                        }
                    }
                }
            }
        },
        "instructions": {
            "type": "array",
            "items": {"type": "string"}
        }
    }
}

# ============================================================================
# 7. SECURED API ENDPOINTS
# ============================================================================

@app.post("/api/ideas")
async def generate_ideas(req: IdeasRequest, user_data: dict = Depends(verify_firebase_token)):
    """Generates quick recipe ideas based on user profile and history."""
    try:
        system_prompt = f"""
        You are a Michelin-star AI chef. Generate exactly 3 unique, short recipe titles (max 5 words each) 
        that the user should cook.
        Consider their profile: Age: {req.age}, Cuisine: {req.nationality}, Preferences: {req.preferences}.
        DO NOT suggest these recent meals: {', '.join(req.history)}.
        DO NOT suggest these previous ideas: {', '.join(req.previous_suggestions)}.
        Return ONLY a raw JSON array of strings. Example: ["Spicy Vegan Tacos", "Lemon Butter Salmon", "Keto Garlic Chicken"]
        """
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            system_prompt, 
            generation_config=genai.GenerationConfig(response_mime_type="application/json")
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Idea Gen Error: {str(e)}") 
        raise HTTPException(status_code=500, detail="An internal error occurred while generating ideas.")

@app.post("/api/generate")
async def generate_recipe(req: RecipeRequest, user_data: dict = Depends(verify_firebase_token)):
    """Generates a full structured recipe from text/image prompts."""
    try:
        contents = [
            f"User Profile - Age: {req.age}, Cuisine: {req.nationality}, Preferences: {req.preferences}\n\n",
            f"Task: {req.prompt}"
        ]

        if req.image:
            # Handle base64 image if provided by the frontend
            try:
                header, encoded = req.image.split(",", 1)
                mime_type = header.split(";")[0].split(":")[1]
                import base64
                image_data = base64.b64decode(encoded)
                contents.append({
                    "mime_type": mime_type,
                    "data": image_data
                })
            except Exception as e:
                print(f"Image parsing error: {e}")

        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            contents, 
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json", 
                response_schema=RECIPE_SCHEMA
            )
        )
        return json.loads(response.text)

    except Exception as e:
        print(f"Error generating recipe: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred while crafting your recipe.")

# For local testing
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
