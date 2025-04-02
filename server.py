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
    """Stop screen recording (if running) and return the recorded file as base64."""
    global driver, output_file, last_completed_file # Ensure access to globals

    file_to_return = None
    filename_to_return = None
    was_recording = is_recording() # Check state *before* potentially changing it

    try:
        print("Stop/Fetch request received...")
        if was_recording:
            print("Recording is active, setting state to False.")
            set_state(False)
            # Give the recording thread a moment to react and finish file operations
            time.sleep(2) # Adjust if needed
        else:
            print("Recording state is already False.")

        # Attempt to quit the driver if it exists (might have been quit by record_screen)
        if driver:
            print("Attempting to quit WebDriver instance...")
            try:
                driver.quit()
                print("WebDriver quit successfully.")
            except Exception as quit_err:
                print(f"Minor error quitting driver (might already be closed): {quit_err}")
            driver = None # Ensure driver reference is cleared

        # --- Find the file to return ---
        # Priority 1: Check the 'output_file' global (if record_screen hasn't cleared it)
        if output_file and os.path.exists(output_file):
            file_to_return = output_file
            print(f"Found recording file via 'output_file' global: {file_to_return}")
        # Priority 2: Check the 'last_completed_file' global (set by record_screen on success)
        elif last_completed_file and os.path.exists(last_completed_file):
            file_to_return = last_completed_file
            print(f"Found recording file via 'last_completed_file' global: {file_to_return}")
        else:
            print(f"No recording file found. Checked 'output_file' ('{output_file}') and 'last_completed_file' ('{last_completed_file}').")

        # --- Process the found file (if any) ---
        if file_to_return:
            try:
                print(f"Reading file: {file_to_return}")
                with open(file_to_return, 'rb') as video_file:
                    video_base64 = base64.b64encode(video_file.read()).decode('utf-8')

                filename_to_return = os.path.basename(file_to_return)
                print(f"Successfully read and encoded file. Filename: {filename_to_return}")

                # Clean up AFTER successful retrieval
                temp_file_path = file_to_return # Store path before clearing globals
                output_file = None
                last_completed_file = None
                # Optional: Delete the file from server storage after sending
                # try:
                #     os.remove(temp_file_path)
                #     print(f"Deleted server file: {temp_file_path}")
                # except OSError as e:
                #     print(f"Error deleting server file {temp_file_path}: {e}")

                return jsonify({
                    'success': True,
                    'base64': video_base64,
                    'filename': filename_to_return
                })
            except Exception as e:
                print(f"Error reading or encoding recording file '{file_to_return}': {str(e)}")
                # Clear potentially stale references on error
                output_file = None
                last_completed_file = None
                return jsonify({'error': f'Failed to read recording file: {str(e)}'}), 500
        else:
            # No file found, but the process might have stopped successfully or was already stopped.
            # Ensure state is consistent
            output_file = None
            last_completed_file = None
            clear_state() # Make sure state is definitely False
            return jsonify({'success': True, 'message': 'Recording stopped or was not active. No recording file found.'})

    except Exception as e:
        print(f"Unexpected error in stop_recording: {str(e)}")
        # General cleanup on unexpected error
        output_file = None
        last_completed_file = None
        if driver:
             try: driver.quit()
             except: pass
             driver = None
        clear_state()
        return jsonify({'error': str(e)}), 500

