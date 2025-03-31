from flask import Flask, request, jsonify
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
import io
from PIL import Image
import base64
import re
import time
import os
import cv2
import numpy as np
from datetime import datetime
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import threading
import subprocess  # To convert .avi to .mp4 using ffmpeg

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Create recordings directory if it doesn't exist
RECORDINGS_DIR = 'recordings'
if not os.path.exists(RECORDINGS_DIR):
    os.makedirs(RECORDINGS_DIR)

recording = False
driver = None
output_file = None

# ✅ Validate URL function
def is_valid_url(url):
    regex = re.compile(
        r'^(https?:\/\/)?'
        r'(([a-zA-Z0-9_-]+)\.)+[a-zA-Z]{2,6}'
        r'(\/.*)?$'
    )
    return re.match(regex, url) is not None

# ✅ Setup Selenium WebDriver
def setup_driver():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--start-maximized')
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

# ✅ Get Full Page Dimensions
def get_page_dimensions(driver):
    total_width = driver.execute_script("return document.body.scrollWidth;")
    total_height = driver.execute_script("return document.body.scrollHeight;")
    viewport_width = driver.execute_script("return window.innerWidth;")
    viewport_height = driver.execute_script("return window.innerHeight;")
    width = max(total_width, viewport_width)
    height = max(total_height, viewport_height)
    
    # Ensure even dimensions (OpenCV requires this)
    width = width if width % 2 == 0 else width - 1
    height = height if height % 2 == 0 else height - 1
    
    return width, height

# ✅ Capture Screenshot API
@app.route('/capture', methods=['POST'])
def capture_screenshot():
    try:
        data = request.get_json()
        url = data.get('url', '')

        if not is_valid_url(url):
            return jsonify({'error': 'Invalid URL'}), 400

        driver = setup_driver()
        driver.get(url)

        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )

        # ✅ Ensure window is maximized to capture full content
        driver.maximize_window()
        time.sleep(2)  # Allow some time for resizing to take effect

        # ✅ Take a full-page screenshot
        screenshot = driver.get_screenshot_as_png()
        driver.quit()

        image = Image.open(io.BytesIO(screenshot))
        img_io = io.BytesIO()
        image.convert('RGB').save(img_io, 'JPEG', quality=80)
        img_io.seek(0)
        base64_image = base64.b64encode(img_io.getvalue()).decode('utf-8')

        return jsonify({'base64': base64_image})

    except Exception as e:
        print(f"Screenshot error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ✅ Start Recording API
@app.route('/start-recording', methods=['POST'])
def start_recording():
    global recording, driver, output_file
    
    try:
        data = request.get_json()
        url = data.get('url', '')
        duration = int(data.get('duration', 30))  # Ensure duration is an integer

        if not is_valid_url(url):
            return jsonify({'error': 'Invalid URL'}), 400

        if not url.startswith(('http://', 'https://')):
            url = 'http://' + url

        # Setup recording
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = os.path.join(RECORDINGS_DIR, f'recording_{timestamp}.mp4')
        
        driver = setup_driver()
        driver.get(url)

        # Wait for page to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )

        # Get page dimensions and set window size
        width, height = get_page_dimensions(driver)
        driver.set_window_size(width, height)

        # Start recording
        recording = True
        
        # Start recording in a separate thread
        recording_thread = threading.Thread(target=record_screen, args=(duration, width, height))
        recording_thread.start()

        return jsonify({'success': True})

    except Exception as e:
        print(f"Start recording error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ✅ Stop Recording API
@app.route('/stop-recording', methods=['POST'])
def stop_recording():
    global recording, driver, output_file
    
    try:
        recording = False
        if driver:
            driver.quit()
            driver = None

        if output_file and os.path.exists(output_file):
            absolute_path = os.path.abspath(output_file)
            file_size = os.path.getsize(output_file)
            
            with open(output_file, 'rb') as video_file:
                video_base64 = base64.b64encode(video_file.read()).decode('utf-8')
            
            return jsonify({
                'success': True,
                'base64': video_base64,
                'fileInfo': {
                    'path': absolute_path,
                    'size': file_size,
                    'filename': os.path.basename(output_file)
                }
            })
        else:
            return jsonify({'error': 'Recording file not found'}), 404

    except Exception as e:
        print(f"Stop recording error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ✅ Screen Recording Function
def record_screen(duration, width, height):
    global recording, driver, output_file
    
    try:
        # Setup video writer with actual page dimensions
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_file, fourcc, 20.0, (width, height))
        
        start_time = time.time()
        print(f"Starting recording for {duration} seconds...")
        
        while recording and (time.time() - start_time) < duration:
            # Capture screenshot
            screenshot = driver.get_screenshot_as_png()
            image = Image.open(io.BytesIO(screenshot))
            
            # Convert to OpenCV format
            opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Write frame
            out.write(opencv_image)
            
            # Small delay to control frame rate
            time.sleep(0.05)
            
            # Print progress
            elapsed = time.time() - start_time
            if elapsed % 5 == 0:  # Print every 5 seconds
                print(f"Recording progress: {elapsed:.1f}/{duration} seconds")
        
        print("Recording completed!")
        # Release resources
        out.release()
        
    except Exception as e:
        print(f"Recording error: {str(e)}")
    finally:
        recording = False

# ✅ Get Recordings Info
@app.route('/recordings-info', methods=['GET'])
def get_recordings_info():
    try:
        recordings = [
            {'filename': f, 'path': os.path.abspath(os.path.join(RECORDINGS_DIR, f))}
            for f in os.listdir(RECORDINGS_DIR) if os.path.isfile(os.path.join(RECORDINGS_DIR, f))
        ]
        return jsonify({'recordings': recordings})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5001)
