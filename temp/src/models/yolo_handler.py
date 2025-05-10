from ultralytics import YOLO
import cv2
import numpy as np

class YOLOHandler:
    def __init__(self, model_path='yolov8n.pt'):
        print("Loading YOLO model...")
        self.model = YOLO(model_path)
        self.class_names = self.model.names
        print("Model loaded successfully!")
        
        self.colors = {
            0: (0, 255, 0),    # Person
            2: (255, 0, 0),    # Car
            15: (0, 0, 255),   # Cat
            16: (255, 255, 0)  # Dog
        }
    
    def detect_objects(self, frame, confidence_threshold=0.5):
        results = self.model(frame)
        counts = {'person': 0, 'car': 0, 'cat': 0, 'dog': 0}
        detections = []
        
        for result in results:
            boxes = result.boxes
            
            for box in boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                
                if conf < confidence_threshold:
                    continue
                    
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                
                class_name = self.class_names[cls_id]
                color = self.colors.get(cls_id, (120, 120, 120))
                
                if cls_id == 0:  # Person
                    counts['person'] += 1
                elif cls_id == 2:  # Car
                    counts['car'] += 1
                elif cls_id == 15:  # Cat
                    counts['cat'] += 1
                elif cls_id == 16:  # Dog
                    counts['dog'] += 1
                
                detections.append({
                    'class': class_name,
                    'confidence': conf,
                    'bbox': (x1, y1, x2, y2),
                    'color': color
                })
        
        return counts, detections 