# AI-Based Surveillance System 🔐🧠

<img align="right" src="https://img.shields.io/github/stars/Graphical27/AI-Surveillance-System?style=flat-square">
<img align="right" src="https://img.shields.io/github/forks/Graphical27/AI-Surveillance-System?style=flat-square">
<img align="right" src="https://img.shields.io/github/watchers/Graphical27/AI-Surveillance-System?style=flat-square">

<br>

[![forthebadge](https://forthebadge.com/images/badges/made-with-python.svg)](https://forthebadge.com)  
[![forthebadge](https://forthebadge.com/images/badges/built-with-love.svg)](https://forthebadge.com)

---

## 🔎 Overview

This project is an **AI-Based Surveillance System** featuring a **React (Vite + Tailwind CSS)** frontend and a machine-learning-powered backend (not included here). It enables **real-time security threat detection** through image uploads or live camera feeds using an advanced **object detection model**.

---

## ⚙️ Key Features

### 🖼️ Image Analysis
- Upload images to detect potential threats using ML.
  
### 🎥 Live Monitoring
- Use your webcam for **real-time threat detection**.

### 📊 Detection Results
- View detected objects with:
  - Object class names & counts
  - **Threat level** calculation
  - **Survival probability** estimation

### 🌓 Dark/Light Mode
- Fully responsive design with **dark mode** enabled by default.

### 📁 Sidebar Navigation
- Easy access to detection modules, results, and settings.

---

## 🧠 Backend (ML-Powered Detection) — *Not Included Here*

The backend exposes a REST API (`/api/detect-image`) and includes:

- 🔍 **Object Detection Model**: Detects weapons, people, and other threat-relevant objects.
- 🧾 **Structured JSON Response**:
  ```json
  {
    "counts": {
      "Assault Rifle": 2,
      "Person": 3
    },
    "image": "<hex_encoded_image>"
  }

## Demo Screenshots 📸

### 🏠 Main Page
![Main Page](https://i.ibb.co/bRYTj0Vy/Screenshot-2025-06-23-204942.png)

### 📊 Result Page
![Result Page](https://i.ibb.co/1t8bGWTn/Screenshot-2025-06-23-205020.png)
