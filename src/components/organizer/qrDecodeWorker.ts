import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';

prepareZXingModule({
  overrides: { locateFile: (path: string) => path.endsWith('.wasm') ? '/vendor/zxing_reader.wasm' : path },
});

self.onmessage = async (event: MessageEvent<{ frame: ImageData }>) => {
  try {
    const results = await readBarcodes(event.data.frame, {
      formats: ['QRCode'],
      maxNumberOfSymbols: 20,
      tryHarder: true,
      tryRotate: true,
      tryInvert: true,
      // Keep full resolution for small, distant codes.
      tryDownscale: false,
    });
    self.postMessage({ values: results.map(result => result.text).filter(Boolean) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'QR decoder failed' });
  }
};

export {};
