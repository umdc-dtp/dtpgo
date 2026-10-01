// Server-side only imports - these modules are not available in the browser
import QRCode from 'qrcode';
import sharp from 'sharp';
import path from 'path';

// Import and re-export types from client-safe module
import type { SessionQRData, StudentQRData } from './client-safe';
export type { SessionQRData, StudentQRData };

export interface SessionQROptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  includeEventInfo?: boolean;
  includeOrganizerInfo?: boolean;
  branding?: boolean;
}

export interface StudentQROptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  includeStudentInfo?: boolean;
  branding?: boolean;
}

/**
 * Generate a session-specific QR code for attendance scanning
 */
export async function generateSessionQRCode(
  sessionData: SessionQRData,
  options: SessionQROptions = {}
): Promise<string> {
  try {
    const defaultOptions = {
      width: 300,
      margin: 4,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      includeEventInfo: true,
      includeOrganizerInfo: false,
      branding: true,
      ...options,
    };

    // Create QR code data structure
    const qrData = {
      type: 'session_attendance',
      sessionId: sessionData.sessionId,
      eventId: sessionData.eventId,
      timestamp: sessionData.timestamp,
      // Include additional data for validation
      eventName: sessionData.eventName,
      sessionName: sessionData.sessionName,
      startTime: sessionData.startTime,
      endTime: sessionData.endTime,
      location: sessionData.location,
      organizerId: sessionData.organizerId,
    };

    const qrText = JSON.stringify(qrData);
    return await QRCode.toDataURL(qrText, {
      width: defaultOptions.width,
      margin: defaultOptions.margin,
      color: defaultOptions.color,
      errorCorrectionLevel: 'M', // Medium error correction for better scanning
    });
  } catch (error) {
    console.error('Error generating session QR code:', error);
    throw new Error('Failed to generate session QR code.');
  }
}

/**
 * Generate a student QR code for attendance
 */
export async function generateStudentQRCode(
  studentData: StudentQRData,
  options: StudentQROptions = {}
): Promise<string> {
  try {
    const defaultOptions = {
      width: 300,
      margin: 4,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      includeStudentInfo: true,
      branding: true,
      ...options,
    };

    // The server resolves student details from this ID. A short payload is easier to scan.
    const qrText = studentData.studentIdNumber;
    return await QRCode.toDataURL(qrText, {
      width: defaultOptions.width,
      margin: defaultOptions.margin,
      color: defaultOptions.color,
      errorCorrectionLevel: 'M',
    });
  } catch (error) {
    console.error('Error generating student QR code:', error);
    throw new Error('Failed to generate student QR code.');
  }
}

/**
 * Create a branded session QR code with event information
 */
export async function createBrandedSessionQRCode(
  sessionData: SessionQRData,
  options: SessionQROptions = {}
): Promise<Buffer> {
  try {
    const qrCodeDataUrl = await generateSessionQRCode(sessionData, {
      width: 260,
      margin: 4,
      ...options,
    });
    const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

    // Use DTP logo
    const logoPath = path.join(process.cwd(), 'public/logo/dtp.png');
    const logoBuffer = await sharp(logoPath)
      .resize(60, 60)
      .png()
      .toBuffer();

    // Create branded QR code with session information
    const canvas = sharp({
      create: {
        width: 320,
        height: 420, // Taller to accommodate session info
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    });

    // Session information text (for future use)
    // const sessionInfoText = `
    // ${sessionData.eventName}
    // ${sessionData.sessionName}
    // ${new Date(sessionData.startTime).toLocaleString()}
    // ${sessionData.location ? `📍 ${sessionData.location}` : ''}
    // `.trim();

    return canvas
      .composite([
        { input: logoBuffer, top: 20, left: 130 }, // DTP logo at top center
        { input: qrCodeBuffer, top: 100, left: 40 }, // QR code below logo
      ])
      .png()
      .toBuffer();
  } catch (error) {
    console.error('Error creating branded session QR code:', error);
    throw new Error('Failed to create branded session QR code.');
  }
}

/**
 * Create a branded student QR code
 */
export async function createBrandedStudentQRCode(
  studentData: StudentQRData,
  options: StudentQROptions = {}
): Promise<Buffer> {
  try {
    const qrCodeDataUrl = await generateStudentQRCode(studentData, {
      width: 240,
      margin: 2,
      ...options,
    });
    const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

    // Use DTP logo
    const logoPath = path.join(process.cwd(), 'public/logo/dtp.png');
    const logoBuffer = await sharp(logoPath)
      .resize(80, 80)
      .png()
      .toBuffer();

    // Create branded QR code
    const canvas = sharp({
      create: {
        width: 320,
        height: 380,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    });

    return canvas
      .composite([
        { input: logoBuffer, top: 20, left: 120 }, // DTP logo at top center
        { input: qrCodeBuffer, top: 110, left: 30 }, // QR code below logo
      ])
      .png()
      .toBuffer();
  } catch (error) {
    console.error('Error creating branded student QR code:', error);
    throw new Error('Failed to create branded student QR code.');
  }
}

// Validation functions moved to client-safe.ts for browser compatibility
