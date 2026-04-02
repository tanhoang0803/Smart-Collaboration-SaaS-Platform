import * as integrationService from '../services/integration.service.js';
import { success } from '../utils/response.js';
import { webhookReceivedTotal } from '../utils/metrics.js';

export async function list(req, res, next) {
  try {
    const integrations = await integrationService.listIntegrations(req.user.tenantId);
    success(res, integrations);
  } catch (err) {
    next(err);
  }
}

export async function connect(req, res, next) {
  try {
    const { provider } = req.params;
    const result = await integrationService.connectIntegration(
      req.user.tenantId,
      provider,
      req.user.id,
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function callback(req, res, next) {
  try {
    const { provider } = req.params;
    const { code, state } = req.query;

    // Decode state to retrieve tenantId
    let tenantId = req.user?.tenantId;
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        tenantId = decoded.tenantId ?? tenantId;
      } catch { /* use req.user.tenantId */ }
    }

    const result = await integrationService.handleCallback(tenantId, provider, code);
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function disconnect(req, res, next) {
  try {
    const { provider } = req.params;
    const result = await integrationService.disconnectIntegration(req.user.tenantId, provider);
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function sync(req, res, next) {
  try {
    const { provider } = req.params;
    const result = await integrationService.syncIntegration(req.user.tenantId, provider);
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function webhook(req, res, next) {
  try {
    const { provider } = req.params;
    webhookReceivedTotal.inc({ provider });
    const result = await integrationService.handleWebhook(provider, req.body, req.headers);

    // Slack URL verification needs a specific response shape
    if (result?.challenge) {
      return res.json(result);
    }

    success(res, result);
  } catch (err) {
    next(err);
  }
}
