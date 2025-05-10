import os
import sys
import argparse
import glob
import time
import math
import cv2
import numpy as np
from ultralytics import YOLO

parser = argparse.ArgumentParser()
parser.add_argument('--model', required=True)
parser.add_argument('--source', default='0', help='Image source: file, folder, video, or camera index (default: 0)')
parser.add_argument('--thresh', default=0.5, type=float)
parser.add_argument('--resolution', default=None)
parser.add_argument('--record', action='store_true')
args = parser.parse_args()

model = YOLO(args.model, task='detect')
labels = model.names
src = args.source

img_ext = ['.jpg', '.jpeg', '.png', '.bmp']
vid_ext = ['.avi', '.mov', '.mp4', '.mkv', '.wmv']
if os.path.isdir(src):
    source_type = 'folder'
elif os.path.isfile(src):
    ext = os.path.splitext(src)[1]
    source_type = 'image' if ext.lower() in img_ext else 'video'
elif src.isdigit():
    source_type = 'usb'
    usb_idx = int(src)
else:
    print(f'Invalid source: {src}')
    sys.exit(0)

if args.resolution:
    w, h = map(int, args.resolution.split('x'))
    resize = True
else:
    resize = False

if source_type in ['video', 'usb']:
    cap = cv2.VideoCapture(usb_idx if source_type == 'usb' else src)
    if resize:
        cap.set(3, w)
        cap.set(4, h)
elif source_type == 'image':
    imgs = [src]
    idx = 0
else:
    imgs = [f for f in glob.glob(src + '/*') if os.path.splitext(f)[1].lower() in img_ext]
    idx = 0

fourcc = cv2.VideoWriter_fourcc(*'MJPG')
if args.record and resize and source_type in ['video', 'usb']:
    out = cv2.VideoWriter('demo1.avi', fourcc, 30, (w, h))

colors = [
    (164, 120, 87), (68, 148, 228), (93, 97, 209), (178, 182, 133),
    (88, 159, 106), (96, 202, 231), (159, 124, 168), (169, 162, 241),
    (98, 118, 150), (172, 176, 184)
]
fps_buf = []
avg_fps = 0.0

# Track counts per class over each interval
class_counts = {}
last_print_time = time.time()

while True:
    t0 = time.perf_counter()
    if source_type in ['video', 'usb']:
        ret, frame = cap.read()
        if not ret:
            break
    else:
        if idx >= len(imgs):
            break
        frame = cv2.imread(imgs[idx])
        idx += 1

    if resize:
        frame = cv2.resize(frame, (w, h))

    res = model(frame, verbose=False)[0].boxes
    count = 0
    for det in res:
        x1, y1, x2, y2 = det.xyxy.cpu().numpy().astype(int).squeeze()
        c = int(det.cls.item())
        conf = det.conf.item()
        if conf > args.thresh:
            label = labels[c]
            # increment class count
            class_counts[label] = class_counts.get(label, 0) + 1
            cv2.rectangle(frame, (x1, y1), (x2, y2), colors[c % len(colors)], 2)
            txt = f'{label}:{int(conf * 100)}%'
            cv2.putText(frame, txt, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
            count += 1

    # Every 10 seconds for camera, print formatted counts
    if source_type == 'usb' and time.time() - last_print_time >= 10:
        if class_counts:
            formatted = ','.join(f"{max(1,int(cnt/72))} * {cls}" for cls, cnt in class_counts.items())
            print(formatted)
        else:
            print('No detections in last 10 seconds')
        class_counts.clear()
        last_print_time = time.time()

    if source_type in ['video', 'usb']:
        fps_buf.append(1 / (time.perf_counter() - t0))
        if len(fps_buf) > 200:
            fps_buf.pop(0)
        avg_fps = sum(fps_buf) / len(fps_buf)
        cv2.putText(frame, f'FPS:{avg_fps:.1f}', (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

    cv2.putText(frame, f'Count:{count}', (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    cv2.imshow('YOLO', frame)

    if args.record and source_type in ['video', 'usb']:
        out.write(frame)

    k = cv2.waitKey(5) & 0xFF
    if k in [ord('q'), 27]:
        break

if source_type in ['video', 'usb']:
    cap.release()
    if args.record and resize:
        out.release()
cv2.destroyAllWindows()