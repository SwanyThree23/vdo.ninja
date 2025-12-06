# SwanyBot Pro Ultimate - AI Livestream Ecosystem

## 🎯 Overview

SwanyBot Pro Ultimate is a comprehensive AI-powered livestream management platform built with:
- **Backend**: FastAPI (Python) + WebSocket + MongoDB
- **Frontend**: React + Tailwind CSS + Radix UI
- **AI**: Claude Sonnet 4 via Emergent LLM Universal Key

## ✨ Features

### 1. Dashboard
- Real-time stream metrics (FPS, Bitrate, Viewers)
- Quick action buttons (Start Stream, AI Avatar, Create Clip, AI Music)
- Feature showcases for AI Video and Multi-Platform capabilities

### 2. AI Chat
- **Powered by Claude Sonnet 4**
- Intelligent assistant for livestream creators
- Persistent chat history in MongoDB
- Helps with streaming setup, content creation, and platform management

### 3. Stream Control
- Start/Stop streaming controls
- Live metrics display during streaming
- Multi-platform chat simulation (YouTube, Twitch, Kick)

### 4. Video Tools
- Real-Time Transform (Decart.ai Mirage)
- AI Video Generation (Sora 2 / Veo 3.1)
- Character Consistency (Midjourney Omni)
- AI Music Generation (Suno.ai Integration)

## 🏗️ Architecture

```
Backend (FastAPI)
├── WebSocket (/ws/{session_id}) - Real-time metrics
├── REST API (/api/chat) - Claude AI chat
├── REST API (/api/chat/history/{session_id}) - Chat history
├── REST API (/api/stream/sessions) - Stream sessions
├── REST API (/api/stream/metrics/{session_id}) - Stream metrics
└── REST API (/api/health) - Health check

Frontend (React)
├── Dashboard - Metrics visualization
├── AI Chat - Claude Sonnet 4 interface
├── Stream Control - Live stream management
└── Video Tools - AI production tools showcase
```

## 🔧 Technical Details

### Backend Technologies
- **FastAPI**: Modern async Python web framework
- **WebSocket**: Real-time bidirectional communication
- **Motor**: Async MongoDB driver
- **Emergent Integrations**: LLM integration library
- **Pydantic**: Data validation

### Frontend Technologies
- **React 19**: UI library
- **Tailwind CSS**: Utility-first CSS
- **Lucide React**: Icon library
- **WebSocket Client**: Real-time communication

### Database Schema
```javascript
// Chat Messages
{
  id: uuid,
  session_id: string,
  role: "user" | "assistant",
  content: string,
  timestamp: datetime
}

// Stream Sessions
{
  id: uuid,
  user_id: string,
  platforms: ["youtube", "twitch", "kick"],
  start_time: datetime,
  end_time: datetime?,
  is_active: boolean
}

// Stream Metrics
{
  session_id: uuid,
  fps: float,
  bitrate: float,
  viewers: int,
  timestamp: datetime
}
```

## 🚀 API Endpoints

### Chat
- `POST /api/chat` - Send message to Claude
  ```json
  {
    "session_id": "string",
    "message": "string",
    "use_emergent_key": true
  }
  ```

- `GET /api/chat/history/{session_id}` - Get chat history

### Streaming
- `WS /ws/{session_id}` - WebSocket connection for real-time metrics
- `GET /api/stream/sessions` - Get stream sessions
- `GET /api/stream/metrics/{session_id}` - Get stream metrics

### Health
- `GET /api/health` - Health check endpoint

## 🧪 Testing

### Test AI Chat (via curl)
```bash
curl -X POST "https://livestream-hub-44.preview.emergentagent.com/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session",
    "message": "What are the best streaming platforms for beginners?",
    "use_emergent_key": true
  }'
```

### WebSocket Testing
The WebSocket endpoint is available at:
```
wss://livestream-hub-44.preview.emergentagent.com/ws/{session_id}
```

