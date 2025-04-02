# Web Capture App

A React Native mobile application that allows users to capture screenshots and record web pages. The app uses a Flask backend server to handle the web page capture and recording functionality.

## Features

- Capture screenshots of web pages
- Record web pages for a specified duration
- Download captured screenshots and recordings
- Modern and user-friendly UI
- Support for both HTTP and HTTPS URLs

## Prerequisites

- Python 3.7+
- Node.js 14+
- React Native development environment
- Chrome browser (for web capture)
- FFmpeg (for video conversion)

## Installation

### Backend Setup

1. Create a virtual environment and activate it:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Start the Flask server:
```bash
python server.py
```

### Frontend Setup

1. Install Node.js dependencies:
```bash
npm install
```

2. Start the React Native app:
```bash
npm start
```

3. Run on your device:
```bash
npm run android  # For Android
npm run ios      # For iOS
```

## Configuration

1. Update the `API_URL` in `App.js` to match your server's IP address:
```javascript
const API_URL = "http://YOUR_SERVER_IP:5001";
```

2. Make sure your mobile device and server are on the same network.

## Usage

1. Enter a website URL in the input field
2. For screenshots:
   - Click the "Capture Screenshot" button
   - Wait for the capture to complete
   - Use the download button to save the screenshot

3. For recordings:
   - Enter the desired duration in seconds
   - Click the "Start Recording" button
   - Wait for the recording to complete
   - Use the download button to save the recording

## Project Structure

```
web-capture/
├── App.js                 # React Native frontend
├── server.py             # Flask backend
├── recording_state.py    # Recording state management
├── requirements.txt      # Python dependencies
├── package.json         # Node.js dependencies
└── recordings/          # Directory for saved recordings
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 