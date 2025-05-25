import React, { useRef, useState, useEffect } from 'react'
import Webcam from 'react-webcam'
import axios from 'axios'
export default function CameraStream() {
  const webcamRef = useRef(null)
  const [counts, setCounts] = useState({})
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!webcamRef.current) return
      const imageSrc = webcamRef.current.getScreenshot()
      const blob = await (await fetch(imageSrc)).blob()
      const form = new FormData()
      form.append('file', blob, 'frame.jpg')
      const res = await axios.post('/api/detect-image', form, { headers: {'Content-Type':'multipart/form-data'} })
      setCounts(res.data.counts)
    }, 2000)
    return () => clearInterval(interval)
  }, [])
  return (
    <div>
      <Webcam audio={false} screenshotFormat="image/jpeg" ref={webcamRef} />
      <div className="mt-2">{Object.entries(counts).map(([cls,c]) => `${c} * ${cls}`).join(', ')}</div>
    </div>
  )
}