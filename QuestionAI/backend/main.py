from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
import redis.asyncio as redis
import logging
from typing import Optional
import os
import httpx
from pydantic import BaseModel
from dotenv import load_dotenv
import asyncio
import atexit
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
import logging
logging.basicConfig(level=logging.DEBUG)

# Configuration
load_dotenv('config.env')
SECRET_KEY = os.getenv('SECRET_KEY', 'fallback-secret-key')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Initialize Redis
redis_conn = redis.Redis(
    host='localhost',
    port=6379,
    db=0,
    decode_responses=True,
    socket_timeout=5,
    retry_on_timeout=True
)
security = HTTPBearer()

app = FastAPI()

# Rate Limiter Setup
@app.on_event("startup")
async def startup():
    try:
        await FastAPILimiter.init(redis_conn)
        logging.info("Redis rate limiter initialized")
    except Exception as e:
        logging.error(f"Rate limiter init failed: {str(e)}")

# Auth Utilities
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Models
class UserCreate(BaseModel):
    username: str
    password: str

class UserInDB(BaseModel):
    username: str
    hashed_password: str

class ChatRequest(BaseModel):
    prompt: str
    tone: Optional[str] = "friendly"
    language: Optional[str] = "en"

class ChatResponse(BaseModel):
    response: str
    tokens_used: int

# Helper function for DeepSeek API
async def call_deepseek_api(prompt: str) -> dict:
    """Call actual DeepSeek API with proper error handling"""
    DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
    if not DEEPSEEK_API_KEY:
        raise ValueError("Missing DEEPSEEK_API_KEY in environment")

    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 2000
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logging.error(f"DeepSeek API error: {e.response.text}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail="DeepSeek API request failed"
            )
        except Exception as e:
            logging.error(f"DeepSeek connection error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="DeepSeek service unavailable"
            )

# Mock database (replace with real DB in production)
users_db = {}

def get_user(username: str):
    if username in users_db:
        user_dict = users_db[username]
        return UserInDB(**user_dict)
    return None

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

def authenticate_user(username: str, password: str):
    user = get_user(username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

@app.post("/token")
async def login_for_access_token(user_data: UserCreate):
    try:
        user = authenticate_user(user_data.username, user_data.password)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Incorrect username or password"
            )
        
        access_token = create_access_token({"sub": user.username})
        await redis_conn.setex(
            f"token:{user.username}",
            int(timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES).total_seconds()),
            access_token
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        logging.error(f"Auth error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Authentication failed")

@app.post("/token")
async def login_for_access_token(form_data: UserCreate):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.username})
    
    # Store token in Redis
    await redis_conn.setex(
        f"token:{user.username}",
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES).total_seconds(),
        access_token
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(user: UserCreate):
    if user.username in users_db:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = pwd_context.hash(user.password)
    users_db[user.username] = {
        "username": user.username,
        "hashed_password": hashed_password
    }
    return {"message": "User created successfully"}

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Basic endpoints
@app.get("/ping")
async def ping():
    return {"status": "pong"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/redis-test")
async def redis_test():
    try:
        await redis_conn.ping()
        return {"redis": "connected"}
    except Exception as e:
        return {"redis": str(e)}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Endpoints
@app.post("/api/chat", response_model=ChatResponse, dependencies=[Depends(RateLimiter(times=10, minutes=1))])
async def chat(
    chat_request: ChatRequest,
    user: dict = Depends(get_current_user)
):
    """
    Main chat endpoint with rate limiting (10 requests per minute)
    """
    # Optimize prompt with tone and language context
    optimized_prompt = f"""Respond in {chat_request.tone} tone. 
    Preferred language: {chat_request.language}.
    {chat_request.prompt}
    """
    
    try:
        api_response = await call_deepseek_api(optimized_prompt)
        response_text = api_response["choices"][0]["message"]["content"]
        tokens_used = api_response["usage"]["total_tokens"]
        
        logging.info(f"Processed prompt: {chat_request.prompt[:100]}...")
        
        return ChatResponse(
            response=response_text,
            tokens_used=tokens_used
        )
    except Exception as e:
        logging.error(f"Error processing chat request: {e}")
        raise HTTPException(status_code=500, detail="Error processing request")

@app.get("/protected", dependencies=[Depends(RateLimiter(times=5, seconds=60))])
async def protected_route(user: dict = Depends(get_current_user)):
    return {"message": "Authenticated access", "user": user}

@app.on_event("shutdown")
def shutdown_event():
    os.system(f"kill -9 {os.getpid()}")

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Middleware for request logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
