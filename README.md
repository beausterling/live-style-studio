# Decart Realtime Video Restyling

A real-time video restyling application that transforms your webcam feed using the Decart Realtime Video API with the Mirage V2 model.

## Features

- **Real-time Video Transformation**: Stream your webcam feed and see AI-powered style transformations instantly
- **Dynamic Style Control**: Change styles on-the-fly with custom prompts or quick presets
- **Low Latency**: Optimized for minimal delay between input and transformed output
- **Camera Controls**: Mirror/unmirror your camera feed with a single click
- **Live Preview**: See both your original feed and the transformed output side-by-side
- **Connection Monitoring**: Real-time status updates and error handling

## Prerequisites

- Node.js (v18 or higher)
- A Decart API key (get one at [platform.decart.ai](https://platform.decart.ai))
- A modern web browser with webcam access

## Setup

1. **Clone the repository**
   ```bash
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   VITE_DECART_API_KEY=your_decart_api_key_here
   ```

   **Important**: Never commit your API key to version control. The `.env` file is already in `.gitignore`.

4. **Run the development server**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:8080`

## Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist` directory.

## Usage

1. **Start the Application**: Click the "Start" button to begin streaming
2. **Grant Camera Access**: Allow the browser to access your webcam and microphone
3. **Set a Style**: Enter a custom prompt or click a preset style button
4. **Watch the Magic**: See your video transform in real-time
5. **Experiment**: Change prompts anytime while streaming to see different effects
6. **Stop Streaming**: Click "Stop" when finished

## Style Prompt Examples

- "Cyberpunk city, neon lights, futuristic"
- "Studio Ghibli animation style, beautiful watercolor"
- "Classical oil painting, renaissance art style"
- "Pencil sketch, hand-drawn, artistic"
- "Japanese anime style, vibrant colors"

## Technical Details

- **Model**: Mirage V2 (mirage_v2)
- **Resolution**: 1280x704 (16:9 aspect ratio)
- **Frame Rate**: 25 FPS
- **Technology**: WebRTC for low-latency streaming
- **SDK**: [@decartai/sdk](https://www.npmjs.com/package/@decartai/sdk)

## Troubleshooting

### Camera Access Issues
- Ensure your browser has permission to access the camera
- Check if another application is using the camera
- Try refreshing the page

### Connection Errors
- Verify your API key is correct and active
- Check your internet connection
- Ensure the Decart API service is operational

### Performance Issues
- Close other applications using the camera
- Check your internet bandwidth
- Try reducing other browser tabs/windows

## Resources

- [Decart API Documentation](https://docs.platform.decart.ai/models/realtime/video-restyling)
- [Mirage V2 Model Reference](https://platform.decart.ai/models/mirage-lsd)
- [Decart Platform](https://platform.decart.ai)

## License

This project is built with Lovable and uses the Decart API.

## Support

For issues related to:
- **This application**: Open an issue in this repository
- **Decart API**: Contact Decart support
- **Lovable**: Visit [lovable.dev](https://lovable.dev)
