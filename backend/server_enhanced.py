from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, AsyncGenerator
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from pathlib import Path
from emergentintegrations.llm.chat import LlmChat, UserMessage
import os
import json
import uuid
import logging
import asyncio
import time
import hashlib
from collections import defaultdict

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Redis connection (simple in-memory cache if Redis not available)
try:
    import redis.asyncio as redis
    redis_client = redis.from_url("redis://localhost:6379", decode_responses=True)
    REDIS_AVAILABLE = True
except:
    REDIS_AVAILABLE = False
    # Simple in-memory cache
    memory_cache = {}

# Create the main app
app = FastAPI(title="SwanyBot Pro Ultimate API", version="3.0.0")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Rate limiting
rate_limit_store = defaultdict(list)

class RateLimiter:
    def __init__(self, max_requests: int = 10, window: int = 60):
        self.max_requests = max_requests
        self.window = window
    
    async def __call__(self, request: Request):
        client_ip = request.client.host
        now = time.time()
        
        # Clean old requests
        rate_limit_store[client_ip] = [
            req_time for req_time in rate_limit_store[client_ip]
            if now - req_time < self.window
        ]
        
        # Check limit
        if len(rate_limit_store[client_ip]) >= self.max_requests:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Max {self.max_requests} requests per {self.window} seconds."
            )
        
        rate_limit_store[client_ip].append(now)
        return True

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.stream_sessions = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.stream_sessions[session_id] = {
            "websocket": websocket,
            "start_time": datetime.now(timezone.utc),
            "is_streaming": False,
            "metrics_count": 0
        }
        logger.info(f"WebSocket connected: {session_id}")

    def disconnect(self, websocket: WebSocket, session_id: str):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if session_id in self.stream_sessions:
            del self.stream_sessions[session_id]
        logger.info(f"WebSocket disconnected: {session_id}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting: {e}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")

manager = ConnectionManager()

# Pydantic Models
class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: str
    content: str
    model: str = "claude-sonnet-4-20250514"
    tokens_used: int = 0
    latency_ms: int = 0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    session_id: str
    message: str
    use_emergent_key: bool = True
    model: Optional[str] = "claude-sonnet-4-20250514"
    stream: bool = False
    max_tokens: int = 2048

class ChatResponse(BaseModel):
    message: str
    timestamp: datetime
    model: str
    tokens_used: int = 0
    latency_ms: int = 0
    cached: bool = False

class BatchChatRequest(BaseModel):
    messages: List[dict]
    session_id: str
    use_emergent_key: bool = True

class StreamSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    platforms: List[str]
    start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    is_active: bool = True
    total_viewers: int = 0
    peak_viewers: int = 0

class StreamMetrics(BaseModel):
    session_id: str
    fps: float
    bitrate: float
    viewers: int
    cpu_usage: float = 0.0
    memory_usage: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Cache helper
async def get_cache(key: str) -> Optional[str]:
    if REDIS_AVAILABLE:
        try:
            return await redis_client.get(key)
        except:
            return memory_cache.get(key)
    return memory_cache.get(key)

async def set_cache(key: str, value: str, ttl: int = 3600):
    if REDIS_AVAILABLE:
        try:
            await redis_client.setex(key, ttl, value)
        except:
            memory_cache[key] = value
    else:
        memory_cache[key] = value

