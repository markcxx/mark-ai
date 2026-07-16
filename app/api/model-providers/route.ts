import { and, eq } from 'drizzle-orm';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { NextRequest, NextResponse } from 'next/server';

import { authorizeApiRequest, enforceRateLimit } from '@/lib/api/security';
import { encryptCredential } from '@/lib/credential-crypto';
import { getDb } from '@/lib/db';
import { userModelProviders, userSettings } from '@/lib/db/schema';
import { MODEL_PROVIDER_TEMPLATES, getModelProviderTemplate } from '@/lib/model-provider-registry';
import { getConfiguredModels, getProviderDisplayName, getPublicConfiguredModels } from '@/lib/models';
import type { ModelRuntime } from '@/lib/models';
import { listUserModelProviders } from '@/lib/user-model-providers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const RESERVED_PROVIDER_IDS = new Set(['markai']);

const normalizeModels = (value: unknown) => {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,]/)
      : [];
  return [...new Set(
    items
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item && item.length <= 200),
  )].slice(0, 100);
};

const isPrivateIpv4 = (hostname: string) => {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return parts[0] === 10 ||
    parts[0] === 0 ||
    parts[0] === 127 ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) ||
    parts[0] >= 224;
};

const isPrivateAddress = (address: string) => {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  if (isIP(address) !== 6) return true;
  const normalized = address.toLowerCase();
  return normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.');
};

const normalizeBaseUrl = async (value: unknown) => {
  if (typeof value !== 'string' || value.length > 500) return undefined;
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      hostname === 'localhost' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      hostname === 'metadata.google.internal' ||
      isPrivateIpv4(hostname)
    ) {
      return undefined;
    }
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0 || addresses.some((item) => isPrivateAddress(item.address))) {
      return undefined;
    }
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return undefined;
  }
};

const getSiteProviderMap = () => {
  const siteProviderMap = new Map<string, string[]>();
  for (const model of getPublicConfiguredModels()) {
    const models = siteProviderMap.get(model.provider) || [];
    models.push(model.id);
    siteProviderMap.set(model.provider, models);
  }
  return siteProviderMap;
};

export async function GET(req: NextRequest) {
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return authorization.response;

  const siteProviderMap = getSiteProviderMap();

  return NextResponse.json({
    cloudPersistence: Boolean(authorization.userId),
    providers: authorization.userId ? await listUserModelProviders(authorization.userId) : [],
    siteProviders: [...siteProviderMap].map(([provider, models]) => ({
      models,
      name: getProviderDisplayName(provider),
      provider,
    })),
    templates: MODEL_PROVIDER_TEMPLATES,
  });
}

