import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Shield, Camera, Image, Bell, Settings, Menu, X, Upload, Play, Square, AlertTriangle } from 'lucide-react'

const CLASS_STATS = {
  Assault_Rifle:  { Damage: 1,   Range: 1,   Magazine: 1,   Recoil: 0.7 },
  Pistol:         { Damage: 0.8, Range: 0.5, Magazine: 0.4, Recoil: 0.7 },
  Grenade_Bandolier: { Damage: 1, Range: 0.3, Magazine: 0.2, Recoil: 0   },
  B2_Bomber:      { Damage: 0,   Range: 0,   Magazine: 0,   Recoil: 0   },
  knife:          { Damage: 0.7, Range: 0.1, Magazine: 1,   Recoil: 0   },
  person:         { Damage: 0.5, Range: 0.2, Magazine: 1,   Recoil: 0   },
  Rocket_Launcher:{ Damage: 1,   Range: 1,   Magazine: 0.1, Recoil: 0   },
  shotgun:        { Damage: 1,   Range: 0.1, Magazine: 0.5, Recoil: 0.6 }
}

// Utility function to convert hex to base64
const hexToBase64 = (hexstring) => {
  const bytes = new Uint8Array(hexstring.length / 2)
  for (let i = 0; i < hexstring.length; i += 2) {
    bytes[i / 2] = parseInt(hexstring.substr(i, 2), 16)
  }
  return btoa(String.fromCharCode.apply(null, bytes))
}

const computeSurvivalProbability = (invaders, defenders, homeAdvantage = 0.1) => {
  // Debug logging
  console.log('Computing survival probability:', { invaders, defenders })
  
  // Handle edge cases
  if (!Array.isArray(invaders) || !Array.isArray(defenders)) {
    console.error('Invalid input to computeSurvivalProbability:', { invaders, defenders })
    return 0.5
  }
  
  if (invaders.length === 0 && defenders.length === 0) return 0.5
  if (invaders.length === 0) return 1
  if (defenders.length === 0) return 0
  
  // Ensure all objects have the required properties
  const validInvaders = invaders.filter(i => i && typeof i === 'object' && i.count > 0)
  const validDefenders = defenders.filter(d => d && typeof d === 'object' && d.count > 0)
  
  if (validInvaders.length === 0 && validDefenders.length === 0) return 0.5
  if (validInvaders.length === 0) return 1
  if (validDefenders.length === 0) return 0
  
  const allRanges = [...validInvaders, ...validDefenders].map(f => Math.max(f.R || 0.1, 0.01))
  const avgR = allRanges.length > 0 ? allRanges.reduce((sum, r) => sum + r, 0) / allRanges.length : 0.1
  
  const effectiveness = ({ count, D, R, M, Re }) => {
    // Ensure all values are numbers and have reasonable defaults
    const safeCount = typeof count === 'number' && !isNaN(count) ? Math.max(count, 0) : 0
    const safeD = typeof D === 'number' && !isNaN(D) ? D : 0.1
    const safeR = typeof R === 'number' && !isNaN(R) ? R : 0.1
    const safeM = typeof M === 'number' && !isNaN(M) ? M : 0.1
    const safeRe = typeof Re === 'number' && !isNaN(Re) ? Re : 0
    
    const damage = Math.pow(Math.max(safeD, 0.01), 1.1)
    const range = Math.max(safeR, 0.01) / (Math.max(safeR, 0.01) + avgR)
    const magazine = Math.log(1 + Math.max(safeM, 0.01))
    const recoil = Math.exp(-2 * Math.max(safeRe, 0))
    const result = safeCount * damage * range * magazine * recoil
    console.log(`Effectiveness for ${safeCount} units:`, { damage, range, magazine, recoil, result })
    return result
  }
  
  const S_inv = validInvaders.reduce((sum, i) => sum + effectiveness(i), 0)
  const S_def = validDefenders.reduce((sum, d) => sum + effectiveness(d), 0) * (1 + homeAdvantage)
  
  console.log('Survival calculation:', { S_inv, S_def, total: S_def + S_inv })
  
  // Avoid division by zero
  let probability = 0.5
  if (S_def + S_inv > 0) {
    probability = S_def / (S_def + S_inv)
  } else if (validDefenders.length > 0 && validInvaders.length === 0) {
    probability = 1
  } else if (validDefenders.length === 0 && validInvaders.length > 0) {
    probability = 0
  }
  
  console.log('Final survival probability:', probability)
  
  return Math.max(0, Math.min(1, probability)) // Ensure it's between 0 and 1
}

