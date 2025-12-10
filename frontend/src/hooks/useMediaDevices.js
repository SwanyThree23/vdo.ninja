import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing media devices (camera, microphone, screen)
 */
export const useMediaDevices = () => {
  const [devices, setDevices] = useState({
    cameras: [],
    microphones: [],
    speakers: []
  });
  const [permissions, setPermissions] = useState({
    camera: 'prompt',
    microphone: 'prompt',
    screen: 'prompt'
  });
  const [stream, setStream] = useState(null);
  const [selectedDevices, setSelectedDevices] = useState({
    camera: null,
    microphone: null
  });
  const [error, setError] = useState(null);

  // Enumerate devices
  const enumerateDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = deviceList.filter(device => device.kind === 'videoinput');
      const microphones = deviceList.filter(device => device.kind === 'audioinput');
      const speakers = deviceList.filter(device => device.kind === 'audiooutput');
      
      setDevices({ cameras, microphones, speakers });
      
      // Auto-select first device if none selected
      if (!selectedDevices.camera && cameras.length > 0) {
        setSelectedDevices(prev => ({ ...prev, camera: cameras[0].deviceId }));
      }
      if (!selectedDevices.microphone && microphones.length > 0) {
        setSelectedDevices(prev => ({ ...prev, microphone: microphones[0].deviceId }));
      }
      
      return { cameras, microphones, speakers };
    } catch (err) {
      console.error('Error enumerating devices:', err);
      setError(err.message);
      return null;
    }
  }, [selectedDevices]);

  // Check permissions
  const checkPermissions = useCallback(async () => {
    try {
      if (navigator.permissions) {
        const cameraPermission = await navigator.permissions.query({ name: 'camera' });
        const microphonePermission = await navigator.permissions.query({ name: 'microphone' });
        
        setPermissions({
          camera: cameraPermission.state,
          microphone: microphonePermission.state,
          screen: 'prompt' // Screen share doesn't have a queryable permission
        });
      }
    } catch (err) {
      console.error('Error checking permissions:', err);
    }
  }, []);

  // Request camera access
  const requestCamera = useCallback(async (deviceId = null) => {
    try {
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setPermissions(prev => ({ ...prev, camera: 'granted' }));
      setError(null);
      
      await enumerateDevices();
      
      return mediaStream;
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError(err.message);
      setPermissions(prev => ({ ...prev, camera: 'denied' }));
      return null;
    }
  }, [enumerateDevices]);

  // Request microphone access
  const requestMicrophone = useCallback(async (deviceId = null) => {
    try {
      const constraints = {
        video: false,
        audio: deviceId ? { deviceId: { exact: deviceId } } : true
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setPermissions(prev => ({ ...prev, microphone: 'granted' }));
      setError(null);
      
      await enumerateDevices();
      
      return mediaStream;
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError(err.message);
      setPermissions(prev => ({ ...prev, microphone: 'denied' }));
      return null;
    }
  }, [enumerateDevices]);

  // Request both camera and microphone
  const requestCameraAndMicrophone = useCallback(async (cameraId = null, microphoneId = null) => {
    try {
      const constraints = {
        video: cameraId ? { deviceId: { exact: cameraId } } : {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: microphoneId ? { deviceId: { exact: microphoneId } } : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setPermissions({
        camera: 'granted',
        microphone: 'granted',
        screen: 'prompt'
      });
      setError(null);
      
      await enumerateDevices();
      
      return mediaStream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError(err.message);
      return null;
    }
  }, [enumerateDevices]);

  // Request screen share
  const requestScreenShare = useCallback(async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: true
      });
      
      setPermissions(prev => ({ ...prev, screen: 'granted' }));
      setError(null);
      
      return displayStream;
    } catch (err) {
      console.error('Error accessing screen:', err);
      setError(err.message);
      setPermissions(prev => ({ ...prev, screen: 'denied' }));
      return null;
    }
  }, []);

  // Stop all tracks
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Change device
  const changeDevice = useCallback(async (type, deviceId) => {
    setSelectedDevices(prev => ({ ...prev, [type]: deviceId }));
    
    // Stop current stream
    stopStream();
    
    // Request new stream with selected device
    if (type === 'camera') {
      return await requestCamera(deviceId);
    } else if (type === 'microphone') {
      return await requestMicrophone(deviceId);
    }
  }, [stopStream, requestCamera, requestMicrophone]);

  // Initialize on mount
  useEffect(() => {
    checkPermissions();
    enumerateDevices();
    
    // Listen for device changes
    const handleDeviceChange = () => {
      enumerateDevices();
    };
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      stopStream();
    };
  }, [checkPermissions, enumerateDevices, stopStream]);

  return {
    devices,
    permissions,
    stream,
    selectedDevices,
    error,
    requestCamera,
    requestMicrophone,
    requestCameraAndMicrophone,
    requestScreenShare,
    stopStream,
    changeDevice,
    enumerateDevices
  };
};