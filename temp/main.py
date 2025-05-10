import cv2
import numpy as np
import time
import os
from datetime import datetime
from ultralytics import YOLO
import matplotlib.pyplot as plt
from collections import deque

print("Loading YOLO model...")
model = YOLO('yolov8n.pt')
print("Model loaded successfully!")

person_count_history = deque(maxlen=100)
start_time = time.time()
frame_count = 0
fps = 0
recording = False
output_video = None
screenshot_dir = "screenshots"
os.makedirs(screenshot_dir, exist_ok=True)

class_names = model.names

cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

if not cap.isOpened():
    print("Error: Could not open camera.")
    exit()

cv2.namedWindow('Advanced Person Counter', cv2.WINDOW_NORMAL)

colors = {
    0: (0, 255, 0),
    2: (255, 0, 0),
    15: (0, 0, 255),
    16: (255, 255, 0)
}

print("Starting video capture. Press 'q' to quit, 'r' to record, 's' for screenshot.")

while True:
    ret, frame = cap.read()
    
    if not ret:
        print("Error: Failed to capture image")
        break
    
    frame_count += 1
    elapsed_time = time.time() - start_time
    if elapsed_time >= 1.0:
        fps = frame_count / elapsed_time
        frame_count = 0
        start_time = time.time()
    
    display_frame = frame.copy()
    
    results = model(frame)
    
    person_count = 0
    car_count = 0
    cat_count = 0
    dog_count = 0
    
    for result in results:
        boxes = result.boxes
        
        for box in boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            
            if conf < 0.5:
                continue
                
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            
            class_name = class_names[cls_id]
            
            color = colors.get(cls_id, (120, 120, 120))
            
            if cls_id == 0:
                person_count += 1
                cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(display_frame, f"Person {person_count}: {conf:.2f}", 
                            (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            elif cls_id == 2:
                car_count += 1
                cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(display_frame, f"Car: {conf:.2f}", 
                            (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            elif cls_id == 15:
                cat_count += 1
                cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(display_frame, f"Cat: {conf:.2f}", 
                            (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            elif cls_id == 16:
                dog_count += 1
                cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(display_frame, f"Dog: {conf:.2f}", 
                            (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    
    person_count_history.append(person_count)
    
    overlay = display_frame.copy()
    cv2.rectangle(overlay, (10, 10), (400, 150), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.7, display_frame, 0.3, 0, display_frame)
    
    cv2.putText(display_frame, f'Person Count: {person_count}', (20, 40), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
    cv2.putText(display_frame, f'Car Count: {car_count}', (20, 70), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)
    cv2.putText(display_frame, f'Cat Count: {cat_count}', (20, 100), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
    cv2.putText(display_frame, f'Dog Count: {dog_count}', (20, 130), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
    
    cv2.putText(display_frame, f'FPS: {fps:.1f}', (display_frame.shape[1] - 150, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    
    if recording:
        cv2.circle(display_frame, (display_frame.shape[1] - 30, 30), 10, (0, 0, 255), -1)
        output_video.write(frame)
    
    if len(person_count_history) > 1:
        graph_height = 100
        graph_width = 200
        graph_x = display_frame.shape[1] - graph_width - 20
        graph_y = display_frame.shape[0] - graph_height - 20
        
        cv2.rectangle(display_frame, (graph_x, graph_y), 
                     (graph_x + graph_width, graph_y + graph_height), (0, 0, 0), -1)
        
        cv2.putText(display_frame, "Person Count History", (graph_x, graph_y - 10),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        max_count = max(person_count_history) if person_count_history else 1
        max_count = max(max_count, 1)
        
        for i in range(1, len(person_count_history)):
            pt1_x = graph_x + (i-1) * graph_width // len(person_count_history)
            pt1_y = graph_y + graph_height - int(person_count_history[i-1] * graph_height / max_count)
            pt2_x = graph_x + i * graph_width // len(person_count_history)
            pt2_y = graph_y + graph_height - int(person_count_history[i] * graph_height / max_count)
            cv2.line(display_frame, (pt1_x, pt1_y), (pt2_x, pt2_y), (0, 255, 0), 2)
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(display_frame, timestamp, (20, display_frame.shape[0] - 20),
               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    
    cv2.imshow('Advanced Person Counter', display_frame)
    
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('r'):
        recording = not recording
        if recording:
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
            output_filename = f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.avi"
            output_video = cv2.VideoWriter(output_filename, fourcc, 20.0, 
                                          (frame.shape[1], frame.shape[0]))
            print(f"Started recording to {output_filename}")
        else:
            if output_video is not None:
                output_video.release()
                print("Recording stopped")
    elif key == ord('s'):
        screenshot_filename = os.path.join(screenshot_dir, 
                                          f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg")
        cv2.imwrite(screenshot_filename, frame)
        print(f"Screenshot saved to {screenshot_filename}")

if recording and output_video is not None:
    output_video.release()
cap.release()
cv2.destroyAllWindows()
print("Application closed successfully")
