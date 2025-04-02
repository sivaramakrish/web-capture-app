from flask import Flask, request, jsonify
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
import io
from PIL import Image
import base64
import os
import cv2
import numpy as np
import time
from datetime import datetime
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import threading
import subprocess
import re
from recording_state import get_state, set_state, is_recording, clear_state

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Directory to save recordings
RECORDINGS_DIR = 'recordings'
if not os.path.exists(RECORDINGS_DIR):
    os.makedirs(RECORDINGS_DIR)

driver = None
output_file = None


def is_valid_url(url):
    """Ensure the URL is properly formatted."""
    if not url:
        return False
    url = url.strip()
    if not re.match(r'^(http|https)://', url):
        url = 'https://' + url  # Ensure the protocol is added
    return url


def setup_driver():
    """Initialize Selenium WebDriver with Chrome options."""
    options = Options()
    options.add_argument('--headless')  # Use standard headless mode for compatibility
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--start-maximized')
    options.add_argument('--window-size=1366,768')  # Set a fixed window size
    options.add_argument('--disable-extensions')
    options.add_argument('--disable-infobars')
    options.add_argument('--disable-notifications')
    options.add_argument('--disable-popup-blocking')
    options.add_argument('--disable-save-password-bubble')
    options.add_argument('--disable-translate')
    options.add_argument('--ignore-certificate-errors')
    options.add_argument('--ignore-ssl-errors')
    options.add_experimental_option('excludeSwitches', ['enable-automation'])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument('--disable-web-security')
    options.add_argument('--disable-features=IsolateOrigins,site-per-process')

    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.set_page_load_timeout(60)  # Increased timeout
        return driver
    except Exception as e:
        print(f"Error setting up ChromeDriver: {str(e)}")
        raise


@app.route('/capture', methods=['POST'])
def capture_screenshot():
    """Capture a screenshot of the given URL."""
    driver = None
    try:
        data = request.get_json()
        url = is_valid_url(data.get('url', ''))

        if not url:
            return jsonify({'error': 'Invalid URL format'}), 400

        driver = setup_driver()
        driver.get(url)

        # Wait for the page to load
        WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(2)  # Additional wait for dynamic content

        screenshot = driver.get_screenshot_as_png()
        image = Image.open(io.BytesIO(screenshot))
        img_io = io.BytesIO()
        image.convert('RGB').save(img_io, 'JPEG', quality=80)
        img_io.seek(0)
        base64_image = base64.b64encode(img_io.getvalue()).decode('utf-8')

        return jsonify({'base64': base64_image})

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if driver:
            driver.quit()


@app.route('/start-recording', methods=['POST'])
def start_recording():
    """Start screen recording for a specified duration."""
    global driver, output_file

    try:
        # Always clean up any existing recording first
        if driver:
            driver.quit()
            driver = None
        output_file = None
        clear_state()
        time.sleep(1)  # Wait for cleanup

        data = request.get_json()
        url = is_valid_url(data.get('url', ''))
        duration = int(data.get('duration', 5))  # Changed default to 5 seconds

        if not url:
            return jsonify({'error': 'Invalid URL'}), 400

        print(f"Starting new recording for URL: {url}, duration: {duration}")
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = os.path.join(RECORDINGS_DIR, f'recording_{timestamp}.mp4')
        
        # Ensure the recordings directory exists
        os.makedirs(RECORDINGS_DIR, exist_ok=True)
        
        # Ensure the output file path is valid
        if not output_file or not isinstance(output_file, str):
            raise ValueError("Invalid output file path")

        driver = setup_driver()
        driver.get(url)

        WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.TAG_NAME, "body")))

        set_state(True)
        threading.Thread(target=record_screen, args=(duration,)).start()

        return jsonify({'success': True})

    except Exception as e:
        print(f"Error in start_recording: {str(e)}")
        # Clean up on error
        if driver:
            driver.quit()
            driver = None
        output_file = None
        clear_state()
        return jsonify({'error': str(e)}), 500


