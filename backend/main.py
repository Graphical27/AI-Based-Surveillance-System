import os
import tempfile
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import StreamingResponse, JSONResponse
import cv2
import numpy as np
from ultralytics import YOLO
from pushbullet import Pushbullet

# Initialize FastAPI
app = FastAPI()

# Load model
model = YOLO("model_weights/best.pt", task="detect")
thresh = 0.5

# Initialize Pushbullet with your API key
PUSHBULLET_API_KEY = "o.zpZQdcX1zsLLbaU6IkuqWPH2yH36cke6"
pb = Pushbullet(PUSHBULLET_API_KEY)

# Helper function to send notification
def send_notification(counts: dict):
    # Only notify when detections include classes beyond 'person'
    other_classes = {label: cnt for label, cnt in counts.items() if label != 'person'}
    if other_classes:
        message = f"Detections: {other_classes}"
        # Send Pushbullet push
        pb.push_note("Alert: Object Detection", message)


def annotate_frame(frame):
    res = model(frame, verbose=False)[0].boxes
    counts = {}
    for det in res:
        x1, y1, x2, y2 = det.xyxy.cpu().numpy().astype(int).squeeze()
        c = int(det.cls.item())
        conf = det.conf.item()
        if conf > thresh:
            label = model.names[c]
            counts[label] = counts.get(label, 0) + 1
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(
                frame,
                f"{label}:{int(conf*100)}%",
                (x1, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 255),
                1
            )
    return frame, counts

@app.post("/detect-image")
async def detect_image(file: UploadFile = File(...)):
    data = await file.read()
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    frame, counts = annotate_frame(img)

    # Send notification if needed
    send_notification(counts)

    _, buf = cv2.imencode('.jpg', frame)
    return JSONResponse({
        "counts": counts,
        "image": buf.tobytes().hex()
    })

@app.post("/detect-video")
async def detect_video(file: UploadFile = File(...)):
    # save upload to temp file
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1])
    tmp.write(await file.read())
    tmp.close()
    cap = cv2.VideoCapture(tmp.name)

    fourcc = cv2.VideoWriter_fourcc(*'MJPG')
    out_path = tmp.name + '_out.avi'
    fps = cap.get(cv2.CAP_PROP_FPS)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    out = cv2.VideoWriter(out_path, fourcc, fps, (w, h))

    total_counts = {}
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        annotated, counts = annotate_frame(frame)
        for k, v in counts.items():
            total_counts[k] = total_counts.get(k, 0) + v
        out.write(annotated)
    
    cap.release()
    out.release()

    # Send notification if needed at end of video
    send_notification(total_counts)

    def iterfile():
        with open(out_path, 'rb') as f:
            yield from f
        os.unlink(out_path)

    return StreamingResponse(
        iterfile(),
        media_type='video/avi',
        headers={"X-Counts": str(total_counts)}
    )

@app.get("/detect-stream")
async def detect_stream():
    # placeholder for websocket or MJPEG stream
    return {"detail": "Use WebSocket or MJPEG endpoint for live camera"}
