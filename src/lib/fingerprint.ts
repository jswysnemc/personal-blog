interface FingerprintComponents {
  userAgent: string;
  language: string;
  colorDepth: number;
  screenResolution: string;
  timezone: string;
  sessionStorage: boolean;
  localStorage: boolean;
  platform: string;
  canvas: string;
  webglVendor: string;
  webglRenderer: string;
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    canvas.width = 200;
    canvas.height = 50;

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Canvas', 4, 17);

    return canvas.toDataURL();
  } catch {
    return '';
  }
}

function getWebGLInfo(): { vendor: string; renderer: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) return { vendor: '', renderer: '' };

    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return { vendor: '', renderer: '' };

    return {
      vendor: (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
      renderer: (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
    };
  } catch {
    return { vendor: '', renderer: '' };
  }
}

function collectComponents(): FingerprintComponents {
  const webgl = getWebGLInfo();

  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    colorDepth: screen.colorDepth,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    sessionStorage: !!window.sessionStorage,
    localStorage: !!window.localStorage,
    platform: navigator.platform,
    canvas: getCanvasFingerprint(),
    webglVendor: webgl.vendor,
    webglRenderer: webgl.renderer,
  };
}

async function generateHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateFingerprint(): Promise<string> {
  const storageKey = 'visitor_fingerprint';

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      return stored;
    }
  } catch {
    // localStorage not available
  }

  const components = collectComponents();
  const fingerprintString = JSON.stringify(components);
  const hash = await generateHash(fingerprintString);

  try {
    localStorage.setItem(storageKey, hash);
  } catch {
    // localStorage not available
  }

  return hash;
}
