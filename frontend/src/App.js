import { useState, useEffect, useRef } from 'react';
import './App.css';
import { 
  Video, Users, TrendingUp, MessageSquare, Shield, 
  Film, Sparkles, Globe, Settings as SettingsIcon
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isStreaming, setIsStreaming] = useState(false);
  const [metrics, setMetrics] = useState({ fps: 60, bitrate: 6000, viewers: 0 });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const metricsIntervalRef = useRef(null);

  // WebSocket connection
  useEffect(() => {
    connectWebSocket();
    loadChatHistory();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(`${WS_URL}/ws/${sessionId}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);
        
        if (data.type === 'stream_started') {
          console.log('Stream started:', data.session_id);
        } else if (data.type === 'stream_stopped') {
          console.log('Stream stopped:', data.session_id);
        } else if (data.type === 'metrics_update') {
          setMetrics(data.data);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`${API}/chat/history/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        const formattedMessages = data.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || processing) return;
    
    setProcessing(true);
    const userMessage = input.trim();
    setInput('');
    
    // Add user message to UI immediately
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    try {
      const response = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMessage,
          use_emergent_key: true
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to get response'}`);
      }
    } catch (error) {
      console.error('Chat error:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const toggleStream = () => {
    if (!wsConnected) {
      alert('WebSocket not connected. Please wait...');
      return;
    }
    
    const newStreamingState = !isStreaming;
    setIsStreaming(newStreamingState);
    
    if (newStreamingState) {
      // Start streaming
      wsRef.current.send(JSON.stringify({
        type: 'stream_start',
        user_id: 'demo-user',
        platforms: ['youtube', 'twitch', 'kick']
      }));
      
      // Start sending metrics
      metricsIntervalRef.current = setInterval(() => {
        const newMetrics = {
          fps: 58 + Math.random() * 4,
          bitrate: 5800 + Math.random() * 400,
          viewers: Math.max(0, Math.floor(metrics.viewers + Math.random() * 10 - 4))
        };
        setMetrics(newMetrics);
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'metrics',
            data: newMetrics
          }));
        }
      }, 2000);
    } else {
      // Stop streaming
      wsRef.current.send(JSON.stringify({
        type: 'stream_stop'
      }));
      
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'chat', label: 'AI Chat' },
    { id: 'stream', label: 'Stream Control' },
    { id: 'video', label: 'Video Tools' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
              <Video className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">SwanyBot Pro Ultimate</h1>
              <p className="text-sm text-purple-300">AI Livestream Ecosystem</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {wsConnected && (
              <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1.5 rounded-full border border-green-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-semibold text-xs">Connected</span>
              </div>
            )}
            {isStreaming && (
              <div className="flex items-center gap-2 bg-red-500/20 px-4 py-2 rounded-full border border-red-500">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="font-semibold text-sm">LIVE</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-purple-500 shadow-lg shadow-purple-500/50'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard 
                icon={TrendingUp} 
                label="FPS" 
                value={metrics.fps.toFixed(0)} 
                color="green"
                progress={metrics.fps}
              />
              <MetricCard 
                icon={Video} 
                label="Bitrate (kbps)" 
                value={metrics.bitrate.toFixed(0)} 
                color="blue"
                progress={85}
              />
              <MetricCard 
                icon={Users} 
                label="Viewers" 
                value={metrics.viewers} 
                color="purple"
              />
            </div>

            <QuickActions onStreamToggle={toggleStream} isStreaming={isStreaming} />
            <FeatureGrid />
          </div>
        )}

        {/* AI Chat */}
        {activeTab === 'chat' && (
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <MessageSquare className="w-8 h-8 text-purple-400" />
              SwanyBot Pro AI
            </h2>
            
            <div className="bg-black/30 rounded-xl p-4 h-[500px] overflow-y-auto mb-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 mt-32">
                  <Sparkles className="w-20 h-20 mx-auto mb-4 text-purple-400 animate-pulse" />
                  <p className="text-2xl mb-2">Start chatting with SwanyBot Pro!</p>
                  <p className="text-sm">Powered by Claude Sonnet 4</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-5 py-3 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                          : 'bg-white/10 border border-white/20'
                      }`}>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about streaming, content creation, video tools..."
                disabled={processing}
                className="flex-1 bg-white/10 rounded-xl px-5 py-4 border border-white/20 focus:border-purple-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={processing}
                className="bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-4 rounded-xl font-semibold hover:scale-105 transition disabled:opacity-50"
              >
                {processing ? '⏳' : '🚀'}
              </button>
            </div>
          </div>
        )}

        {/* Stream Control */}
        {activeTab === 'stream' && (
          <StreamControl onToggle={toggleStream} isStreaming={isStreaming} metrics={metrics} />
        )}

        {/* Video Tools */}
        {activeTab === 'video' && <VideoTools />}
      </main>
    </div>
  );
}

// Component: MetricCard
function MetricCard({ icon: Icon, label, value, color, progress }) {
  const colors = {
    green: 'text-green-400 bg-green-500/20 border-green-500',
    blue: 'text-blue-400 bg-blue-500/20 border-blue-500',
    purple: 'text-purple-400 bg-purple-500/20 border-purple-500'
  };

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-6 h-6 ${colors[color].split(' ')[0]}`} />
        <span className={`text-3xl font-bold ${colors[color].split(' ')[0]}`}>{value}</span>
      </div>
      <div className="text-sm text-gray-400">{label}</div>
      {progress && (
        <div className={`w-full ${colors[color].split(' ')[1]} rounded-full h-2 mt-2`}>
          <div className={`${colors[color].split(' ')[0].replace('text', 'bg')} h-2 rounded-full`} style={{width: `${Math.min(100, progress)}%`}} />
        </div>
      )}
    </div>
  );
}

