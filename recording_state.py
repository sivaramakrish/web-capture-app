import os
import json
import time

STATE_FILE = 'recording_state.json'

def get_state():
    """Get the current recording state."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except:
            return {'is_recording': False, 'timestamp': 0}
    return {'is_recording': False, 'timestamp': 0}

def set_state(is_recording):
    """Set the current recording state."""
    state = {
        'is_recording': is_recording,
        'timestamp': time.time()
    }
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f)

def is_recording():
    """Check if a recording is in progress."""
    state = get_state()
    return state['is_recording']

def clear_state():
    """Clear the recording state."""
    if os.path.exists(STATE_FILE):
        os.remove(STATE_FILE) 