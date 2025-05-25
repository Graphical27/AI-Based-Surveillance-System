import React, { useState } from 'react'
import axios from 'axios'
export default function ImageUpload() {
  const [preview, setPreview] = useState(null)
  const [counts, setCounts] = useState({})
  const handle = async e => {
    const file = e.target.files[0]
    const form = new FormData()
    form.append('file', file)
    const res = await axios.post('/api/detect-image', form, { headers: {'Content-Type':'multipart/form-data'} })
    const imgHex = res.data.image
    setCounts(res.data.counts)
    setPreview(`data:image/jpeg;base64,${Buffer.from(imgHex, 'hex').toString('base64')}`)
  }
  return (
    <div>
      <input type="file" accept="image/*" onChange={handle} />
      {preview && <img src={preview} alt="result" className="mt-4 max-w-full" />}
      {counts && <div className="mt-2">{Object.entries(counts).map(([cls,c]) => `${c} * ${cls}`).join(', ')}</div>}
    </div>
  )
}