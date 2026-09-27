import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { google } from 'googleapis';

const app = express();
app.use(express.json({ limit: '256kb' }));
const port = process.env.PORT || 8080;
const firestore = new Firestore();
const PACKAGE_NAME = 'com.callingchaos.starbase';
const ALLOWED_PRODUCTS = new Set([
  'cosmetic_dead_orbit_founder',
  'season_pass_s1',
  'recovery_pack_s1'
]);

app.get('/health', (_req, res) => res.json({ ok: true, service: 'starbase-dead-orbit' }));

app.get('/v1/config', (_req, res) => {
  res.json({
    version: 1,
    gameplay: {
      oxygenDrainPerSecond: 0.34,
      toxicFilterDrainPerSecond: 2.1,
      contactInfection: 7,
      maxMonthlySpendUsd: 25
    },
    modes: {
      wipeout: false,
      lostMode: false
    }
  });
});

app.post('/v1/save', async (req, res) => {
  const installId = String(req.header('x-install-id') || '').trim();
  if (!installId || installId.length > 128) return res.status(400).json({ error: 'install_id_required' });
  const payload = req.body;
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'invalid_payload' });
  await firestore.collection('starbase_saves').doc(installId).set({
    payload,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  res.json({ saved: true });
});

app.get('/v1/save', async (req, res) => {
  const installId = String(req.header('x-install-id') || '').trim();
  if (!installId) return res.status(400).json({ error: 'install_id_required' });
  const snap = await firestore.collection('starbase_saves').doc(installId).get();
  if (!snap.exists) return res.status(404).json({ error: 'not_found' });
  res.json(snap.data()?.payload || {});
});

app.post('/v1/purchase/verify', async (req, res) => {
  try {
    const { purchaseToken, packageName, productIds } = req.body || {};
    if (packageName !== PACKAGE_NAME) return res.status(400).json({ verified: false, error: 'package_mismatch' });
    if (!purchaseToken || !Array.isArray(productIds) || productIds.length !== 1) {
      return res.status(400).json({ verified: false, error: 'invalid_request' });
    }
    const productId = String(productIds[0]);
    if (!ALLOWED_PRODUCTS.has(productId)) return res.status(400).json({ verified: false, error: 'unknown_product' });

    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/androidpublisher']
    });
    const androidpublisher = google.androidpublisher({ version: 'v3', auth });
    const result = await androidpublisher.purchases.products.get({
      packageName: PACKAGE_NAME,
      productId,
      token: purchaseToken
    });

    const purchased = result.data.purchaseState === 0;
    if (!purchased) return res.status(403).json({ verified: false, error: 'purchase_not_completed' });

    res.json({ verified: true, productId });
  } catch (err) {
    console.error('purchase verification failed', err?.message || err);
    res.status(503).json({ verified: false, error: 'verification_unavailable' });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

app.listen(port, () => console.log(`Star Base server listening on ${port}`));
