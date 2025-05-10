import React, { useState } from 'react'
import axios from 'axios'
export default function VideoUpload() {
  const [videoUrl, setVideoUrl] = useState(null)
  const [counts, setCounts] = useState(null)
  const handle = async e => {
    const file = e.target.files[0]
    const form = new FormData()
    form.append('file', file)
    const res = await axios.post('/api/detect-video', form, { responseType: 'blob' })
    const countsHeader = res.headers['x-counts']
    setCounts(JSON.parse(countsHeader.replace(/'/g,'\"')))
    const url = URL.createObjectURL(res.data)
    setVideoUrl(url)
  }
  return (
    <div>
      <input type="file" accept="video/*" onChange={handle} />
      {videoUrl && <video src={videoUrl} controls className="mt-4 max-w-full" />}
      {counts && <div className="mt-2">{Object.entries(counts).map(([cls,c]) => `${c} * ${cls}`).join(', ')}</div>}
    </div>
  )
}