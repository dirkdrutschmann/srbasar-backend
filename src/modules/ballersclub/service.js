const axios = require('axios');
const { loadConfig } = require('./config');
const { parseWorkbook } = require('./parser');
const repository = require('./repository');

const DEFAULT_REFRESH_MS = 5 * 60 * 1000;

class BallersClubService {
  constructor({ config = loadConfig, store = repository, fetch = axios.get, parse = parseWorkbook } = {}) {
    this.config = config;
    this.store = store;
    this.fetch = fetch;
    this.parse = parse;
    this.timer = null;
    this.pending = null;
  }

  async publicState(now = new Date()) {
    let config;
    try { config = this.config(); } catch { return { enabled: false, available: false, status: 'configuration-error' }; }
    if (!config.enabled) return { enabled: false, available: false, status: 'disabled' };
    try {
      const sync = await this.store.getSync(config.sourceKey);
      const fetchedAt = sync?.fetchedAt ? new Date(sync.fetchedAt) : null;
      const age = fetchedAt ? now - fetchedAt : Infinity;
      const available = Number.isFinite(age) && age >= 0 && age <= config.maxAgeMs;
      return { enabled: true, available, status: !available ? 'unavailable' : sync.lastError ? 'stale' : 'fresh', updatedAt: fetchedAt?.toISOString() || null, contact: config.contact };
    } catch { return { enabled: true, available: false, status: 'unavailable', contact: config.contact }; }
  }

  async refresh() {
    if (this.pending) return this.pending;
    this.pending = this.importSnapshot().finally(() => { this.pending = null; });
    return this.pending;
  }

  async importSnapshot() {
    const config = this.config();
    if (!config.enabled) return;
    try {
      const response = await this.fetch(config.sheet.exportUrl, { responseType: 'arraybuffer', timeout: 20000, maxContentLength: 5 * 1024 * 1024, maxRedirects: 3, headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
      const now = new Date();
      const events = await this.parse(Buffer.from(response.data), { ...config, now });
      await this.store.replaceSnapshot(events, config.sourceKey, now);
      console.log(`Ballers Club: ${events.filter(event => event.freeSpots > 0).length} offene Turniere importiert.`);
    } catch (error) {
      const code = /^sheet_[a-z_]+$/.test(error.message) ? error.message : 'import_failed';
      await this.store.recordFailure(config.sourceKey, code);
      console.warn(`Ballers Club: ${code}; letzter erfolgreicher Stand bleibt erhalten.`);
    }
  }

  start() {
    if (this.timer) return;
    let config;
    try {
      config = this.config();
    } catch {
      console.warn('Ballers Club: ungültige Konfiguration; nächster Importversuch folgt.');
    }
    if (config && !config.enabled) return;
    const run = () => this.refresh().catch(() => console.warn('Ballers Club: Import derzeit nicht verfügbar.'));
    run();
    this.timer = setInterval(run, config?.refreshMs || DEFAULT_REFRESH_MS);
    this.timer.unref();
  }

  async stop() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.pending) await this.pending.catch(() => {});
  }
}

module.exports = { BallersClubService, ballersClubService: new BallersClubService() };
