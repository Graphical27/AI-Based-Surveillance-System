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
PUSHBULLET_API_KEY = "API_HERE"
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
    try:
        # Ensure frame is not None and has valid dimensions
        if frame is None or frame.size == 0:
            print("Warning: Empty frame detected in annotate_frame")
            return frame, {}
            
        # Make a copy of the frame to avoid modifying the original
        annotated_frame = frame.copy()
        
        # Run the model on the frame
        res = model(frame, verbose=False)[0].boxes
        counts = {}
        
        for det in res:
            try:
                # Extract bounding box coordinates
                xyxy = det.xyxy.cpu().numpy()
                
                # Handle different shapes of xyxy
                if xyxy.ndim > 1:
                    x1, y1, x2, y2 = xyxy.squeeze().astype(int)
                else:
                    x1, y1, x2, y2 = xyxy.astype(int)
                
                # Get class and confidence
                c = int(det.cls.item())
                conf = det.conf.item()
                
                if conf > thresh:
                    label = model.names[c]
                    counts[label] = counts.get(label, 0) + 1
                    
                    # Draw bounding box
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    
                    # Add label with confidence
                    cv2.putText(
                        annotated_frame,
                        f"{label}:{int(conf*100)}%",
                        (x1, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        (0, 255, 255),
                        1
                    )
            except Exception as e:
                print(f"Error processing detection: {e}")
                continue
                
        print(f"Annotated frame with {len(counts)} object types: {counts}")
        return annotated_frame, counts
        
    except Exception as e:
        print(f"Error in annotate_frame: {e}")
        return frame, {}

@app.post("/detect-image")
async def detect_image(file: UploadFile = File(...)):
    try:
        # Read the uploaded file
        data = await file.read()
        if not data:
            print("Warning: Empty file uploaded")
            return JSONResponse({
                "counts": {},
                "image": None,
                "error": "Empty file uploaded"
            })
            
        # Convert to numpy array
        arr = np.frombuffer(data, np.uint8)
        
        # Decode the image
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            print("Warning: Could not decode image")
            return JSONResponse({
                "counts": {},
                "image": None,
                "error": "Could not decode image"
            })
            
        # Process the image
        print(f"Processing image with shape: {img.shape}")
        frame, counts = annotate_frame(img)

        # Send notification if needed
        send_notification(counts)

        # Ensure frame is not None and has valid dimensions
        if frame is None or frame.size == 0:
            print("Warning: Empty frame detected")
            return JSONResponse({
                "counts": counts,
                "image": None
            })
        
        # Encode the image with quality 90 (0-100, higher is better)
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 90]
        _, buf = cv2.imencode('.jpg', frame, encode_params)
        
        # Convert to hex string
        hex_image = buf.tobytes().hex()
        
        print(f"Sending response with counts: {counts}")
        print(f"Image data length: {len(hex_image)} bytes")
        
        return JSONResponse({
            "counts": counts,
            "image": hex_image
        })
    except Exception as e:
        print(f"Error in detect_image: {e}")
        return JSONResponse({
            "counts": {},
            "image": None,
            "error": str(e)
        })

@app.post("/detect-video")
async def detect_video(file: UploadFile = File(...)):
    try:
        # Read the uploaded file
        data = await file.read()
        if not data:
            print("Warning: Empty video file uploaded")
            return JSONResponse({
                "error": "Empty video file uploaded"
            })
        
        # Save upload to temp file
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1])
        tmp.write(data)
        tmp.close()
        
        # Open video file
        cap = cv2.VideoCapture(tmp.name)
        if not cap.isOpened():
            print(f"Warning: Could not open video file {tmp.name}")
            os.unlink(tmp.name)
            return JSONResponse({
                "error": "Could not open video file"
            })

        # Set up video writer
        fourcc = cv2.VideoWriter_fourcc(*'MJPG')
        out_path = tmp.name + '_out.avi'
        fps = cap.get(cv2.CAP_PROP_FPS)
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        # Validate video dimensions
        if w <= 0 or h <= 0:
            print(f"Warning: Invalid video dimensions: {w}x{h}")
            cap.release()
            os.unlink(tmp.name)
            return JSONResponse({
                "error": "Invalid video dimensions"
            })
            
        out = cv2.VideoWriter(out_path, fourcc, fps, (w, h))
        if not out.isOpened():
            print(f"Warning: Could not create output video file {out_path}")
            cap.release()
            os.unlink(tmp.name)
            return JSONResponse({
                "error": "Could not create output video file"
            })

        total_counts = {}
        frames_processed = 0
        
        # Process video frames
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            try:
                annotated, counts = annotate_frame(frame)
                for k, v in counts.items():
                    total_counts[k] = total_counts.get(k, 0) + v
                out.write(annotated)
                frames_processed += 1
            except Exception as e:
                print(f"Error processing frame: {e}")
                continue
        
        cap.release()
        out.release()
        
        print(f"Processed {frames_processed} frames with {len(total_counts)} object types: {total_counts}")

        # Send notification if needed at end of video
        send_notification(total_counts)

        # Check if any frames were processed
        if frames_processed == 0:
            print("Warning: No frames were processed in the video")
            os.unlink(tmp.name)
            if os.path.exists(out_path):
                os.unlink(out_path)
            return JSONResponse({
                "error": "No frames could be processed in the video"
            })

        # Return the processed video
        def iterfile():
            try:
                with open(out_path, 'rb') as f:
                    yield from f
            finally:
                # Clean up temp files
                if os.path.exists(tmp.name):
                    os.unlink(tmp.name)
                if os.path.exists(out_path):
                    os.unlink(out_path)

        return StreamingResponse(
            iterfile(),
            media_type='video/avi',
            headers={"X-Counts": str(total_counts)}
        )
        
    except Exception as e:
        print(f"Error in detect_video: {e}")
        # Clean up any temp files
        if 'tmp' in locals() and os.path.exists(tmp.name):
            os.unlink(tmp.name)
        if 'out_path' in locals() and os.path.exists(out_path):
            os.unlink(out_path)
        return JSONResponse({
            "error": str(e)
        })

@app.get("/detect-stream")
async def detect_stream():
    # placeholder for websocket or MJPEG stream
    return {"detail": "Use WebSocket or MJPEG endpoint for live camera"}