// Component: QuickActions
function QuickActions({ onStreamToggle, isStreaming }) {
  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
      <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button 
          onClick={onStreamToggle}
          className={`p-4 rounded-xl font-semibold transition hover:scale-105 ${
            isStreaming 
              ? 'bg-gradient-to-r from-red-500 to-pink-500' 
              : 'bg-gradient-to-r from-green-500 to-emerald-500'
          }`}
        >
          {isStreaming ? '⏹️ Stop Stream' : '▶️ Start Stream'}
        </button>
        <button className="p-4 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition">
          🎭 AI Avatar
        </button>
        <button className="p-4 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition">
          🎬 Create Clip
        </button>
        <button className="p-4 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition">
          🎵 AI Music
        </button>
      </div>
    </div>
  );
}

// Component: FeatureGrid
function FeatureGrid() {
  const features = [
    { title: 'Real-Time AI Video', icon: Film, items: [
      { emoji: '✨', name: 'Decart.ai Transform', desc: 'Instant avatar changes' },
      { emoji: '🎤', name: 'Live Lip-Sync', desc: 'Voice-to-avatar sync' }
    ]},
    { title: 'Multi-Platform', icon: Globe, items: [
      { emoji: '📡', name: 'Unified Chat', desc: 'All platforms in one' },
      { emoji: '🎥', name: 'OBS Integration', desc: 'Scene automation' }
    ]}
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {features.map((feature, idx) => (
        <div key={idx} className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <feature.icon className="w-6 h-6 text-purple-400" />
            {feature.title}
          </h3>
          <div className="space-y-3">
            {feature.items.map((item, i) => (
              <div key={i} className="flex gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition">
                <div className="text-2xl">{item.emoji}</div>
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-gray-400">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Component: StreamControl
function StreamControl({ onToggle, isStreaming, metrics }) {
  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
      <h2 className="text-2xl font-bold mb-6">Livestream Control</h2>
      
      <div className="text-center mb-8">
        <button
          onClick={onToggle}
          className={`px-16 py-8 rounded-2xl font-bold text-2xl transition hover:scale-105 ${
            isStreaming
              ? 'bg-gradient-to-r from-red-500 to-pink-500'
              : 'bg-gradient-to-r from-green-500 to-emerald-500'
          }`}
        >
          {isStreaming ? '⏹️ STOP' : '▶️ START'}
        </button>
      </div>

      {isStreaming && (
        <div className="bg-black/30 rounded-xl p-4 mb-6">
          <h3 className="font-bold mb-4">Live Metrics</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{metrics.fps.toFixed(0)}</div>
              <div className="text-sm text-gray-400">FPS</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{metrics.bitrate.toFixed(0)}</div>
              <div className="text-sm text-gray-400">Bitrate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{metrics.viewers}</div>
              <div className="text-sm text-gray-400">Viewers</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-black/30 rounded-xl p-4">
        <h3 className="font-bold mb-4">Multi-Platform Chat</h3>
        <div className="space-y-2">
          {[
            { platform: 'YT', color: 'bg-red-500', user: 'Viewer1', msg: 'Amazing stream! 🔥' },
            { platform: 'TW', color: 'bg-purple-500', user: 'Viewer2', msg: 'This is incredible!' },
            { platform: 'KK', color: 'bg-green-500', user: 'Viewer3', msg: 'Best content ever!' }
          ].map((chat, i) => (
            <div key={i} className="flex items-start gap-3 bg-white/5 p-3 rounded-lg">
              <div className={`${chat.color} w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold`}>
                {chat.platform}
              </div>
              <div>
                <div className="font-semibold text-sm">{chat.user}</div>
                <div className="text-sm text-gray-300">{chat.msg}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Component: VideoTools
function VideoTools() {
  const tools = [
    { name: 'Real-Time Transform', desc: 'Decart.ai Mirage', icon: '✨' },
    { name: 'AI Video Gen', desc: 'Sora 2 / Veo 3.1', icon: '🎬' },
    { name: 'Character Consistency', desc: 'Midjourney Omni', icon: '👥' },
    { name: 'AI Music', desc: 'Suno.ai Integration', icon: '🎵' }
  ];

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
      <h2 className="text-2xl font-bold mb-6">AI Video Production</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tools.map((tool, i) => (
          <div key={i} className="bg-white/5 rounded-xl p-4 border border-purple-500/30 hover:bg-white/10 transition">
            <div className="text-4xl mb-2">{tool.icon}</div>
            <h3 className="font-bold mb-1">{tool.name}</h3>
            <p className="text-sm text-gray-400 mb-4">{tool.desc}</p>
            <button className="w-full bg-purple-500 px-4 py-2 rounded-lg hover:bg-purple-600 transition">
              Launch Tool
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;