@app.route('/stop-recording', methods=['POST'])
def stop_recording():
    """Stop screen recording and return the recorded file as base64."""
    global driver, output_file

    try:
        print("Stopping recording...")
        set_state(False)
        time.sleep(1)

        if driver:
            driver.quit()
            driver = None

        if output_file and os.path.exists(output_file):
            print(f"Recording file found: {output_file}")
            try:
                with open(output_file, 'rb') as video_file:
                    video_base64 = base64.b64encode(video_file.read()).decode('utf-8')
                
                # Get the filename for the response
                filename = os.path.basename(output_file)
                
                # Clean up after successful stop
                temp_output_file = output_file
                output_file = None
                
                return jsonify({
                    'success': True, 
                    'base64': video_base64, 
                    'filename': filename
                })
            except Exception as e:
                print(f"Error reading recording file: {str(e)}")
                return jsonify({'error': 'Failed to read recording file'}), 500
        else:
            print(f"Recording file not found at path: {output_file}")
            # Clean up even if file doesn't exist
            output_file = None
            return jsonify({'success': True, 'message': 'No recording file found'})

    except Exception as e:
        print(f"Error in stop_recording: {str(e)}")
        # Clean up on error
        output_file = None
        return jsonify({'error': str(e)}), 500


def record_screen(duration):
    """Record the screen for the given duration."""
    global driver, output_file

    try:
        if not output_file or not isinstance(output_file, str):
            raise ValueError("Invalid output file path")

        print(f"Starting screen recording for {duration} seconds")
        temp_avi = output_file.replace('.mp4', '.avi')
        fourcc = cv2.VideoWriter_fourcc(*'XVID')
        out = cv2.VideoWriter(temp_avi, fourcc, 20.0, (1366, 768))

        if not out.isOpened():
            raise ValueError("Failed to create video writer")

        start_time = time.time()

        while is_recording() and (time.time() - start_time) < duration:
            try:
                screenshot = driver.get_screenshot_as_png()
                image = Image.open(io.BytesIO(screenshot))
                frame = cv2.cvtColor(np.array(image.resize((1366, 768))), cv2.COLOR_RGB2BGR)
                out.write(frame)
                time.sleep(0.05)
            except Exception as e:
                print(f"Error capturing frame: {str(e)}")
                break

        print("Recording completed or stopped")
        set_state(False)
        out.release()

        # Convert to MP4
        print("Converting to MP4...")
        ffmpeg_cmd = [
            'ffmpeg', '-y',
            '-i', temp_avi,
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            output_file
        ]
        subprocess.run(ffmpeg_cmd, capture_output=True)

        if os.path.exists(temp_avi):
            os.remove(temp_avi)
        print("Conversion completed")

    except Exception as e:
        print(f"Recording error: {str(e)}")
        set_state(False)
    finally:
        print("Cleaning up resources...")
        # Clean up resources
        if driver:
            driver.quit()
            driver = None
        output_file = None
        print("Cleanup completed")


@app.route('/recordings-info', methods=['GET'])
def get_recordings_info():
    """Retrieve information about recorded files."""
    try:
        recordings = [{'filename': f, 'path': os.path.abspath(os.path.join(RECORDINGS_DIR, f))}
                      for f in os.listdir(RECORDINGS_DIR) if os.path.isfile(os.path.join(RECORDINGS_DIR, f))]
        return jsonify({'recordings': recordings})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/recording-status', methods=['GET'])
def get_recording_status():
    """Check if a recording is currently in progress."""
    return jsonify({'isRecording': is_recording()})


def cleanup_old_recordings():
    current_time = time.time()
    for filename in os.listdir(RECORDINGS_DIR):
        filepath = os.path.join(RECORDINGS_DIR, filename)
        if os.path.getmtime(filepath) < current_time - 86400:  # 24 மணி நேரத்திற்கு மேல்
            os.remove(filepath)


if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5001)
