let authToken = localStorage.getItem('SUPER_ADMIN_TOKEN') || '';

const $ = (id) => document.getElementById(id);

const api = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
};

const renderStatus = (message) => {
    $('auth-status').textContent = message;
};

const loadLicenses = async () => {
    try {
        const items = await api('/api/licenses');
        $('licenses').innerHTML = items.length
            ? `<pre>${JSON.stringify(items, null, 2)}</pre>`
            : '<p class="muted">No licenses issued yet.</p>';
    } catch (err) {
        $('licenses').innerHTML = `<p class="muted">${err.message}</p>`;
    }
};

$('login-btn').addEventListener('click', async () => {
    try {
        const data = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ password: $('admin-password').value })
        });
        authToken = data.token;
        localStorage.setItem('SUPER_ADMIN_TOKEN', authToken);
        renderStatus('Logged in.');
        await loadLicenses();
    } catch (err) {
        renderStatus(err.message);
    }
});

$('issue-license').addEventListener('click', async () => {
    try {
        const features = $('features').value.trim();
        const payload = {
            companyName: $('company-name').value,
            workspaceCode: $('workspace-code').value || 'default',
            deviceId: $('device-id').value,
            features: features ? JSON.parse(features) : []
        };
        const data = await api('/api/licenses/issue', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        $('license-output').innerHTML = `<pre>${JSON.stringify(data.license, null, 2)}</pre>`;
        await loadLicenses();
    } catch (err) {
        $('license-output').innerHTML = `<p class="muted">${err.message}</p>`;
    }
});

$('issue-reset').addEventListener('click', async () => {
    try {
        const data = await api('/api/licenses/reset-code', {
            method: 'POST',
            body: JSON.stringify({ deviceId: $('reset-device-id').value })
        });
        $('reset-output').innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    } catch (err) {
        $('reset-output').innerHTML = `<p class="muted">${err.message}</p>`;
    }
});

$('refresh').addEventListener('click', loadLicenses);

loadLicenses();
