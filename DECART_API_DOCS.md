# Decart API Documentation Links

## Video Restyling with Realtime API
https://docs.platform.decart.ai/models/realtime/video-restyling?_gl=1*1usi9ua*_ga*MTgyNTc1NTg5OC4xNzYzMjg5MDE0*_ga_BTTSFTP2EN*czE3NjM2ODg0MzckbzckZzEkdDE3NjM2ODg0NDAkajYwJGwwJGgw

## Quick Reference

### Model Information
- Model: Mirage V2
- Type: Realtime video restyling
- Resolution: 1280x704
- Frame Rate: 25 FPS

### SDK
- Package: `@decartai/sdk`
- Usage: `createDecartClient({ apiKey })`
- Realtime connection: `client.realtime.connect(stream, { model, onRemoteStream })`

### Key Features
- Real-time video transformation
- Style prompts for different effects
- WebRTC-based streaming
- Low-latency processing

### API Key Management
- Stored as Supabase secret: `DECART_API_KEY`
- Retrieved via edge function: `decart-proxy`
- Never exposed to client-side code