def record_screen(duration):
    """Record the screen for the given duration."""
    global driver, output_file, last_completed_file # Access globals

    temp_avi = None # Initialize temporary file path

    try:
        if not driver:
             raise Exception("WebDriver not initialized in record_screen thread.")
        if not output_file or not isinstance(output_file, str):
            raise ValueError("Invalid output file path provided to record_screen.")

        print(f"Record_screen thread started. Recording to {output_file} for {duration} seconds.")
        temp_avi = output_file.replace('.mp4', '.avi')
        # Ensure the directory exists for the temp file as well
        os.makedirs(os.path.dirname(temp_avi), exist_ok=True)

        # Use a standard size known to work with the driver setup
        frame_width, frame_height = 1366, 768
        fourcc = cv2.VideoWriter_fourcc(*'XVID')
        out = cv2.VideoWriter(temp_avi, fourcc, 20.0, (frame_width, frame_height))

        if not out.isOpened():
            raise ValueError(f"Failed to create video writer for {temp_avi}")

        start_time = time.time()
        frame_count = 0

        # Recording loop
        while is_recording() and (time.time() - start_time) < duration:
            try:
                # Ensure driver is still valid before getting screenshot
                if not driver or not driver.window_handles:
                     print("Driver lost or closed unexpectedly during recording loop.")
                     break # Exit loop if driver is gone

                screenshot = driver.get_screenshot_as_png()
                image = Image.open(io.BytesIO(screenshot))
                # Ensure frame matches the VideoWriter's dimensions
                frame = cv2.cvtColor(np.array(image.resize((frame_width, frame_height))), cv2.COLOR_RGB2BGR)
                out.write(frame)
                frame_count += 1
                # Reduce sleep time slightly for smoother capture, adjust based on performance
                time.sleep(0.04) # ~25fps target if possible, syncs better with 20fps video
            except Exception as e:
                # Handle screenshot/write errors (e.g., browser crash)
                print(f"Error capturing/writing frame {frame_count}: {str(e)}")
                # Decide if you want to break the loop on frame error
                break # Break loop on error

        print(f"Recording loop finished. Captured {frame_count} frames. Reason: {'Duration met' if not is_recording() else 'Stopped externally'}. State is now: {is_recording()}")

        # Ensure state is set to False if loop ended naturally by duration
        if is_recording():
             print("Setting recording state to False as duration ended.")
             set_state(False)

        out.release() # Release the AVI file writer
        print(f"AVI file writer released ({temp_avi}).")

        # --- Convert AVI to MP4 ---
        if frame_count > 0 and os.path.exists(temp_avi): # Only convert if frames were captured
             print(f"Converting {temp_avi} to {output_file} using ffmpeg...")
             ffmpeg_cmd = [
                 'ffmpeg', '-y', # Overwrite output without asking
                 '-i', temp_avi,
                 '-c:v', 'libx264', # Video codec
                 '-preset', 'medium', # Encoding speed/quality tradeoff
                 '-crf', '23', # Constant Rate Factor (quality, lower is better, 18-28 is common)
                 '-c:a', 'aac', # Audio codec (even if silent, some players prefer an audio track)
                 '-b:a', '128k', # Audio bitrate
                 '-pix_fmt', 'yuv420p', # Pixel format for compatibility
                 output_file
             ]
             try:
                 # Use timeout for ffmpeg conversion
                 result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=60) # 60 second timeout
                 print("FFmpeg stdout:", result.stdout)
                 print("FFmpeg stderr:", result.stderr)
                 result.check_returncode() # Raise error if ffmpeg failed

                 if os.path.exists(output_file):
                      print(f"Conversion successful: {output_file}")
                      # *** Store the successful path ***
                      last_completed_file = output_file
                 else:
                      print(f"Error: MP4 file {output_file} not found after conversion attempt.")
                      last_completed_file = None # Ensure it's None if conversion failed

             except subprocess.TimeoutExpired:
                 print("Error: FFmpeg conversion timed out.")
                 last_completed_file = None
             except subprocess.CalledProcessError as e:
                 print(f"Error: FFmpeg conversion failed with code {e.returncode}.")
                 last_completed_file = None
             except Exception as conv_e:
                 print(f"Error during ffmpeg execution: {conv_e}")
                 last_completed_file = None
        else:
             print("Skipping conversion: No frames captured or temporary AVI file missing.")
             last_completed_file = None # No file was successfully created

    except Exception as e:
        print(f"Error during record_screen execution: {str(e)}")
        set_state(False) # Ensure state is false on any error
        last_completed_file = None # Ensure no file path is stored on error
        # Do not clear output_file here, let stop_recording handle it

    finally:
        print("Record_screen thread entering finally block.")
        # Clean up the temporary AVI file if it exists
        if temp_avi and os.path.exists(temp_avi):
            try:
                os.remove(temp_avi)
                print(f"Deleted temporary AVI file: {temp_avi}")
            except OSError as e:
                print(f"Error deleting temporary AVI file {temp_avi}: {e}")

        # Quit the driver *within the thread* ONLY IF the main stop/fetch request hasn't already done so.
        # This is tricky. A safer approach is to let /stop-recording always handle the final driver quit.
        # So, comment out the driver quit here.
        # if driver:
        #     try:
        #         driver.quit()
        #         print("WebDriver quit successfully from record_screen finally block.")
        #     except Exception as quit_err:
        #         print(f"Minor error quitting driver in record_screen finally block: {quit_err}")
        #     # DON'T set driver = None here, let stop_recording manage the global

        # *** DO NOT set output_file = None here ***
        print("Record_screen thread finished.")


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