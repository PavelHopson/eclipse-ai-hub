export type ModelCapability = 'text' | 'image' | 'video' | 'audio';
export type ModelRuntime = 'local' | 'self-hosted' | 'cloud';

export interface RegistryModel {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapability[];
  runtime: ModelRuntime;
  badges: Array<'Local' | 'Cloud' | 'Paid' | 'Private' | 'Experimental'>;
  license: string;
  commercialUse: string;
  privacy: string;
  cost: string;
  checkedAt: string;
  minRamGb: number;
  minVramGb: number;
  minDiskGb: number;
  route: 'interactive' | 'batch';
}

export const MODEL_REGISTRY: RegistryModel[] = [
  {
    id: 'ollama-qwen-local', name: 'Qwen local via Ollama', provider: 'Ollama / model author',
    capabilities: ['text'], runtime: 'local', badges: ['Local', 'Private'],
    license: 'Проверяется для выбранного model artifact', commercialUse: 'Зависит от конкретной модели',
    privacy: 'Prompt остаётся на устройстве при loopback-only Ollama', cost: 'API: 0; учитывайте электричество и hardware',
    checkedAt: '2026-08-02', minRamGb: 16, minVramGb: 8, minDiskGb: 12, route: 'interactive',
  },
  {
    id: 'gemini-cloud', name: 'Gemini cloud', provider: 'Google', capabilities: ['text', 'image'],
    runtime: 'cloud', badges: ['Cloud', 'Paid'], license: 'Provider Terms', commercialUse: 'По действующим условиям provider',
    privacy: 'Prompt и вложения отправляются Google', cost: 'Показывается provider перед production-запуском',
    checkedAt: '2026-08-02', minRamGb: 4, minVramGb: 0, minDiskGb: 1, route: 'interactive',
  },
  {
    id: 'flux-self-hosted', name: 'FLUX image worker', provider: 'Black Forest Labs / self-hosted runtime', capabilities: ['image'],
    runtime: 'self-hosted', badges: ['Private', 'Experimental'], license: 'Зависит от выбранного checkpoint',
    commercialUse: 'Проверить лицензию exact checkpoint', privacy: 'Данные остаются в вашем worker boundary',
    cost: 'GPU runtime; расчёт до постановки в очередь', checkedAt: '2026-08-02', minRamGb: 32, minVramGb: 16, minDiskGb: 35, route: 'batch',
  },
  {
    id: 'hyperframes-local', name: 'HyperFrames renderer', provider: 'HeyGen open source', capabilities: ['video'],
    runtime: 'local', badges: ['Local', 'Private'], license: 'Apache-2.0; GSAP имеет отдельные условия',
    commercialUse: 'Допустимость template/assets проверяется отдельно', privacy: 'Локальный deterministic render',
    cost: 'API: 0; локальное CPU/GPU время', checkedAt: '2026-08-02', minRamGb: 8, minVramGb: 0, minDiskGb: 5, route: 'batch',
  },
  {
    id: 'audio-cloud-placeholder', name: 'Audio provider adapter', provider: 'Не выбран', capabilities: ['audio'],
    runtime: 'cloud', badges: ['Cloud', 'Experimental'], license: 'Не проверена', commercialUse: 'Заблокировано до legal review',
    privacy: 'Не определена', cost: 'Не определена', checkedAt: '2026-08-02', minRamGb: 4, minVramGb: 0, minDiskGb: 1, route: 'batch',
  },
];

export interface HardwareProfile { ramGb: number; vramGb: number; diskGb: number }

export function hardwareStatus(model: RegistryModel, profile: HardwareProfile): 'ready' | 'limited' | 'missing' {
  if (profile.ramGb < model.minRamGb || profile.diskGb < model.minDiskGb) return 'missing';
  if (model.minVramGb > 0 && profile.vramGb < model.minVramGb) return 'limited';
  return 'ready';
}

export function recommendModel(capability: ModelCapability, privateOnly: boolean, profile: HardwareProfile): RegistryModel | null {
  const candidates = MODEL_REGISTRY.filter((model) =>
    model.capabilities.includes(capability)
    && (!privateOnly || model.badges.includes('Private'))
    && model.license !== 'Не проверена'
    && hardwareStatus(model, profile) !== 'missing');
  return candidates.sort((a, b) => {
    const statusWeight = { ready: 0, limited: 1, missing: 2 };
    return statusWeight[hardwareStatus(a, profile)] - statusWeight[hardwareStatus(b, profile)]
      || Number(a.badges.includes('Experimental')) - Number(b.badges.includes('Experimental'));
  })[0] ?? null;
}