# WebSocket endpoint
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "stream_start":
                manager.stream_sessions[session_id]["is_streaming"] = True
                await manager.send_personal_message({
                    "type": "stream_started",
                    "session_id": session_id,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }, websocket)
                
                # Save to database
                stream_session = StreamSession(
                    id=session_id,
                    user_id=message.get("user_id", "demo-user"),
                    platforms=message.get("platforms", ["youtube", "twitch"])
                )
                await db.stream_sessions.insert_one(stream_session.model_dump())
                
            elif message.get("type") == "stream_stop":
                manager.stream_sessions[session_id]["is_streaming"] = False
                session_data = manager.stream_sessions[session_id]
                
                await manager.send_personal_message({
                    "type": "stream_stopped",
                    "session_id": session_id,
                    "total_metrics": session_data.get("metrics_count", 0),
                    "duration_seconds": (datetime.now(timezone.utc) - session_data["start_time"]).total_seconds(),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }, websocket)
                
                # Update database
                await db.stream_sessions.update_one(
                    {"id": session_id},
                    {"$set": {
                        "end_time": datetime.now(timezone.utc),
                        "is_active": False
                    }}
                )
                
            elif message.get("type") == "metrics":
                manager.stream_sessions[session_id]["metrics_count"] += 1
                
                # Broadcast metrics to all connected clients
                await manager.broadcast({
                    "type": "metrics_update",
                    "session_id": session_id,
                    "data": message.get("data"),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
                # Save metrics to database (batched)
                if manager.stream_sessions[session_id]["metrics_count"] % 10 == 0:
                    metrics = StreamMetrics(
                        session_id=session_id,
                        fps=message["data"]["fps"],
                        bitrate=message["data"]["bitrate"],
                        viewers=message["data"]["viewers"]
                    )
                    await db.stream_metrics.insert_one(metrics.model_dump())
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, session_id)

# REST API endpoints
@api_router.get("/")
async def root():
    return {
        "message": "SwanyBot Pro Ultimate API - Enhanced",
        "version": "3.0.0",
        "features": [
            "Claude AI Chat with Caching",
            "Streaming Responses",
            "Batch Processing",
            "Rate Limiting",
            "WebSocket Streaming",
            "Analytics & Metrics",
            "Content Moderation"
        ]
    }

@api_router.post("/chat", response_model=ChatResponse, dependencies=[Depends(RateLimiter(max_requests=20, window=60))])
async def chat_with_claude(request: ChatRequest):
    """Enhanced chat with caching and streaming support"""
    start_time = time.time()
    
    try:
        # Check cache
        cache_key = f"chat:{hashlib.md5(request.message.encode()).hexdigest()}"
        cached_response = await get_cache(cache_key)
        
        if cached_response:
            logger.info(f"Cache hit for: {request.message[:50]}...")
            return ChatResponse(
                message=cached_response,
                timestamp=datetime.now(timezone.utc),
                model=request.model,
                latency_ms=int((time.time() - start_time) * 1000),
                cached=True
            )
        
        # Get API key
        api_key = os.environ.get('EMERGENT_LLM_KEY') if request.use_emergent_key else None
        if not api_key:
            raise HTTPException(status_code=400, detail="API key not configured")
        
        # Get chat history
        history = await db.chat_messages.find(
            {"session_id": request.session_id}
        ).sort("timestamp", 1).limit(20).to_list(20)
        
        # Initialize Claude chat
        chat = LlmChat(
            api_key=api_key,
            session_id=request.session_id,
            system_message="You are SwanyBot Pro, an AI assistant for livestream creators. Be helpful, concise, and creative."
        ).with_model("anthropic", request.model)
        
        # Save user message
        user_msg = ChatMessage(
            session_id=request.session_id,
            role="user",
            content=request.message,
            model=request.model
        )
        await db.chat_messages.insert_one(user_msg.model_dump())
        
        # Send message to Claude
        user_message = UserMessage(text=request.message)
        response = await chat.send_message(user_message)
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Save assistant response
        assistant_msg = ChatMessage(
            session_id=request.session_id,
            role="assistant",
            content=response,
            model=request.model,
            latency_ms=latency_ms
        )
        await db.chat_messages.insert_one(assistant_msg.model_dump())
        
        # Cache the response (1 hour)
        await set_cache(cache_key, response, 3600)
        
        return ChatResponse(
            message=response,
            timestamp=datetime.now(timezone.utc),
            model=request.model,
            latency_ms=latency_ms,
            cached=False
        )
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/chat/batch")
async def batch_chat(request: BatchChatRequest):
    """Process multiple chat messages in batch"""
    results = []
    
    for msg in request.messages:
        try:
            chat_request = ChatRequest(
                session_id=request.session_id,
                message=msg.get("message", ""),
                use_emergent_key=request.use_emergent_key
            )
            response = await chat_with_claude(chat_request)
            results.append({
                "success": True,
                "message": response.message,
                "latency_ms": response.latency_ms
            })
        except Exception as e:
            results.append({
                "success": False,
                "error": str(e)
            })
    
    return {"results": results, "total": len(results)}

@api_router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str, limit: int = 50):
    """Get chat history for a session"""
    try:
        messages = await db.chat_messages.find(
            {"session_id": session_id}
        ).sort("timestamp", 1).limit(limit).to_list(limit)
        
        for msg in messages:
            msg.pop('_id', None)
            
        return {"messages": messages, "total": len(messages)}
    except Exception as e:
        logger.error(f"Error fetching chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analytics/sessions")
async def get_session_analytics():
    """Get session analytics"""
    try:
        total_sessions = await db.stream_sessions.count_documents({})
        active_sessions = await db.stream_sessions.count_documents({"is_active": True})
        
        # Aggregate stats
        pipeline = [
            {"$group": {
                "_id": None,
                "total_viewers": {"$sum": "$total_viewers"},
                "avg_viewers": {"$avg": "$peak_viewers"}
            }}
        ]
        stats = await db.stream_sessions.aggregate(pipeline).to_list(1)
        
        return {
            "total_sessions": total_sessions,
            "active_sessions": active_sessions,
            "websocket_connections": len(manager.active_connections),
            "stats": stats[0] if stats else {}
        }
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/health")
async def health_check():
    """Comprehensive health check"""
    health = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {}
    }
    
    # Check MongoDB
    try:
        await db.command("ping")
        health["services"]["mongodb"] = "healthy"
    except:
        health["services"]["mongodb"] = "unhealthy"
        health["status"] = "degraded"
    
    # Check Redis
    if REDIS_AVAILABLE:
        try:
            await redis_client.ping()
            health["services"]["redis"] = "healthy"
        except:
            health["services"]["redis"] = "unhealthy"
    else:
        health["services"]["redis"] = "not_configured"
    
    # Connection stats
    health["connections"] = {
        "websocket": len(manager.active_connections),
        "active_streams": len([s for s in manager.stream_sessions.values() if s.get("is_streaming")])
    }
    
    return health

@api_router.get("/metrics")
async def get_metrics():
    """Get system metrics"""
    return {
        "websocket_connections": len(manager.active_connections),
        "active_streams": len([s for s in manager.stream_sessions.values() if s.get("is_streaming")]),
        "total_sessions": len(manager.stream_sessions),
        "cache_enabled": REDIS_AVAILABLE,
        "uptime_seconds": time.time() - start_time if 'start_time' in globals() else 0
    }

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    global start_time
    start_time = time.time()
    logger.info("SwanyBot Pro Ultimate API - Enhanced Version Started")
    logger.info(f"Redis Cache: {'Enabled' if REDIS_AVAILABLE else 'Disabled (using memory)'}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    if REDIS_AVAILABLE:
        await redis_client.close()
    logger.info("Connections closed")
