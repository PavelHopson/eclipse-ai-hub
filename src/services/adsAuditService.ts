export interface CampaignRow {
  name: string;
  status: 'active' | 'paused';
  spend: number;
  conversions: number;
  revenue: number;
  dailyBudget: number;
}

export interface AdsSnapshot {
  schemaVersion: 'ads.snapshot.v1';
  account: string;
  currency: string;
  period: string;
  campaigns: CampaignRow[];
}

export interface AdsFinding {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  evidence: string;
  recommendation: string;
  diff?: { before: string; after: string };
}

export interface AdsAuditReport {
  schemaVersion: 'ads.audit.v1';
  generatedAt: string;
  readOnly: true;
  account: string;
  period: string;
  currency: string;
  score: number;
  totals: { spend: number; conversions: number; revenue: number; roas: number | null };
  findings: AdsFinding[];
}

const MAX_INPUT_BYTES = 256 * 1024;
const MAX_CAMPAIGNS = 500;
const HAS_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function assertFiniteNonNegative(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field}: укажите число не меньше нуля`);
  }
}

export function parseAdsSnapshot(raw: string): AdsSnapshot {
  if (new TextEncoder().encode(raw).byteLength > MAX_INPUT_BYTES) {
    throw new Error('Файл слишком большой: максимум 256 КБ');
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Не удалось прочитать JSON. Проверьте запятые и кавычки.');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Ожидается JSON-объект ads.snapshot.v1');
  }
  const snapshot = value as Record<string, unknown>;
  if (snapshot.schemaVersion !== 'ads.snapshot.v1') throw new Error('Поддерживается только schemaVersion ads.snapshot.v1');
  if (typeof snapshot.account !== 'string' || snapshot.account.trim().length < 2 || snapshot.account.length > 120 || HAS_CONTROL_CHARACTERS.test(snapshot.account)) {
    throw new Error('account: укажите понятное имя длиной 2–120 символов');
  }
  if (typeof snapshot.currency !== 'string' || !/^[A-Z]{3}$/.test(snapshot.currency)) {
    throw new Error('currency: укажите трёхбуквенный код, например USD');
  }
  if (typeof snapshot.period !== 'string' || snapshot.period.length < 3 || snapshot.period.length > 80 || HAS_CONTROL_CHARACTERS.test(snapshot.period)) {
    throw new Error('period: укажите период отчёта');
  }
  if (!Array.isArray(snapshot.campaigns) || snapshot.campaigns.length === 0) {
    throw new Error('campaigns: добавьте хотя бы одну кампанию');
  }
  if (snapshot.campaigns.length > MAX_CAMPAIGNS) throw new Error(`campaigns: максимум ${MAX_CAMPAIGNS} строк`);

  const campaignNames = new Set<string>();
  const campaigns = snapshot.campaigns.map((row, index): CampaignRow => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`campaigns[${index}]: ожидается объект`);
    const item = row as Record<string, unknown>;
    if (typeof item.name !== 'string' || item.name.trim().length < 1 || item.name.length > 160 || HAS_CONTROL_CHARACTERS.test(item.name)) {
      throw new Error(`campaigns[${index}].name: обязательное поле`);
    }
    const normalizedName = item.name.trim().toLocaleLowerCase('en-US');
    if (campaignNames.has(normalizedName)) throw new Error(`campaigns[${index}].name: название должно быть уникальным`);
    campaignNames.add(normalizedName);
    if (item.status !== 'active' && item.status !== 'paused') {
      throw new Error(`campaigns[${index}].status: active или paused`);
    }
    assertFiniteNonNegative(item.spend, `campaigns[${index}].spend`);
    assertFiniteNonNegative(item.conversions, `campaigns[${index}].conversions`);
    assertFiniteNonNegative(item.revenue, `campaigns[${index}].revenue`);
    assertFiniteNonNegative(item.dailyBudget, `campaigns[${index}].dailyBudget`);
    return {
      name: item.name.trim(),
      status: item.status,
      spend: item.spend,
      conversions: item.conversions,
      revenue: item.revenue,
      dailyBudget: item.dailyBudget,
    };
  });

  return {
    schemaVersion: 'ads.snapshot.v1',
    account: snapshot.account.trim(),
    currency: snapshot.currency,
    period: snapshot.period,
    campaigns,
  };
}

export function auditAdsSnapshot(snapshot: AdsSnapshot, now = new Date()): AdsAuditReport {
  const active = snapshot.campaigns.filter((campaign) => campaign.status === 'active');
  const spend = active.reduce((sum, campaign) => sum + campaign.spend, 0);
  const conversions = active.reduce((sum, campaign) => sum + campaign.conversions, 0);
  const revenue = active.reduce((sum, campaign) => sum + campaign.revenue, 0);
  const findings: AdsFinding[] = [];

  for (const campaign of active) {
    if (campaign.spend > 0 && campaign.conversions === 0) {
      findings.push({
        id: `zero-conversions:${campaign.name}`,
        severity: 'high',
        title: `Расход без конверсий: ${campaign.name}`,
        evidence: `${campaign.spend.toFixed(2)} ${snapshot.currency} потрачено, конверсий: 0.`,
        recommendation: 'Проверьте tracking, поисковые запросы, аудиторию и creative. Бюджет не изменяется автоматически.',
        diff: {
          before: `${campaign.dailyBudget.toFixed(2)} ${snapshot.currency}/день`,
          after: 'Рекомендация: приостановить или снизить после ручной проверки',
        },
      });
    }
  }

  const largest = active.reduce<CampaignRow | null>((current, campaign) => !current || campaign.spend > current.spend ? campaign : current, null);
  if (largest && spend > 0 && largest.spend / spend >= 0.6) {
    findings.push({
      id: 'budget-concentration',
      severity: 'medium',
      title: 'Бюджет слишком сконцентрирован',
      evidence: `${largest.name} использует ${Math.round((largest.spend / spend) * 100)}% расхода активных кампаний.`,
      recommendation: 'Проверьте, оправдана ли концентрация результатами и лимитами риска.',
    });
  }

  if (spend > 0 && revenue / spend < 1) {
    findings.push({
      id: 'roas-below-one',
      severity: 'high',
      title: 'Доход ниже рекламного расхода',
      evidence: `ROAS ${(revenue / spend).toFixed(2)} до учёта себестоимости и операционных расходов.`,
      recommendation: 'Сверьте attribution и маржинальность до перераспределения бюджета.',
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: 'manual-review',
      severity: 'low',
      title: 'Автоматические красные флаги не найдены',
      evidence: 'Проверены расходы, конверсии, ROAS и концентрация бюджета по переданному snapshot.',
      recommendation: 'Продолжите ручной review tracking, creative fatigue, search terms и attribution.',
    });
  }

  const penalty = findings.reduce((sum, finding) => sum + (finding.severity === 'high' ? 22 : finding.severity === 'medium' ? 10 : 2), 0);
  return {
    schemaVersion: 'ads.audit.v1',
    generatedAt: now.toISOString(),
    readOnly: true,
    account: snapshot.account,
    period: snapshot.period,
    currency: snapshot.currency,
    score: Math.max(0, 100 - penalty),
    totals: { spend, conversions, revenue, roas: spend > 0 ? revenue / spend : null },
    findings,
  };
}

export const SAMPLE_ADS_SNAPSHOT = JSON.stringify({
  schemaVersion: 'ads.snapshot.v1',
  account: 'Eclipse Demo Account',
  currency: 'USD',
  period: '2026-07-01 / 2026-07-31',
  campaigns: [
    { name: 'Brand Search', status: 'active', spend: 920, conversions: 48, revenue: 6200, dailyBudget: 40 },
    { name: 'Generic Search', status: 'active', spend: 1850, conversions: 0, revenue: 0, dailyBudget: 80 },
    { name: 'Retargeting', status: 'active', spend: 410, conversions: 11, revenue: 1540, dailyBudget: 20 },
  ],
}, null, 2);