export default function App() {
  const [mode, setMode] = useState('image')
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [isDarkMode, setDarkMode] = useState(false)
  const [preview, setPreview] = useState(null)
  const [originalImage, setOriginalImage] = useState(null)
  const [counts, setCounts] = useState({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraError, setCameraError] = useState(null)
  const [isLiveDetection, setIsLiveDetection] = useState(false)
  const [error, setError] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen)
  const toggleDarkMode = () => setDarkMode(!isDarkMode)

  const { survivalProbability, threatLevel } = useMemo(() => {
    const calculateSurvivalProbability = () => {
      console.log('Current counts:', counts)
      
      if (!counts || Object.keys(counts).length === 0) {
        console.log('No counts available, returning default 0.5')
        return 0.5
      }
      
      const invaders = []
      const defenders = []
      
      Object.entries(counts).forEach(([className, count]) => {
        const numericCount = parseInt(count) || 0
        console.log(`Processing ${className}: ${count} -> ${numericCount}`)
        
        if (numericCount <= 0) return
        
        // Normalize class name to match CLASS_STATS keys
        // Try exact match first, then case-insensitive, then with underscores replaced
        let normalizedClassName = className
        let stats = CLASS_STATS[normalizedClassName]
        
        if (!stats) {
          // Try case-insensitive match
          const classKey = Object.keys(CLASS_STATS).find(
            key => key.toLowerCase() === normalizedClassName.toLowerCase()
          )
          if (classKey) {
            stats = CLASS_STATS[classKey]
            normalizedClassName = classKey
          } else {
            // Try replacing spaces with underscores and vice versa
            const withUnderscores = normalizedClassName.replace(/\s+/g, '_')
            const withSpaces = normalizedClassName.replace(/_+/g, ' ')
            
            if (CLASS_STATS[withUnderscores]) {
              stats = CLASS_STATS[withUnderscores]
              normalizedClassName = withUnderscores
            } else if (CLASS_STATS[withSpaces]) {
              stats = CLASS_STATS[withSpaces]
              normalizedClassName = withSpaces
            }
          }
        }
        
        if (!stats) {
          console.log(`No stats found for ${className} after normalization attempts, using default stats`)
          // Use default stats based on whether it seems like a weapon or not
          const lowerClassName = className.toLowerCase()
          const isWeaponLike = lowerClassName.includes('gun') || 
                              lowerClassName.includes('rifle') || 
                              lowerClassName.includes('pistol') || 
                              lowerClassName.includes('knife') || 
                              lowerClassName.includes('bomb') || 
                              lowerClassName.includes('launcher') || 
                              lowerClassName.includes('grenade')
          
          stats = isWeaponLike 
            ? { Damage: 0.8, Range: 0.5, Magazine: 0.5, Recoil: 0.5 }  // Default weapon stats
            : { Damage: 0.3, Range: 0.2, Magazine: 1.0, Recoil: 0.0 }  // Default non-weapon stats
        }
        
        console.log(`Matched ${className} to ${normalizedClassName} in CLASS_STATS`)
        
        const unit = { 
          count: numericCount, 
          D: stats.Damage, 
          R: stats.Range, 
          M: stats.Magazine, 
          Re: stats.Recoil 
        }
        
        console.log(`Unit stats for ${className}:`, unit)
        
        // Check if this is a person/defender using more flexible matching
        if (normalizedClassName.toLowerCase() === 'person' || 
            className.toLowerCase() === 'person' || 
            className.toLowerCase().includes('person')) {
          defenders.push(unit)
        } else {
          invaders.push(unit)
        }
      })
      
      console.log('Final arrays:', { invaders, defenders })
      
      return computeSurvivalProbability(invaders, defenders)
    }

    const probability = calculateSurvivalProbability()
    // Ensure probability is a valid number
    const validProbability = isNaN(probability) ? 0.5 : Math.max(0, Math.min(1, probability))
    const threat = validProbability < 0.3 ? 'High' : validProbability < 0.7 ? 'Medium' : 'Low'
    
    console.log('Final results:', { probability: validProbability, threat })
    
    return { survivalProbability: validProbability, threatLevel: threat }
  }, [counts])

  // Mock API call for demonstration - replace with your real API
  const callModel = async (formData) => {
    try {
      const response = await fetch('/api/detect-image', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Convert hex image to base64 if provided
      let processedImage = null
      if (data.image) {
        const base64Image = hexToBase64(data.image)
        processedImage = `data:image/jpeg;base64,${base64Image}`
      }
      
      return {
        counts: data.counts || {},
        preview: processedImage
      }
    } catch (error) {
      console.error('Error calling model:', error)
      throw error
    }
  }

  const initCamera = async () => {
    try {
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
      })
      setCameraStream(stream)
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (error) {
      setCameraError('Unable to access camera. Please check permissions.')
    }
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // Show original image preview immediately
    const reader = new FileReader()
    reader.onload = (e) => {
      setOriginalImage(e.target.result)
    }
    reader.readAsDataURL(file)
    
    setIsProcessing(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { counts: newCounts, preview: newPreview } = await callModel(formData)
      
      console.log('Received new counts:', newCounts)
      setCounts(newCounts || {})
      setPreview(newPreview)
    } catch (error) {
      console.error('Error processing image:', error)
      setError('Failed to process image. Please check your connection and try again.')
      setCounts({})
      setPreview(null)
    } finally {
      setIsProcessing(false)
    }
  }

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return
    
    setIsProcessing(true)
    setError(null)
    
    try {
      const canvas = canvasRef.current
      const video = videoRef.current
      const ctx = canvas.getContext('2d')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      
      // Show captured frame as original image
      const capturedImageUrl = canvas.toDataURL('image/jpeg', 0.8)
      setOriginalImage(capturedImageUrl)
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8))
      const formData = new FormData()
      formData.append('file', blob, 'frame.jpg')
      
      const { counts: newCounts, preview: newPreview } = await callModel(formData)
      
      console.log('Received new counts from camera:', newCounts)
      setCounts(newCounts || {})
      setPreview(newPreview)
    } catch (error) {
      console.error('Error capturing frame:', error)
      setError('Failed to process camera frame. Please try again.')
      setCounts({})
      setPreview(null)
    } finally {
      setIsProcessing(false)
    }
  }

  useEffect(() => {
    let interval
    if (isLiveDetection && mode === 'camera') {
      interval = setInterval(captureFrame, 3000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isLiveDetection, mode])

  useEffect(() => {
    if (mode === 'camera') {
      initCamera()
    } else {
      stopCamera()
      setIsLiveDetection(false)
    }
    return () => {
      if (mode === 'camera') stopCamera()
    }
  }, [mode])

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white' 
        : 'bg-gradient-to-br from-blue-50 via-white to-gray-50 text-gray-900'
    }`}>
      <button 
        className={`fixed top-6 left-6 z-50 p-3 rounded-xl lg:hidden transition-all duration-200 ${
          isDarkMode 
            ? 'bg-gray-800/90 hover:bg-gray-700/90 border border-gray-600' 
            : 'bg-white/90 hover:bg-gray-50/90 border border-gray-200'
        } shadow-xl backdrop-blur-sm`}
        onClick={toggleSidebar}
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
      
      <div className={`fixed left-0 top-0 h-full w-72 transform transition-all duration-300 z-40 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 ${
        isDarkMode 
          ? 'bg-gray-800/95 border-gray-700/50' 
          : 'bg-white/95 border-gray-200/50'
      } border-r backdrop-blur-sm shadow-2xl`}>
        <div className={`p-8 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-500 rounded-xl">
              <Shield className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                SecureVision
              </h1>
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>AI Security Monitor</p>
            </div>
          </div>
        </div>
        
        <nav className="p-6">
          <ul className="space-y-3">
            <li>
              <button 
                onClick={() => setMode('image')} 
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 ${
                  mode === 'image' 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105' 
                    : isDarkMode 
                      ? 'hover:bg-gray-700/50 hover:transform hover:scale-105' 
                      : 'hover:bg-gray-100/50 hover:transform hover:scale-105'
                } font-medium`}
              >
                <Image size={22} />
                <span>Image Analysis</span>
              </button>
            </li>
            <li>
              <button 
                onClick={() => setMode('camera')} 
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 ${
                  mode === 'camera' 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105' 
                    : isDarkMode 
                      ? 'hover:bg-gray-700/50 hover:transform hover:scale-105' 
                      : 'hover:bg-gray-100/50 hover:transform hover:scale-105'
                } font-medium`}
              >
                <Camera size={22} />
                <span>Live Monitoring</span>
              </button>
            </li>
            <li className={`border-t my-6 ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}></li>
            <li>
              <button className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 font-medium ${
                isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/50'
              }`}>
                <Bell size={22} />
                <span>Alerts</span>
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">3</span>
              </button>
            </li>
            <li>
              <button 
                onClick={toggleDarkMode}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 font-medium ${
                  isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/50'
                }`}
              >
                <Settings size={22} />
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>

      <div className="lg:ml-72 min-h-screen">
        <header className={`p-8 border-b ${
          isDarkMode 
            ? 'border-gray-700/50 bg-gray-800/30' 
            : 'border-gray-200/50 bg-white/30'
        } backdrop-blur-sm`}>
          <div className="ml-16 lg:ml-0">
            <h2 className="text-3xl font-bold mb-2">
              {mode === 'image' ? 'Image Analysis' : 'Live Monitoring'}
            </h2>
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {mode === 'image' 
                ? 'Upload and analyze security images for threat detection' 
                : 'Real-time camera monitoring with AI-powered detection'
              }
            </p>
          </div>
        </header>

        <main className="p-8">
          <div className={`rounded-2xl shadow-2xl ${
            isDarkMode ? 'bg-gray-800/50' : 'bg-white/70'
          } backdrop-blur-sm border ${
            isDarkMode ? 'border-gray-700/50' : 'border-gray-200/50'
          } overflow-hidden`}>
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">
                  {mode === 'image' ? 'Upload Security Image' : 'Security Camera Feed'}
                </h3>
                <div className="flex rounded-xl overflow-hidden border-2 border-gray-300">
                  <button 
                    onClick={() => setMode('image')}
                    className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 font-medium ${
                      mode === 'image' 
                        ? 'bg-blue-500 text-white shadow-lg' 
                        : isDarkMode 
                          ? 'bg-gray-700 hover:bg-gray-600' 
                          : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <Image size={18} />
                    <span>Image</span>
                  </button>
                  <button 
                    onClick={() => setMode('camera')}
                    className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 font-medium ${
                      mode === 'camera' 
                        ? 'bg-blue-500 text-white shadow-lg' 
                        : isDarkMode 
                          ? 'bg-gray-700 hover:bg-gray-600' 
                          : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <Camera size={18} />
                    <span>Camera</span>
                  </button>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 flex items-center gap-3">
                  <AlertTriangle size={20} />
                  <span>{error}</span>
                </div>
              )}

              <div className={`border-2 border-dashed rounded-2xl p-12 mb-8 transition-all duration-300 ${
                isDarkMode 
                  ? 'border-gray-600 bg-gray-700/30 hover:bg-gray-700/50' 
                  : 'border-gray-300 bg-gray-50/50 hover:bg-gray-50/80'
              }`}>
                {mode === 'image' ? (
                  <div className="text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      ref={fileInputRef}
                      className="hidden"
                    />
                    <Upload className={`mx-auto mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} size={64} />
                    <div className="space-y-4">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-4 rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                        disabled={isProcessing}
                      >
                        {isProcessing ? 'Processing...' : 'Choose Image File'}
                      </button>
                    </div>
                    <p className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                      Upload an image to analyze for security threats
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    {cameraError ? (
                      <div className="text-red-500 mb-6">
                        <AlertTriangle className="mx-auto mb-4" size={48} />
                        <p>{cameraError}</p>
                        <button
                          onClick={initCamera}
                          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl transition-colors"
                        >
                          Retry Camera Access
                        </button>
                      </div>
                    ) : (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full max-w-2xl mx-auto rounded-xl shadow-lg border border-gray-300"
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="flex gap-4 justify-center mt-6 flex-wrap">
                          <button
                            onClick={captureFrame}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Processing...' : 'Capture Frame'}
                          </button>
                          <button
                            onClick={() => setIsLiveDetection(!isLiveDetection)}
                            className={`px-6 py-3 rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 ${
                              isLiveDetection
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                          >
                            {isLiveDetection ? (
                              <>
                                <Square size={16} className="inline mr-2" />
                                Stop Live Detection
                              </>
                            ) : (
                              <>
                                <Play size={16} className="inline mr-2" />
                                Start Live Detection
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {(originalImage || preview) && (
                <div className="mb-8">
                  <h4 className="text-lg font-semibold mb-4">Image Analysis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {originalImage && (
                      <div>
                        <h5 className={`text-md font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Original Image</h5>
                        <img 
                          src={originalImage} 
                          alt="Original" 
                          className="w-full h-auto rounded-xl shadow-lg border border-gray-300 max-h-80 object-contain"
                        />
                      </div>
                    )}
                    {preview && (
                      <div>
                        <h5 className={`text-md font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Processed Result</h5>
                        <img 
                          src={preview} 
                          alt="Processed" 
                          className="w-full h-auto rounded-xl shadow-lg border border-gray-300 max-h-80 object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={`rounded-xl p-8 ${
                isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100/50'
              } backdrop-blur-sm border ${
                isDarkMode ? 'border-gray-600/50' : 'border-gray-200/50'
              }`}>
                <h4 className="text-xl font-bold mb-6">Detection Results</h4>
                {isProcessing ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 mx-auto mb-6"></div>
                    <p className="text-lg">Analyzing image...</p>
                  </div>
                ) : Object.keys(counts).length > 0 ? (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                      {Object.entries(counts).map(([className, count]) => (
                        <div key={className} className={`p-6 rounded-xl ${
                          isDarkMode ? 'bg-gray-600/50' : 'bg-white/70'
                        } text-center shadow-lg border ${
                          isDarkMode ? 'border-gray-500/50' : 'border-gray-200/50'
                        } backdrop-blur-sm transition-transform hover:scale-105`}>
                          <div className="text-3xl font-bold text-blue-500 mb-2">{count}</div>
                          <div className="text-sm font-medium capitalize">{className.replace('_', ' ')}</div>
                        </div>
                      ))}
                    </div>
                    
                    <div className={`p-6 rounded-xl mb-6 ${
                      threatLevel === 'High' 
                        ? 'bg-red-500/20 border-red-500/50' 
                        : threatLevel === 'Medium'
                          ? 'bg-yellow-500/20 border-yellow-500/50'
                          : 'bg-green-500/20 border-green-500/50'
                    } border-2`}>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold">Threat Level</span>
                        <span className={`text-xl font-bold ${
                          threatLevel === 'High' 
                            ? 'text-red-500' 
                            : threatLevel === 'Medium'
                              ? 'text-yellow-500'
                              : 'text-green-500'
                        }`}>
                          {threatLevel}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-semibold">Survival Probability</span>
                        <span className="text-xl font-bold">
                          {(isNaN(survivalProbability) ? 50 : Math.max(0, Math.min(100, survivalProbability * 100))).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-6 overflow-hidden shadow-inner">
                        <div 
                          className="h-full transition-all duration-1000 ease-out shadow-lg"
                          style={{
                            width: `${Math.max(0, Math.min(100, survivalProbability * 100))}%`,
                            background: `linear-gradient(90deg, #ef4444 0%, #f59e0b 40%, #84cc16 70%, #10b981 100%)`
                          }}
                        ></div>
                      </div>
                      <div className={`flex justify-between text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                        <span>Danger</span>
                        <span>Neutral</span>
                        <span>Safe</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className={`mb-4 flex justify-center ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                      {mode === 'image' ? <Image size={48} /> : <Camera size={48} />}
                    </div>
                    <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                      {mode === 'image' 
                        ? 'Upload an image to see detection results' 
                        : 'Start camera feed to see detection results'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={toggleSidebar}
        ></div>
      )}
    </div>
  )
}