**Note**: WebSocket connections require proper Kubernetes ingress configuration for wss:// protocol routing.

## 🔑 Environment Variables

### Backend (.env)
```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
CORS_ORIGINS=*
EMERGENT_LLM_KEY=sk-emergent-b28684b96617076783
```

### Frontend (.env)
```bash
REACT_APP_BACKEND_URL=https://livestream-hub-44.preview.emergentagent.com
WDS_SOCKET_PORT=443
```

## 📊 Features Status

| Feature | Status | Notes |
|---------|--------|-------|
| AI Chat (REST API) | ✅ Working | Claude Sonnet 4 integrated |
| Chat History | ✅ Working | MongoDB persistence |
| Dashboard UI | ✅ Working | All metrics cards functional |
| Stream Control UI | ✅ Working | UI complete |
| Video Tools UI | ✅ Working | Showcase ready |
| WebSocket Metrics | ⚠️ Infrastructure | Needs wss:// ingress config |
| Local Metrics Simulation | ✅ Working | Client-side simulation |

## 🎨 UI Features

### Glassmorphic Design
- Gradient backgrounds (purple → blue → indigo)
- Frosted glass effect cards
- Smooth animations and transitions
- Responsive layout

### Interactive Elements
- Tab navigation
- Quick action buttons
- Live status indicators
- Progress bars for metrics

### Color Coding
- 🟢 Green: FPS and performance metrics
- 🔵 Blue: Bitrate and bandwidth
- 🟣 Purple: Viewers and engagement
- 🔴 Red: Live streaming indicators

## 🔮 Future Enhancements

1. **Real OBS Integration**
   - Connect to OBS WebSocket
   - Scene switching automation
   - Overlay management

2. **Actual Platform Streaming**
   - YouTube Live API integration
   - Twitch API integration
   - Kick API integration

3. **AI Video Production**
   - Decart.ai Mirage integration
   - Sora/Veo video generation
   - Character consistency models

4. **AI Music Generation**
   - Suno.ai integration
   - Background music automation

5. **Multi-Platform Chat**
   - Real chat aggregation
   - Unified moderation
   - Auto-responses with AI

## 📝 Development

### Start Services
```bash
sudo supervisorctl restart all
```

### Check Logs
```bash
# Backend
tail -f /var/log/supervisor/backend.*.log

# Frontend
tail -f /var/log/supervisor/frontend.*.log
```

### Access Points
- **Frontend**: https://livestream-hub-44.preview.emergentagent.com
- **Backend API**: https://livestream-hub-44.preview.emergentagent.com/api
- **Health Check**: https://livestream-hub-44.preview.emergentagent.com/api/health

## 🎯 Use Cases

1. **Content Creators**: Manage multi-platform streams with AI assistance
2. **Streamers**: Get real-time advice and automation for streaming
3. **Video Producers**: Access AI tools for content creation
4. **Live Events**: Monitor and control live broadcasts

## 🤖 AI Integration

The platform uses **Emergent Universal LLM Key** which provides:
- Access to Claude Sonnet 4
- Automatic billing management
- No need for personal API keys
- Seamless integration

### Claude System Prompt
```
You are SwanyBot Pro, an AI assistant for livestream creators. 
You help with streaming setup, content creation, video production, 
and multi-platform management. Be helpful, concise, and creative.
```

## 🛠️ Troubleshooting

### WebSocket Connection Issues
If WebSocket connections fail, this is typically due to infrastructure routing. The REST API still works perfectly for chat functionality.

### Chat Not Responding
1. Check backend logs: `tail -f /var/log/supervisor/backend.err.log`
2. Verify Emergent LLM key is configured
3. Test with curl command above

### MongoDB Connection
Ensure MongoDB service is running:
```bash
sudo supervisorctl status mongodb
```

## 📄 License

Built with Emergent AI Platform

---

**Made with Emergent** 🚀
