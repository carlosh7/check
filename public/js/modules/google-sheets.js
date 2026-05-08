export default {
    async checkConfig() {
        return await App.fetchAPI('/google/');
    },

    async getAccounts(groupId) {
        return await App.fetchAPI('/google/groups/' + groupId + '/accounts');
    },

    async connectAccount(groupId, label) {
        var res = await App.fetchAPI('/google/auth?group_id=' + groupId + '&label=' + encodeURIComponent(label));
        if (res && res.url) {
            window.open(res.url, 'google-oauth', 'width=600,height=700');
        }
        return res;
    },

    async deleteAccount(groupId, accountId) {
        return await App.fetchAPI('/google/groups/' + groupId + '/accounts/' + accountId, { method: 'DELETE' });
    },

    async updateAccountLabel(groupId, accountId, label) {
        return await App.fetchAPI('/google/groups/' + groupId + '/accounts/' + accountId, { method: 'PUT', body: JSON.stringify({ label: label }) });
    },

    async exportToSheets(eventId) {
        return await App.fetchAPI('/google/events/' + eventId + '/export', { method: 'POST' });
    },

    async importFromSheets(eventId, spreadsheetId) {
        return await App.fetchAPI('/google/events/' + eventId + '/import', { method: 'POST', body: JSON.stringify({ spreadsheet_id: spreadsheetId }) });
    },

    async updateSyncConfig(eventId, config) {
        return await App.fetchAPI('/google/events/' + eventId + '/sync-config', { method: 'PUT', body: JSON.stringify(config) });
    }
};
