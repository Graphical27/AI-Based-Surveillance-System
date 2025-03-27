import cv2
import time
import os
from models.yolo_handler import YOLOHandler
from visualization.visualizer import Visualizer

def main():
    # Initialize components
    yolo_handler = YOLOHandler()
    visualizer = Visualizer()
    
    # Setup camera
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    
    if not cap.isOpened():
        print("Error: Could not open camera.")
        return
    
    # Create window
    cv2.namedWindow('Advanced Person Counter', cv2.WINDOW_NORMAL)
    
    # Initialize FPS calculation
    start_time = time.time()
    frame_count = 0
    fps = 0
    
    print("Starting video capture. Press 'q' to quit, 'r' to record, 's' for screenshot.")
    
    while True:
        ret, frame = cap.read()
        
        if not ret:
            print("Error: Failed to capture image")
            break
        
        # Calculate FPS
        frame_count += 1
        elapsed_time = time.time() - start_time
        if elapsed_time >= 1.0:
            fps = frame_count / elapsed_time
            frame_count = 0
            start_time = time.time()
        
        # Detect objects
        counts, detections = yolo_handler.detect_objects(frame)
        
        # Update visualization
        display_frame = visualizer.draw_detections(frame, detections)
        display_frame = visualizer.draw_overlay(display_frame, counts, fps)
        display_frame = visualizer.draw_history_graph(display_frame)
        
        # Update person count history
        visualizer.update_history(counts['person'])
        
        # Handle recording
        if visualizer.recording:
            visualizer.output_video.write(frame)
        
        # Show frame
        cv2.imshow('Advanced Person Counter', display_frame)
        
        # Handle keyboard input
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('r'):
            visualizer.toggle_recording(frame)
        elif key == ord('s'):
            visualizer.save_screenshot(frame)
    
    # Cleanup
    visualizer.release()
    cap.release()
    cv2.destroyAllWindows()
    print("Application closed successfully")

if __name__ == "__main__":
    main() 