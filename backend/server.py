from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path
from emergentintegrations.llm.chat import LlmChat, UserMessage
import os
import json
import uuid
import logging
import asyncio

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
            "is_streaming": False
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
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    session_id: str
    message: str
    use_emergent_key: bool = True

class ChatResponse(BaseModel):
    message: str
    timestamp: datetime

class StreamSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    platforms: List[str]
    start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    is_active: bool = True

class StreamMetrics(BaseModel):
    session_id: str
    fps: float
    bitrate: float
    viewers: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
                await manager.send_personal_message({
                    "type": "stream_stopped",
                    "session_id": session_id,
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
                # Broadcast metrics to all connected clients
                await manager.broadcast({
                    "type": "metrics_update",
                    "session_id": session_id,
                    "data": message.get("data"),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
                # Save metrics to database
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
    return {"message": "SwanyBot Pro Ultimate API"}

@api_router.post("/chat", response_model=ChatResponse)
async def chat_with_claude(request: ChatRequest):
    """Chat with Claude using Emergent LLM key"""
    try:
        # Get API key
        api_key = os.environ.get('EMERGENT_LLM_KEY') if request.use_emergent_key else None
        if not api_key:
            raise HTTPException(status_code=400, detail="API key not configured")
        
        # Get chat history from database
        history = await db.chat_messages.find(
            {"session_id": request.session_id}
        ).sort("timestamp", 1).limit(50).to_list(50)
        
        # Initialize Claude chat
        chat = LlmChat(
            api_key=api_key,
            session_id=request.session_id,
            system_message="You are SwanyBot Pro, an AI assistant for livestream creators. You help with streaming setup, content creation, video production, and multi-platform management. Be helpful, concise, and creative."
        ).with_model("anthropic", "claude-4-sonnet-20250514")
        
        # Save user message to database
        user_msg = ChatMessage(
            session_id=request.session_id,
            role="user",
            content=request.message
        )
        await db.chat_messages.insert_one(user_msg.model_dump())
        
        # Send message to Claude
        user_message = UserMessage(text=request.message)
        response = await chat.send_message(user_message)
        
        # Save assistant response to database
        assistant_msg = ChatMessage(
            session_id=request.session_id,
            role="assistant",
            content=response
        )
        await db.chat_messages.insert_one(assistant_msg.model_dump())
        
        return ChatResponse(
            message=response,
            timestamp=datetime.now(timezone.utc)
        )
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str, limit: int = 50):
    """Get chat history for a session"""
    try:
        messages = await db.chat_messages.find(
            {"session_id": session_id}
        ).sort("timestamp", 1).limit(limit).to_list(limit)
        
        # Remove MongoDB _id field
        for msg in messages:
            msg.pop('_id', None)
            
        return {"messages": messages}
    except Exception as e:
        logger.error(f"Error fetching chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/stream/sessions")
async def get_stream_sessions(active_only: bool = False):
    """Get stream sessions"""
    try:
        query = {"is_active": True} if active_only else {}
        sessions = await db.stream_sessions.find(query).sort("start_time", -1).limit(50).to_list(50)
        
        for session in sessions:
            session.pop('_id', None)
            
        return {"sessions": sessions}
    except Exception as e:
        logger.error(f"Error fetching sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/stream/metrics/{session_id}")
async def get_stream_metrics(session_id: str, limit: int = 100):
    """Get stream metrics for a session"""
    try:
        metrics = await db.stream_metrics.find(
            {"session_id": session_id}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        for metric in metrics:
            metric.pop('_id', None)
            
        return {"metrics": metrics}
    except Exception as e:
        logger.error(f"Error fetching metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "websocket_connections": len(manager.active_connections),
        "active_streams": len([s for s in manager.stream_sessions.values() if s.get("is_streaming")])
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    logger.info("MongoDB connection closed")