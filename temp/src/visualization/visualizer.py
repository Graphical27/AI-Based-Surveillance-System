import cv2
import numpy as np
from datetime import datetime
from collections import deque

class Visualizer:
    def __init__(self, max_history=100):
        self.person_count_history = deque(maxlen=max_history)
        self.screenshot_dir = "screenshots"
        self.recording = False
        self.output_video = None
    
    def draw_detections(self, frame, detections):
        display_frame = frame.copy()
        
        for detection in detections:
            x1, y1, x2, y2 = detection['bbox']
            color = detection['color']
            conf = detection['confidence']
            class_name = detection['class']
            
            cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(display_frame, f"{class_name}: {conf:.2f}", 
                       (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        return display_frame
    
    def draw_overlay(self, frame, counts, fps):
        display_frame = frame.copy()
        
        # Draw semi-transparent overlay for stats
        overlay = display_frame.copy()
        cv2.rectangle(overlay, (10, 10), (400, 150), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.7, display_frame, 0.3, 0, display_frame)
        
        # Draw counts
        cv2.putText(display_frame, f'Person Count: {counts["person"]}', (20, 40), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        cv2.putText(display_frame, f'Car Count: {counts["car"]}', (20, 70), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)
        cv2.putText(display_frame, f'Cat Count: {counts["cat"]}', (20, 100), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        cv2.putText(display_frame, f'Dog Count: {counts["dog"]}', (20, 130), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
        
        # Draw FPS
        cv2.putText(display_frame, f'FPS: {fps:.1f}', 
                   (display_frame.shape[1] - 150, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        
        # Draw recording indicator
        if self.recording:
            cv2.circle(display_frame, (display_frame.shape[1] - 30, 30), 
                      10, (0, 0, 255), -1)
        
        # Draw timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(display_frame, timestamp, 
                   (20, display_frame.shape[0] - 20),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
        
        return display_frame
    
    def draw_history_graph(self, frame):
        if len(self.person_count_history) > 1:
            graph_height = 100
            graph_width = 200
            graph_x = frame.shape[1] - graph_width - 20
            graph_y = frame.shape[0] - graph_height - 20
            
            cv2.rectangle(frame, (graph_x, graph_y), 
                         (graph_x + graph_width, graph_y + graph_height), 
                         (0, 0, 0), -1)
            
            cv2.putText(frame, "Person Count History", 
                       (graph_x, graph_y - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            max_count = max(self.person_count_history) if self.person_count_history else 1
            max_count = max(max_count, 1)
            
            for i in range(1, len(self.person_count_history)):
                pt1_x = graph_x + (i-1) * graph_width // len(self.person_count_history)
                pt1_y = graph_y + graph_height - int(self.person_count_history[i-1] * graph_height / max_count)
                pt2_x = graph_x + i * graph_width // len(self.person_count_history)
                pt2_y = graph_y + graph_height - int(self.person_count_history[i] * graph_height / max_count)
                cv2.line(frame, (pt1_x, pt1_y), (pt2_x, pt2_y), (0, 255, 0), 2)
        
        return frame
    
    def update_history(self, person_count):
        self.person_count_history.append(person_count)
    
    def toggle_recording(self, frame):
        self.recording = not self.recording
        if self.recording:
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
            output_filename = f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.avi"
            self.output_video = cv2.VideoWriter(output_filename, fourcc, 20.0, 
                                              (frame.shape[1], frame.shape[0]))
            print(f"Started recording to {output_filename}")
        else:
            if self.output_video is not None:
                self.output_video.release()
    
    def save_screenshot(self, frame):
        screenshot_filename = f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        cv2.imwrite(screenshot_filename, frame)
        print(f"Screenshot saved to {screenshot_filename}")
    
    def release(self):
        if self.recording and self.output_video is not None:
            self.output_video.release() 