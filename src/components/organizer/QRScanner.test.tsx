import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QRScanner } from './QRScanner';

jest.mock('qr-scanner', () => ({
  __esModule: true,
  default: { scanImage: jest.fn().mockRejectedValue(new Error('No QR code found')) },
}));

test('keeps the camera open when multi-code decoding cannot start', async () => {
  const stopTrack = jest.fn();
  const track = {
    label: 'Integrated Webcam',
    stop: stopTrack,
    getSettings: () => ({ width: 1280, height: 720, deviceId: 'camera-1' }),
    getCapabilities: () => ({}),
  };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: jest.fn().mockResolvedValue([{ kind: 'videoinput', deviceId: 'camera-1', label: 'Integrated Webcam' }]),
      getUserMedia: jest.fn().mockResolvedValue(stream),
    },
  });
  const originalPlay = HTMLVideoElement.prototype.play;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLVideoElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  const originalWorker = global.Worker;
  global.Worker = jest.fn(() => { throw new Error('Worker unavailable'); }) as unknown as typeof Worker;

  try {
    const view = render(<QRScanner onCapture={() => true} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start camera' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop camera' })).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Scanning one QR code at a time');
    expect(stopTrack).not.toHaveBeenCalled();
    view.unmount();
    expect(stopTrack).toHaveBeenCalled();
  } finally {
    HTMLVideoElement.prototype.play = originalPlay;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    global.Worker = originalWorker;
  }
});
