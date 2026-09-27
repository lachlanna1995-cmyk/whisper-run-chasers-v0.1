import express from 'express';
import crypto from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { google } from 'googleapis';

const app = express();
app.use(express.json({ limit: '256kb' }));
const port = process.env.PORT || 8080;
const firestore = new Firestore();
const PACKAGE_NAME = 'com.callingchaos.starbase';
const MONTHLY_CAP_CENTS = 2500;

const PRODUCT_RULES = Object.freeze({
  support_025: { priceCents: 25, countsTowardMonthlyCap: true, type: 'cosmetic' },
  support_050: { priceCents: 50, countsTowardMonthlyCap: true, type: 'cosmetic' },
  support_100: { priceCents: 100, countsTowardMonthlyCap: true, type: 'cosmetic' },
  support_200: { priceCents: 200, countsTowardMonthlyCap: true, type: 'cosmetic' },
  support_500: { priceCents: 500, countsTowardMonthlyCap: true, type: 'cosmetic' },
  founder_launch_series_100: { priceCents: 10000, countsTowardMonthlyCap: false, type: 'founder' }
});

function founderSalesOpen() {
  if (String(process.env.FOUNDER_SALES_OPEN || '').toLowerCase() === 'false') return false;
  const end = process.env.FOUNDER_SALES_END;
  if (!end) return true;
  const endMs = Date.parse(end);
  return Number.isFinite(endMs) && Date.now() <= endMs;
}

function monthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'starbase-dead-orbit' }));

app.get('/v1/config', (_req, res) => {
  res.json({
    version: 2,
    gameplay: {
      oxygenDrainPerSecond: 0.34,
      toxicFilterDrainPerSecond: 2.1,
      contactInfection: 7,
      maxMonthlySpendUsd: 25
    },
    store: {
      normalPurchaseMinUsd: 0.25,
      normalPurchaseMaxUsd: 5,
      monthlyCapUsd: 25,
      founderPriceUsd: 100,
      founderLaunchSeriesOpen: founderSalesOpen(),
      founderPowerAdvantage: false
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
    const { purchaseToken, packageName, productIds, accountId } = req.body || {};
    if (packageName !== PACKAGE_NAME) return res.status(400).json({ verified: false, error: 'package_mismatch' });
    if (!purchaseToken || !Array.isArray(productIds) || productIds.length !== 1) {
      return res.status(400).json({ verified: false, error: 'invalid_request' });
    }
    if (!accountId || String(accountId).length > 128) {
      return res.status(400).json({ verified: false, error: 'authenticated_account_required' });
    }

    const productId = String(productIds[0]);
    const rule = PRODUCT_RULES[productId];
    if (!rule) return res.status(400).json({ verified: false, error: 'unknown_product' });
    if (rule.type === 'founder' && !founderSalesOpen()) {
      return res.status(403).json({ verified: false, error: 'founder_sales_closed' });
    }

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

    const account = String(accountId);
    const hash = tokenHash(purchaseToken);
    const purchaseRef = firestore.collection('starbase_purchase_tokens').doc(hash);
    const entitlementRef = firestore.collection('starbase_entitlements').doc(account);
    const ledgerRef = firestore.collection('starbase_spend').doc(`${account}_${monthKey()}`);

    const response = await firestore.runTransaction(async tx => {
      const prior = await tx.get(purchaseRef);
      if (prior.exists) {
        const data = prior.data() || {};
        if (data.accountId !== account || data.productId !== productId) throw new Error('purchase_token_reused');
        return { verified: true, productId, duplicate: true };
      }

      if (rule.type === 'founder') {
        const ent = await tx.get(entitlementRef);
        if (ent.exists && ent.data()?.founder === true) throw new Error('founder_already_owned');
        tx.set(entitlementRef, {
          founder: true,
          founderProductId: productId,
          founderGrantedAt: new Date().toISOString()
        }, { merge: true });
      } else if (rule.countsTowardMonthlyCap) {
        const ledger = await tx.get(ledgerRef);
        const current = ledger.exists ? Number(ledger.data()?.spentCents || 0) : 0;
        const next = current + rule.priceCents;
        if (next > MONTHLY_CAP_CENTS) throw new Error('monthly_cap_exceeded');
        tx.set(ledgerRef, {
          accountId: account,
          month: monthKey(),
          spentCents: next,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      tx.create(purchaseRef, {
        accountId: account,
        productId,
        priceCents: rule.priceCents,
        verifiedAt: new Date().toISOString()
      });
      return { verified: true, productId, duplicate: false };
    });

    res.json(response);
  } catch (err) {
    const message = String(err?.message || err);
    if (message.includes('monthly_cap_exceeded')) return res.status(403).json({ verified: false, error: 'monthly_cap_exceeded' });
    if (message.includes('founder_already_owned')) return res.status(409).json({ verified: false, error: 'founder_already_owned' });
    if (message.includes('purchase_token_reused')) return res.status(409).json({ verified: false, error: 'purchase_token_reused' });
    console.error('purchase verification failed', message);
    res.status(503).json({ verified: false, error: 'verification_unavailable' });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

app.listen(port, () => console.log(`Star Base server listening on ${port}`));
