import { useState, useEffect } from 'react';
import './App.css';
import { 
  Video, Users, TrendingUp, MessageSquare, Shield, 
  Film, Sparkles, Globe, LogOut, User, CreditCard
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import CreditDisplay from './components/Credits/CreditDisplay';
import BuyCreditsModal from './components/Credits/BuyCreditsModal';
import { chatAPI } from './services/api';
import io from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8002';

function MainApp() {
  const { user, isAuthenticated, logout, credits, refreshCredits } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isStreaming, setIsStreaming] = useState(false);
  const [metrics, setMetrics] = useState({ fps: 60, bitrate: 6000, viewers: 0 });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [socket, setSocket] = useState(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  // Socket.IO connection
  useEffect(() => {
    if (isAuthenticated) {
      const newSocket = io(BACKEND_URL);
      
      newSocket.on('connect', () => {
        console.log('✅ Socket connected');
      });

      newSocket.on('stream:started', (data) => {
        console.log('Stream started:', data);
      });

      newSocket.on('metrics:update', (data) => {
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      });

      setSocket(newSocket);

      return () => newSocket.disconnect();
    }
  }, [isAuthenticated]);

  // Load chat history
  useEffect(() => {
    if (isAuthenticated) {
      loadChatHistory();
    }
  }, [isAuthenticated]);

  const loadChatHistory = async () => {
    try {
      const response = await chatAPI.getHistory(sessionId);
      setMessages(response.data.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })));
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || processing) return;
    
    setProcessing(true);
    const userMessage = input.trim();
    setInput('');
    
    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    try {
      const response = await chatAPI.sendMessage({
        session_id: sessionId,
        message: userMessage
      });
      
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.message }]);
      
      // Refresh credits after successful chat
      await refreshCredits();
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to send message';
      alert(errorMsg);
      
      if (errorMsg.includes('Insufficient credits')) {
        setShowBuyCredits(true);
      }
    } finally {
      setProcessing(false);
    }
  };

  const toggleStream = () => {
    const newState = !isStreaming;
    setIsStreaming(newState);
    
    if (socket) {
      if (newState) {
        socket.emit('stream:start', {
          streamId: sessionId,
          userId: user?.id,
          platforms: ['youtube', 'twitch', 'kick']
        });
        
        // Simulate metrics
        const interval = setInterval(() => {
          const newMetrics = {
            fps: 58 + Math.random() * 4,
            bitrate: 5800 + Math.random() * 400,
            viewers: Math.max(0, Math.floor(metrics.viewers + Math.random() * 10 - 4))
          };
          setMetrics(newMetrics);
          socket.emit('stream:metrics', { streamId: sessionId, metrics: newMetrics });
        }, 2000);
        
        return () => clearInterval(interval);
      } else {
        socket.emit('stream:stop', { streamId: sessionId });
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
              <p className="text-sm text-purple-300">Enterprise AI Livestream Platform</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Credit Display */}
            <CreditDisplay onBuyCredits={() => setShowBuyCredits(true)} />
            
            {/* User Menu */}
            <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-full">
              <User className="w-5 h-5" />
              <div className="text-sm">
                <div className="font-semibold">{user?.username}</div>
                <div className="text-xs text-gray-300">{user?.email}</div>
              </div>
              <button
                onClick={logout}
                className="p-2 hover:bg-white/10 rounded-lg transition"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

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
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-8 h-8 text-purple-400" />
                <div>
                  <h2 className="text-2xl font-bold">SwanyBot Pro AI</h2>
                  <p className="text-sm text-gray-300">Powered by Claude Sonnet 4 (1 credit per message)</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">Your Credits</div>
                <div className="text-2xl font-bold text-yellow-400">{credits}</div>
              </div>
            </div>
            
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
                disabled={processing || credits < 1}
                className="flex-1 bg-white/10 rounded-xl px-5 py-4 border border-white/20 focus:border-purple-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={processing || credits < 1}
                className="bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-4 rounded-xl font-semibold hover:scale-105 transition disabled:opacity-50"
              >
                {processing ? '⏳' : credits < 1 ? '💳' : '🚀'}
              </button>
            </div>
            
            {credits < 1 && (
              <div className="mt-2 text-center">
                <button
                  onClick={() => setShowBuyCredits(true)}
                  className="text-sm text-yellow-400 hover:text-yellow-300"
                >
                  Out of credits? Click here to buy more
                </button>
              </div>
            )}
          </div>
        )}

        {/* Stream Control */}
        {activeTab === 'stream' && (
          <StreamControl onToggle={toggleStream} isStreaming={isStreaming} metrics={metrics} />
        )}

        {/* Video Tools */}
        {activeTab === 'video' && <VideoTools />}
      </main>

      {/* Buy Credits Modal */}
      <BuyCreditsModal isOpen={showBuyCredits} onClose={() => setShowBuyCredits(false)} />
    </div>
  );
}

// Rest of the components (MetricCard, QuickActions, etc.) remain the same
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

function VideoTools() {
  const tools = [
    { name: 'Real-Time Transform', desc: 'Decart.ai Mirage', icon: '✨', credits: 10 },
    { name: 'AI Video Gen', desc: 'Sora 2 / Veo 3.1', icon: '🎬', credits: 10 },
    { name: 'Character Consistency', desc: 'Midjourney Omni', icon: '👥', credits: 8 },
    { name: 'AI Music', desc: 'Suno.ai Integration', icon: '🎵', credits: 5 }
  ];

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
      <h2 className="text-2xl font-bold mb-6">AI Video Production</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tools.map((tool, i) => (
          <div key={i} className="bg-white/5 rounded-xl p-4 border border-purple-500/30 hover:bg-white/10 transition">
            <div className="text-4xl mb-2">{tool.icon}</div>
            <h3 className="font-bold mb-1">{tool.name}</h3>
            <p className="text-sm text-gray-400 mb-2">{tool.desc}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-yellow-400">{tool.credits} credits</span>
              <button className="bg-purple-500 px-4 py-2 rounded-lg hover:bg-purple-600 transition text-sm">
                Launch Tool
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main App with Authentication Wrapper
function App() {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <AuthProvider>
      <AppWithAuth showLogin={showLogin} setShowLogin={setShowLogin} />
    </AuthProvider>
  );
}

function AppWithAuth({ showLogin, setShowLogin }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return showLogin ? (
      <Login 
        onSwitchToRegister={() => setShowLogin(false)}
        onSuccess={() => {}}
      />
    ) : (
      <Register 
        onSwitchToLogin={() => setShowLogin(true)}
        onSuccess={() => {}}
      />
    );
  }

  return <MainApp />;
}

export default App;