export async function PATCH(req: NextRequest) {
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return authorization.response;
  if (!authorization.userId) {
    return NextResponse.json({ error: '登录后才能修改提供商启用状态' }, { status: 400 });
  }

  const limited = enforceRateLimit({
    key: authorization.key,
    limit: 60,
    scope: 'model-provider-toggle',
  });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const provider = typeof body?.provider === 'string' ? body.provider.trim().toLowerCase() : '';
  const enabled = body?.enabled;
  const template = getModelProviderTemplate(provider);
  const siteModels = getSiteProviderMap().get(provider) || [];
  const siteConfig = getConfiguredModels().find((item) =>
    item.provider === provider || (
      provider === 'markai' && item.provider.startsWith('mark') && item.provider !== 'markai'
    ),
  );
  if ((!template && !siteConfig) || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: '提供商或启用状态无效' }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(userModelProviders)
    .where(and(
      eq(userModelProviders.userId, authorization.userId),
      eq(userModelProviders.provider, provider),
    ))
    .limit(1);
  const defaultBaseUrl = template?.defaultBaseUrl || siteConfig?.baseUrl;
  if (!defaultBaseUrl) {
    return NextResponse.json({ error: '站点提供商缺少 Base URL' }, { status: 400 });
  }

  if (!enabled) {
    await db
      .insert(userModelProviders)
      .values({
        apiKeyEncrypted: existing?.apiKeyEncrypted || '',
        baseUrl: existing?.baseUrl || defaultBaseUrl,
        enabled: false,
        id: existing?.id || `provider-${crypto.randomUUID()}`,
        isCustom: false,
        models: existing?.models.length
          ? existing.models
          : siteModels.length
            ? siteModels
            : template?.defaultModels || [],
        name: existing?.name || template?.name || getProviderDisplayName(provider),
        provider,
        runtime: existing?.runtime || template?.runtime || siteConfig?.runtime || 'openai-compatible',
        userId: authorization.userId,
      })
      .onConflictDoUpdate({
        target: [userModelProviders.userId, userModelProviders.provider],
        set: { enabled: false, updatedAt: new Date() },
      });

    await db
      .update(userSettings)
      .set({ defaultModel: null, defaultProvider: null, updatedAt: new Date() })
      .where(and(
        eq(userSettings.userId, authorization.userId),
        eq(userSettings.defaultProvider, provider),
      ));
  } else if (existing?.apiKeyEncrypted && existing.models.length > 0) {
    await db
      .update(userModelProviders)
      .set({ enabled: true, updatedAt: new Date() })
      .where(eq(userModelProviders.id, existing.id));
  } else if (existing) {
    await db.delete(userModelProviders).where(eq(userModelProviders.id, existing.id));
  } else if (siteModels.length === 0) {
    return NextResponse.json({ error: '请先配置 API Key 和模型列表' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    providers: await listUserModelProviders(authorization.userId),
  });
}

export async function PUT(req: NextRequest) {
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return authorization.response;
  if (!authorization.userId) {
    return NextResponse.json(
      { error: '自定义提供商仅在 PostgreSQL 登录模式下支持' },
      { status: 400 },
    );
  }

  const limited = enforceRateLimit({
    key: authorization.key,
    limit: 30,
    scope: 'model-provider-write',
  });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const provider = typeof body?.provider === 'string' ? body.provider.trim().toLowerCase() : '';
  const template = getModelProviderTemplate(provider);
  const isCustom = !template;
  const name = typeof body?.name === 'string'
    ? body.name.trim().slice(0, 60)
    : template?.name || provider;
  const runtime: ModelRuntime = template?.runtime || (body?.runtime === 'gemini' ? 'gemini' : 'openai-compatible');
  const baseUrl = await normalizeBaseUrl(body?.baseUrl || template?.defaultBaseUrl);
  const models = normalizeModels(body?.models);
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';

  if (
    !PROVIDER_ID_RE.test(provider) ||
    RESERVED_PROVIDER_IDS.has(provider) ||
    !name ||
    !baseUrl ||
    models.length === 0
  ) {
    return NextResponse.json({ error: '提供商名称、Base URL 或模型列表无效' }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(userModelProviders)
    .where(and(
      eq(userModelProviders.userId, authorization.userId),
      eq(userModelProviders.provider, provider),
    ))
    .limit(1);

  if (body?.enabled !== false && !existing?.apiKeyEncrypted && !apiKey) {
    return NextResponse.json({ error: '首次配置必须填写 API Key' }, { status: 400 });
  }

  const apiKeyEncrypted = apiKey ? encryptCredential(apiKey) : existing?.apiKeyEncrypted || '';
  await db
    .insert(userModelProviders)
    .values({
      apiKeyEncrypted,
      baseUrl,
      enabled: body?.enabled !== false,
      id: existing?.id || `provider-${crypto.randomUUID()}`,
      isCustom,
      models,
      name,
      provider,
      runtime,
      userId: authorization.userId,
    })
    .onConflictDoUpdate({
      target: [userModelProviders.userId, userModelProviders.provider],
      set: {
        apiKeyEncrypted,
        baseUrl,
        enabled: body?.enabled !== false,
        isCustom,
        models,
        name,
        runtime,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({
    ok: true,
    providers: await listUserModelProviders(authorization.userId),
  });
}

export async function DELETE(req: NextRequest) {
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return authorization.response;
  if (!authorization.userId) {
    return NextResponse.json({ error: '当前模式不支持删除用户提供商' }, { status: 400 });
  }

  const provider = req.nextUrl.searchParams.get('provider')?.trim().toLowerCase() || '';
  if (!PROVIDER_ID_RE.test(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  const db = getDb();
  await db
    .delete(userModelProviders)
    .where(and(
      eq(userModelProviders.userId, authorization.userId),
      eq(userModelProviders.provider, provider),
    ));

  await db
    .update(userSettings)
    .set({ defaultModel: null, defaultProvider: null, updatedAt: new Date() })
    .where(and(
      eq(userSettings.userId, authorization.userId),
      eq(userSettings.defaultProvider, provider),
    ));

  return NextResponse.json({ ok: true });
}
