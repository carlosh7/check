class CheckClient {
    constructor(options = {}) {
        if (!options.apiKey) throw new Error('apiKey es requerida');
        this.apiKey = options.apiKey;
        this.baseUrl = options.baseUrl || 'https://check.app';
        this.timeout = options.timeout || 15000;
    }

    async request(path) {
        const url = this.baseUrl.replace(/\/+$/, '') + path;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        try {
            const res = await fetch(url, {
                headers: { 'x-api-key': this.apiKey, 'Accept': 'application/json' },
                signal: controller.signal
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            return res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    async getEvents() {
        return this.request('/api/v1/events');
    }

    async getEvent(id) {
        return this.request(`/api/v1/events/${encodeURIComponent(id)}`);
    }

    async getEventGuests(eventId) {
        return this.request(`/api/v1/events/${encodeURIComponent(eventId)}/guests`);
    }
}

module.exports = { CheckClient };
