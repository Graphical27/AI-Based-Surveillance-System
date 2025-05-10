import React, { useState } from 'react';
import { Shield, Camera, Image, Bell, Settings, Menu, X } from 'lucide-react';
import ImageUpload from './components/ImageUpload';
import CameraStream from './components/CameraStream';
import './SecurityUI.css'; // We'll create this CSS file below

export default function App() {
  const [mode, setMode] = useState('image');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setDarkMode] = useState(false);
  
  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);
  const toggleDarkMode = () => setDarkMode(!isDarkMode);
  
  return (
    <div className={`app-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      {/* Mobile menu button */}
      <button 
        className="mobile-menu-button"
        onClick={toggleSidebar}
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
      
      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <Shield className="sidebar-logo" size={24} />
          <h1 className="sidebar-title">SecureVision</h1>
        </div>
        
        <nav className="sidebar-nav">
          <ul className="nav-list">
            <li>
              <button 
                onClick={() => setMode('image')} 
                className={`nav-button ${mode === 'image' ? 'active' : ''}`}
              >
                <Image size={20} />
                <span>Image Analysis</span>
              </button>
            </li>
            <li>
              <button 
                onClick={() => setMode('camera')} 
                className={`nav-button ${mode === 'camera' ? 'active' : ''}`}
              >
                <Camera size={20} />
                <span>Live Monitoring</span>
              </button>
            </li>
            <li className="nav-separator"></li>
            <li>
              <button className="nav-button">
                <Bell size={20} />
                <span>Alerts</span>
              </button>
            </li>
            <li>
              <button 
                onClick={toggleDarkMode}
                className="nav-button"
              >
                <Settings size={20} />
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
      
      {/* Main content */}
      <div className="main-content">
        <header className="header">
          <h2 className="header-title">
            {mode === 'image' ? 'Object Detection - Image Analysis' : 'Object Detection - Live Monitoring'}
          </h2>
        </header>
        
        <main className="content-area">
          <div className="content-panel">
            <div className="detection-section">
              <div className="detection-header">
                <h3 className="section-title">
                  {mode === 'image' ? 'Upload Security Image' : 'Security Camera Feed'}
                </h3>
                <div className="mode-toggle">
                  <button 
                    onClick={() => setMode('image')}
                    className={`mode-button ${mode === 'image' ? 'active' : ''}`}
                  >
                    <Image size={16} />
                    <span>Image</span>
                  </button>
                  <button 
                    onClick={() => setMode('camera')}
                    className={`mode-button ${mode === 'camera' ? 'active' : ''}`}
                  >
                    <Camera size={16} />
                    <span>Camera</span>
                  </button>
                </div>
              </div>
              
              <div className="upload-area">
                {mode === 'image' && <ImageUpload isDarkMode={isDarkMode} />}
                {mode === 'camera' && <CameraStream isDarkMode={isDarkMode} />}
              </div>
              
              <div className="results-panel">
                <h4 className="results-title">Detection Results</h4>
                <p className="results-placeholder">Detection information will appear here</p>
                <div className="loading-indicators">
                  <div className="loading-bar-full"></div>
                  <div className="loading-bar-partial"></div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}