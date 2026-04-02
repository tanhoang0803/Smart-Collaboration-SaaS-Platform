import { useEffect, useState } from 'react';
import { integrationsApi } from '../services/api';
import type { Integration } from '../features/integrations/integrationsSlice';

interface ProviderDef {
  key: string;
  name: string;
  icon: string;
  description: string;
}

const PROVIDERS: ProviderDef[] = [
  { key: 'slack',           name: 'Slack',            icon: '💬', description: 'Send task notifications to Slack channels' },
  { key: 'github',          name: 'GitHub',           icon: '🐙', description: 'Ingest PRs and issues as tasks automatically' },
  { key: 'trello',          name: 'Trello',           icon: '📋', description: 'Bi-directional card sync with Trello boards' },
  { key: 'google_calendar', name: 'Google Calendar',  icon: '📅', description: 'Create calendar events from task deadlines' },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    integrationsApi.list()
      .then((res) => setIntegrations((res.data as { data: Integration[] }).data))
      .catch(() => setError('Failed to load integrations'))
      .finally(() => setIsLoading(false));
  }, []);

  function isConnected(provider: string) {
    return integrations.some((i) => i.provider === provider);
  }

  function getIntegration(provider: string) {
    return integrations.find((i) => i.provider === provider);
  }

  async function handleConnect(provider: string) {
    setActionLoading(provider);
    setError(null);
    try {
      const res = await integrationsApi.connect(provider);
      const { redirectUrl } = (res.data as { data: { redirectUrl: string } }).data;
      if (redirectUrl) window.location.href = redirectUrl;
    } catch {
      setError(`Failed to connect ${provider}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDisconnect(provider: string) {
    if (!confirm(`Disconnect ${provider}?`)) return;
    setActionLoading(provider);
    try {
      await integrationsApi.disconnect(provider);
      setIntegrations((prev) => prev.filter((i) => i.provider !== provider));
    } catch {
      setError(`Failed to disconnect ${provider}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSync(provider: string) {
    setActionLoading(`sync-${provider}`);
    try {
      await integrationsApi.sync(provider);
      // Refresh list to update lastSyncedAt
      const res = await integrationsApi.list();
      setIntegrations((res.data as { data: Integration[] }).data);
    } catch {
      setError(`Sync failed for ${provider}`);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Integrations</h1>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}
      {isLoading && <p className="loading">Loading…</p>}

      <div className="integrations-grid">
        {PROVIDERS.map((p) => {
          const connected = isConnected(p.key);
          const integration = getIntegration(p.key);
          const loading = actionLoading === p.key || actionLoading === `sync-${p.key}`;

          return (
            <div className="card integration-card" key={p.key}>
              <div className="integration-card-header">
                <span className="integration-icon">{p.icon}</span>
                <div>
                  <div className="integration-name">{p.name}</div>
                  <div className={`integration-status ${connected ? 'connected' : ''}`}>
                    {connected ? '● Connected' : '○ Not connected'}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>{p.description}</p>
              {connected && integration?.lastSyncedAt && (
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                  Last synced: {new Date(integration.lastSyncedAt).toLocaleString()}
                </p>
              )}
              <div className="integration-actions">
                {connected ? (
                  <>
                    <button className="btn btn-secondary btn-sm" disabled={loading}
                      onClick={() => handleSync(p.key)}>
                      {actionLoading === `sync-${p.key}` ? 'Syncing…' : '↺ Sync'}
                    </button>
                    <button className="btn btn-danger btn-sm" disabled={loading}
                      onClick={() => handleDisconnect(p.key)}>
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary btn-sm" disabled={loading}
                    onClick={() => handleConnect(p.key)}>
                    {loading ? 'Connecting…' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
