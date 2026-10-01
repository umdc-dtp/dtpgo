import QRCode from 'qrcode';

interface QROptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

export async function generateQRCodeDataURL(text: string, options: QROptions = {}): Promise<string> {
  try {
    const defaultOptions = {
      width: 300,
      margin: 4,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      ...options,
    };

    return await QRCode.toDataURL(text, defaultOptions);
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw new Error('Failed to generate QR code.');
  }
} 
