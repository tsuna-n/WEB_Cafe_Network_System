const CONFIG_KEY = 'pos_cafe_config';

export type PrinterConnectionType = 'usb' | 'network';

export interface AppConfig {
  serverUrl: string;
  printerConnection: PrinterConnectionType;
  printerProtocol: 'escpos' | 'tspl2';

  // ─── USB Config ───────────────────────────────
  printerUsbPath: string;

  // ─── Network Config ──────────────────────────
  printerIp: string;
  printerPort: number;
}

const DEFAULT_CONFIG: AppConfig = {
  serverUrl: 'http://localhost:3003',
  printerConnection: 'usb',
  printerProtocol: 'tspl2',

  // USB defaults
  printerUsbPath: '/dev/usb/lp0',

  // Network defaults
  printerIp: '',
  printerPort: 9100,
};

// ─── Validate Config ─────────────────────────────

function sanitizeConfig(config: Partial<AppConfig>): Partial<AppConfig> {
  const safe: Partial<AppConfig> = {};

  if (typeof config.serverUrl === 'string') {
    safe.serverUrl = config.serverUrl;
  }

  if (config.printerConnection === 'usb' || config.printerConnection === 'network') {
    safe.printerConnection = config.printerConnection;
  }

  if (config.printerProtocol === 'escpos' || config.printerProtocol === 'tspl2') {
    safe.printerProtocol = config.printerProtocol;
  }

  if (typeof config.printerUsbPath === 'string') {
    safe.printerUsbPath = config.printerUsbPath;
  }

  if (typeof config.printerIp === 'string') {
    safe.printerIp = config.printerIp;
  }

  if (typeof config.printerPort === 'number') {
    safe.printerPort = config.printerPort;
  }

  return safe;
}

// ─── Get Config ─────────────────────────────

export function getConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);

    if (!stored) {
      return { ...DEFAULT_CONFIG };
    }

    const parsed = JSON.parse(stored);

    return {
      ...DEFAULT_CONFIG,
      ...sanitizeConfig(parsed),
    };

  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

// ─── Save Config ─────────────────────────────

export function setConfig(config: Partial<AppConfig>): void {
  const current = getConfig();

  const updated = {
    ...current,
    ...sanitizeConfig(config),
  };

  localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
}

// ─── Helpers ─────────────────────────────

export function getServerUrl(): string {
  return getConfig().serverUrl.replace(/\/+$/, '');
}


export function getPrinterInterface(): string {
  const cfg = getConfig();

  if (cfg.printerConnection === 'usb') {
    return cfg.printerUsbPath || '/dev/usb/lp0';
  }

  // network
  return `tcp://${cfg.printerIp}:${cfg.printerPort}`;
}