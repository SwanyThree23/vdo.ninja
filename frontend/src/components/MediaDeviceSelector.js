import React, { useState } from 'react';
import { Camera, Mic, Monitor, X, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { useMediaDevices } from '../hooks/useMediaDevices';

const MediaDeviceSelector = ({ onStreamReady, onClose }) => {
  const {
    devices,
    permissions,
    stream,
    selectedDevices,
    error,
    requestCameraAndMicrophone,
    requestScreenShare,
    stopStream,
    changeDevice,
    enumerateDevices
  } = useMediaDevices();

  const [activeTab, setActiveTab] = useState('camera');
  const [isRequesting, setIsRequesting] = useState(false);
  const videoRef = React.useRef(null);

  // Update video preview when stream changes
  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleRequestAccess = async () => {
    setIsRequesting(true);
    const mediaStream = await requestCameraAndMicrophone(
      selectedDevices.camera,
      selectedDevices.microphone
    );
    setIsRequesting(false);
    
    if (mediaStream && onStreamReady) {
      onStreamReady(mediaStream);
    }
  };

  const handleRequestScreen = async () => {
    const screenStream = await requestScreenShare();
    if (screenStream && onStreamReady) {
      onStreamReady(screenStream);
    }
  };

  const handleDeviceChange = async (type, deviceId) => {
    await changeDevice(type, deviceId);
  };

  const getPermissionIcon = (status) => {
    switch (status) {
      case 'granted':
        return <Check className="w-4 h-4 text-green-400" />;
      case 'denied':
        return <X className="w-4 h-4 text-red-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getPermissionText = (status) => {
    switch (status) {
      case 'granted':
        return 'Granted';
      case 'denied':
        return 'Denied';
      default:
        return 'Not requested';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Camera className="w-8 h-8 text-purple-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">Device Settings</h2>
              <p className="text-sm text-gray-300">Configure camera, microphone, and screen sharing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-200">{error}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['camera', 'screen'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                activeTab === tab
                  ? 'bg-purple-500'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              {tab === 'camera' ? (
                <span className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Camera & Mic
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  Screen Share
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'camera' && (
          <div className="space-y-6">
            {/* Video Preview */}
            <div className="bg-black rounded-xl overflow-hidden aspect-video">
              {stream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <Camera className="w-20 h-20 mx-auto mb-4 opacity-50" />
                    <p>Click "Enable Camera & Microphone" to start preview</p>
                  </div>
                </div>
              )}
            </div>

            {/* Permissions Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">Camera Permission</span>
                  {getPermissionIcon(permissions.camera)}
                </div>
                <div className="text-lg font-bold text-white">
                  {getPermissionText(permissions.camera)}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">Microphone Permission</span>
                  {getPermissionIcon(permissions.microphone)}
                </div>
                <div className="text-lg font-bold text-white">
                  {getPermissionText(permissions.microphone)}
                </div>
              </div>
            </div>

            {/* Device Selection */}
            <div className="space-y-4">
              {/* Camera Selection */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  <Camera className="w-4 h-4 inline mr-2" />
                  Camera
                </label>
                <select
                  value={selectedDevices.camera || ''}
                  onChange={(e) => handleDeviceChange('camera', e.target.value)}
                  disabled={devices.cameras.length === 0}
                  className="w-full bg-white/10 rounded-lg px-4 py-3 border border-white/20 focus:border-purple-500 focus:outline-none text-white disabled:opacity-50"
                >
                  {devices.cameras.length === 0 ? (
                    <option>No cameras found</option>
                  ) : (
                    devices.cameras.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId.substring(0, 8)}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Microphone Selection */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  <Mic className="w-4 h-4 inline mr-2" />
                  Microphone
                </label>
                <select
                  value={selectedDevices.microphone || ''}
                  onChange={(e) => handleDeviceChange('microphone', e.target.value)}
                  disabled={devices.microphones.length === 0}
                  className="w-full bg-white/10 rounded-lg px-4 py-3 border border-white/20 focus:border-purple-500 focus:outline-none text-white disabled:opacity-50"
                >
                  {devices.microphones.length === 0 ? (
                    <option>No microphones found</option>
                  ) : (
                    devices.microphones.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.substring(0, 8)}`}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleRequestAccess}
                disabled={isRequesting || (permissions.camera === 'granted' && stream)}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 rounded-lg hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRequesting ? 'Requesting Access...' : 
                 stream ? 'Camera & Microphone Active' : 
                 'Enable Camera & Microphone'}
              </button>
              {stream && (
                <button
                  onClick={stopStream}
                  className="px-6 py-3 bg-red-500/20 border border-red-500 text-white font-semibold rounded-lg hover:bg-red-500/30 transition"
                >
                  Stop
                </button>
              )}
              <button
                onClick={enumerateDevices}
                className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition"
                title="Refresh devices"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'screen' && (
          <div className="space-y-6">
            <div className="bg-white/5 rounded-xl p-8 text-center">
              <Monitor className="w-20 h-20 mx-auto mb-4 text-purple-400" />
              <h3 className="text-2xl font-bold text-white mb-2">Screen Sharing</h3>
              <p className="text-gray-300 mb-6">
                Share your entire screen, a window, or a browser tab with your audience
              </p>
              
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Screen Share Permission</span>
                  {getPermissionIcon(permissions.screen)}
                </div>
                <div className="text-lg font-bold text-white mt-2">
                  {getPermissionText(permissions.screen)}
                </div>
              </div>

              <button
                onClick={handleRequestScreen}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold px-8 py-3 rounded-lg hover:scale-105 transition"
              >
                Start Screen Sharing
              </button>
            </div>

            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-200">
                💡 <strong>Tip:</strong> Screen sharing works best when sharing a single application window
                rather than your entire screen for better performance.
              </p>
            </div>
          </div>
        )}

        {/* Device Info */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-purple-400">{devices.cameras.length}</div>
              <div className="text-sm text-gray-400">Cameras</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">{devices.microphones.length}</div>
              <div className="text-sm text-gray-400">Microphones</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{devices.speakers.length}</div>
              <div className="text-sm text-gray-400">Speakers</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaDeviceSelector;