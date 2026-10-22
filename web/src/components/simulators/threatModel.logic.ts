/**
 * STRIDE tehdit modeli tuvalinin saf mantığı: hazır mimari senaryolar, öğe başına beklenen tehdit
 * kümesi ("STRIDE-per-element" + öğeye özgü düzeltmeler) ve kullanıcının işaretlerini puanlama.
 *
 * STRIDE-per-element temeli (Microsoft SDL tehdit modelleme yaklaşımı):
 *   dış varlık → S, R      süreç → S, T, R, I, D, E
 *   veri deposu → T, I, D  (log deposu ayrıca R)      veri akışı → T, I, D
 */

export type Bi = { tr: string; en: string };

export const STRIDE = ['S', 'T', 'R', 'I', 'D', 'E'] as const;
export type Stride = (typeof STRIDE)[number];

export const STRIDE_INFO: Record<Stride, { name: Bi; property: Bi }> = {
  S: {
    name: { tr: 'Kimlik sahteciliği (Spoofing)', en: 'Spoofing' },
    property: { tr: 'Kimlik doğrulama', en: 'Authentication' },
  },
  T: {
    name: { tr: 'Kurcalama (Tampering)', en: 'Tampering' },
    property: { tr: 'Bütünlük', en: 'Integrity' },
  },
  R: {
    name: { tr: 'İnkâr (Repudiation)', en: 'Repudiation' },
    property: { tr: 'İnkâr edilemezlik', en: 'Non-repudiation' },
  },
  I: {
    name: { tr: 'Bilgi ifşası (Information disclosure)', en: 'Information disclosure' },
    property: { tr: 'Gizlilik', en: 'Confidentiality' },
  },
  D: {
    name: { tr: 'Hizmet engelleme (Denial of service)', en: 'Denial of service' },
    property: { tr: 'Erişilebilirlik', en: 'Availability' },
  },
  E: {
    name: { tr: 'Yetki yükseltme (Elevation of privilege)', en: 'Elevation of privilege' },
    property: { tr: 'Yetkilendirme', en: 'Authorisation' },
  },
};

export type ElementKind = 'external' | 'process' | 'store' | 'flow';

export const BASE_THREATS: Record<ElementKind, Stride[]> = {
  external: ['S', 'R'],
  process: ['S', 'T', 'R', 'I', 'D', 'E'],
  store: ['T', 'I', 'D'],
  flow: ['T', 'I', 'D'],
};

/** Tür × kategori için genel gerekçe ve örnek önlem */
const GENERIC: Record<ElementKind, Partial<Record<Stride, { why: Bi; fix: Bi }>>> = {
  external: {
    S: {
      why: {
        tr: 'Saldırgan bu varlık gibi davranabilir.',
        en: 'An attacker can pretend to be this entity.',
      },
      fix: {
        tr: 'Güçlü kimlik doğrulama (MFA, imzalı istek).',
        en: 'Strong authentication (MFA, signed requests).',
      },
    },
    R: {
      why: {
        tr: 'Varlık bir işlemi yaptığını inkâr edebilir.',
        en: 'The entity can deny having performed an action.',
      },
      fix: {
        tr: 'Kimlikle ilişkilendirilmiş, değiştirilemez denetim kaydı.',
        en: 'Identity-bound, tamper-evident audit log.',
      },
    },
  },
  process: {
    S: {
      why: {
        tr: 'Başka bir servis bu süreç gibi davranabilir.',
        en: 'Another service can impersonate this process.',
      },
      fix: {
        tr: 'Servisler arası mTLS ya da imzalı servis kimliği.',
        en: 'Service-to-service mTLS or signed workload identity.',
      },
    },
    T: {
      why: {
        tr: 'Girdi ya da kod değiştirilerek davranış bozulabilir.',
        en: 'Behaviour can be altered via input or code changes.',
      },
      fix: {
        tr: 'Girdi doğrulama, imzalı yapı çıktıları.',
        en: 'Input validation, signed build artefacts.',
      },
    },
    R: {
      why: {
        tr: 'Kimin neyi tetiklediği izlenemeyebilir.',
        en: 'Who triggered what may be untraceable.',
      },
      fix: {
        tr: 'İstek kimliğiyle yapılandırılmış denetim logu.',
        en: 'Structured audit logging with request ids.',
      },
    },
    I: {
      why: {
        tr: 'Hata mesajları ya da bellek gizli veri sızdırabilir.',
        en: 'Errors or memory can leak secrets.',
      },
      fix: {
        tr: 'Genel hata mesajları, gizli bilgileri loglamama.',
        en: 'Generic error messages, never log secrets.',
      },
    },
    D: {
      why: {
        tr: 'Aşırı istekle kaynakları tüketilebilir.',
        en: 'Resources can be exhausted by excessive requests.',
      },
      fix: {
        tr: 'Hız sınırlama, zaman aşımı, otomatik ölçekleme.',
        en: 'Rate limiting, timeouts, autoscaling.',
      },
    },
    E: {
      why: {
        tr: 'Yetki kontrolü atlanarak fazla yetki alınabilir.',
        en: 'Authorisation checks may be bypassed.',
      },
      fix: {
        tr: 'Her istekte sunucu tarafı yetki kontrolü, en az ayrıcalık.',
        en: 'Server-side authorisation on every request, least privilege.',
      },
    },
  },
  store: {
    T: {
      why: {
        tr: 'Kayıtlar yetkisiz değiştirilebilir.',
        en: 'Records can be modified without authorisation.',
      },
      fix: {
        tr: 'Erişim kontrolü, ayrı yazma yetkisi, bütünlük kontrolü.',
        en: 'Access control, separate write rights, integrity checks.',
      },
    },
    R: {
      why: {
        tr: 'Loglar silinirse olay geçmişi inkâr edilebilir.',
        en: 'If logs are erased, history can be denied.',
      },
      fix: {
        tr: 'Yalnızca ekleme yapılabilen (append-only), ayrı hesapta tutulan log.',
        en: 'Append-only logs stored in a separate account.',
      },
    },
    I: {
      why: { tr: 'Depo ya da yedekleri sızdırılabilir.', en: 'The store or its backups can leak.' },
      fix: {
        tr: 'Durağan veride şifreleme, en az ayrıcalıklı erişim.',
        en: 'Encryption at rest, least-privilege access.',
      },
    },
    D: {
      why: {
        tr: 'Depo doldurulabilir ya da kilitlenebilir.',
        en: 'The store can be filled up or locked.',
      },
      fix: {
        tr: 'Kota, bağlantı havuzu sınırı, yedekleme.',
        en: 'Quotas, connection pool limits, backups.',
      },
    },
  },
  flow: {
    T: {
      why: {
        tr: 'Aradaki biri veriyi yolda değiştirebilir.',
        en: 'Someone in the middle can alter data in transit.',
      },
      fix: {
        tr: 'TLS ve mesaj bütünlüğü (HMAC/imza).',
        en: 'TLS and message integrity (HMAC/signature).',
      },
    },
    I: {
      why: { tr: 'Trafik dinlenerek veri okunabilir.', en: 'Traffic can be sniffed.' },
      fix: {
        tr: 'Uçtan uca TLS, hassas alanları en aza indirme.',
        en: 'TLS everywhere, minimise sensitive fields.',
      },
    },
    D: {
      why: {
        tr: 'Bağlantı kesilebilir ya da boğulabilir.',
        en: 'The channel can be cut or flooded.',
      },
      fix: {
        tr: 'Zaman aşımı, yeniden deneme, kuyruk ile tamponlama.',
        en: 'Timeouts, retries, buffering with a queue.',
      },
    },
  },
};

export interface ThreatElement {
  id: string;
  kind: ElementKind;
  label: Bi;
  /** Düğümler için merkez koordinatı (SVG 640×340) */
  x?: number;
  y?: number;
  /** Akışlar için uçlar */
  from?: string;
  to?: string;
  /** STRIDE-per-element temeline eklenen / çıkarılan kategoriler */
  add?: Stride[];
  remove?: Stride[];
  /** Öğeye özgü gerekçe ve önlem (genel metni ezer) */
  specific?: Partial<Record<Stride, { why: Bi; fix: Bi }>>;
}

export interface Boundary {
  label: Bi;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ThreatScenario {
  title: Bi;
  elements: ThreatElement[];
  boundaries: Boundary[];
}

export type ScenarioId = 'web-app' | 'mobile-payment' | 'ci-pipeline';
export const SCENARIO_IDS: ScenarioId[] = ['web-app', 'mobile-payment', 'ci-pipeline'];

export const SCENARIOS: Record<ScenarioId, ThreatScenario> = {
  'web-app': {
    title: { tr: 'Web uygulaması', en: 'Web application' },
    boundaries: [
      { label: { tr: 'Uygulama bölgesi', en: 'App zone' }, x: 200, y: 30, w: 220, h: 280 },
      { label: { tr: 'Veri bölgesi', en: 'Data zone' }, x: 450, y: 30, w: 180, h: 280 },
    ],
    elements: [
      { id: 'browser', kind: 'external', label: { tr: 'Tarayıcı', en: 'Browser' }, x: 90, y: 170 },
      {
        id: 'api',
        kind: 'process',
        label: { tr: 'API sunucusu', en: 'API server' },
        x: 310,
        y: 170,
      },
      { id: 'db', kind: 'store', label: { tr: 'Veritabanı', en: 'Database' }, x: 540, y: 110 },
      {
        id: 'logs',
        kind: 'store',
        label: { tr: 'Denetim logu', en: 'Audit log' },
        x: 540,
        y: 250,
        add: ['R'],
      },
      {
        id: 'f-req',
        kind: 'flow',
        from: 'browser',
        to: 'api',
        label: { tr: 'HTTPS + oturum çerezi', en: 'HTTPS + session cookie' },
        add: ['S'],
        specific: {
          S: {
            why: {
              tr: 'Çalınan oturum çereziyle başkası adına istek atılabilir.',
              en: 'A stolen session cookie lets someone act as the user.',
            },
            fix: {
              tr: 'HttpOnly + Secure + SameSite çerez, kısa oturum.',
              en: 'HttpOnly + Secure + SameSite cookies, short sessions.',
            },
          },
        },
      },
      {
        id: 'f-sql',
        kind: 'flow',
        from: 'api',
        to: 'db',
        label: { tr: 'SQL sorgusu', en: 'SQL query' },
        specific: {
          T: {
            why: {
              tr: 'Birleştirilen kullanıcı girdisi sorguyu değiştirebilir (SQL enjeksiyonu).',
              en: 'Concatenated user input can change the query (SQL injection).',
            },
            fix: { tr: 'Parametreli sorgular / ORM.', en: 'Parameterised queries / ORM.' },
          },
        },
      },
      {
        id: 'f-log',
        kind: 'flow',
        from: 'api',
        to: 'logs',
        label: { tr: 'Log kaydı', en: 'Log entry' },
      },
    ],
  },
  'mobile-payment': {
    title: { tr: 'Mobil ödeme', en: 'Mobile payment' },
    boundaries: [
      { label: { tr: 'Şirket ağı', en: 'Company network' }, x: 200, y: 30, w: 220, h: 280 },
      { label: { tr: 'Üçüncü taraf', en: 'Third party' }, x: 450, y: 30, w: 180, h: 140 },
      { label: { tr: 'Veri bölgesi', en: 'Data zone' }, x: 450, y: 185, w: 180, h: 125 },
    ],
    elements: [
      {
        id: 'app',
        kind: 'external',
        label: { tr: 'Mobil uygulama', en: 'Mobile app' },
        x: 90,
        y: 170,
        add: ['T'],
        specific: {
          T: {
            why: {
              tr: 'Cihazdaki uygulama tersine mühendislikle değiştirilebilir; istemciye güvenilmez.',
              en: 'The app on the device can be reverse-engineered and modified; the client is untrusted.',
            },
            fix: {
              tr: 'Tutar ve fiyatı sunucuda hesapla, uygulama bütünlüğü doğrulaması (attestation).',
              en: 'Compute amounts server-side, app attestation.',
            },
          },
        },
      },
      {
        id: 'pay-api',
        kind: 'process',
        label: { tr: 'Ödeme API’si', en: 'Payment API' },
        x: 310,
        y: 170,
      },
      {
        id: 'psp',
        kind: 'external',
        label: { tr: 'Ödeme sağlayıcı', en: 'Payment provider' },
        x: 540,
        y: 100,
      },
      {
        id: 'ledger',
        kind: 'store',
        label: { tr: 'İşlem defteri', en: 'Ledger' },
        x: 540,
        y: 250,
        add: ['R'],
      },
      {
        id: 'f-pay',
        kind: 'flow',
        from: 'app',
        to: 'pay-api',
        label: { tr: 'Ödeme isteği (kart token’ı)', en: 'Payment request (card token)' },
        specific: {
          T: {
            why: {
              tr: 'Tutar alanı yolda ya da istemcide değiştirilebilir; aynı istek tekrar gönderilebilir.',
              en: 'The amount can be altered; the same request can be replayed.',
            },
            fix: {
              tr: 'TLS + idempotency anahtarı, tutarı sunucuda doğrula.',
              en: 'TLS + idempotency keys, validate amount server-side.',
            },
          },
        },
      },
      {
        id: 'f-charge',
        kind: 'flow',
        from: 'pay-api',
        to: 'psp',
        label: { tr: 'Tahsilat çağrısı', en: 'Charge call' },
      },
      {
        id: 'f-webhook',
        kind: 'flow',
        from: 'psp',
        to: 'pay-api',
        label: { tr: 'Webhook: ödeme sonucu', en: 'Webhook: payment result' },
        add: ['S'],
        specific: {
          S: {
            why: {
              tr: 'Herkes webhook adresine “ödendi” mesajı gönderebilir.',
              en: 'Anyone can post a fake “paid” message to the webhook URL.',
            },
            fix: {
              tr: 'Webhook imzasını (HMAC) doğrula, zaman damgasıyla tekrarı engelle.',
              en: 'Verify the webhook HMAC signature, reject replays by timestamp.',
            },
          },
        },
      },
      {
        id: 'f-ledger',
        kind: 'flow',
        from: 'pay-api',
        to: 'ledger',
        label: { tr: 'Kayıt yaz', en: 'Write entry' },
      },
    ],
  },
  'ci-pipeline': {
    title: { tr: 'CI/CD hattı', en: 'CI/CD pipeline' },
    boundaries: [
      { label: { tr: 'CI ortamı', en: 'CI environment' }, x: 200, y: 30, w: 220, h: 280 },
      { label: { tr: 'Üretim', en: 'Production' }, x: 450, y: 180, w: 180, h: 130 },
    ],
    elements: [
      { id: 'dev', kind: 'external', label: { tr: 'Geliştirici', en: 'Developer' }, x: 90, y: 100 },
      {
        id: 'deps',
        kind: 'external',
        label: { tr: 'Açık kaynak paket', en: 'Open-source package' },
        x: 90,
        y: 250,
        add: ['T'],
        specific: {
          T: {
            why: {
              tr: 'Ele geçirilmiş ya da benzer adlı (typosquat) paket kötü kod taşıyabilir.',
              en: 'A hijacked or typosquatted package can carry malicious code.',
            },
            fix: {
              tr: 'Kilit dosyası + bütünlük özeti, bağımlılık taraması.',
              en: 'Lockfile with integrity hashes, dependency scanning.',
            },
          },
        },
      },
      {
        id: 'runner',
        kind: 'process',
        label: { tr: 'CI çalıştırıcı', en: 'CI runner' },
        x: 310,
        y: 170,
        specific: {
          I: {
            why: {
              tr: 'Ortam değişkenlerindeki sırlar loglara ya da kötü bir betiğe sızabilir.',
              en: 'Secrets in env vars can leak to logs or a malicious script.',
            },
            fix: {
              tr: 'Kısa ömürlü OIDC kimlik bilgileri, log maskeleme.',
              en: 'Short-lived OIDC credentials, log masking.',
            },
          },
        },
      },
      {
        id: 'registry',
        kind: 'store',
        label: { tr: 'İmaj kayıt defteri', en: 'Image registry' },
        x: 540,
        y: 100,
      },
      {
        id: 'prod',
        kind: 'process',
        label: { tr: 'Üretim kümesi', en: 'Production cluster' },
        x: 540,
        y: 250,
      },
      {
        id: 'f-push',
        kind: 'flow',
        from: 'dev',
        to: 'runner',
        label: { tr: 'git push → tetik', en: 'git push → trigger' },
        add: ['S'],
        specific: {
          S: {
            why: {
              tr: 'Çalınan bir geliştirici token’ıyla kötü kod gönderilebilir.',
              en: 'A stolen developer token can push malicious code.',
            },
            fix: {
              tr: 'İmzalı commit, korumalı dal + zorunlu inceleme.',
              en: 'Signed commits, protected branches with required review.',
            },
          },
        },
      },
      {
        id: 'f-deps',
        kind: 'flow',
        from: 'deps',
        to: 'runner',
        label: { tr: 'Bağımlılık indirme', en: 'Dependency download' },
      },
      {
        id: 'f-publish',
        kind: 'flow',
        from: 'runner',
        to: 'registry',
        label: { tr: 'İmaj yayımla', en: 'Publish image' },
      },
      {
        id: 'f-deploy',
        kind: 'flow',
        from: 'registry',
        to: 'prod',
        label: { tr: 'Dağıtım', en: 'Deploy' },
        specific: {
          T: {
            why: {
              tr: 'Kayıt defterindeki imaj değiştirilirse üretime kötü kod gider.',
              en: 'A swapped image in the registry ships malicious code.',
            },
            fix: {
              tr: 'İmajı özetle (digest) çek, imzayı (cosign) doğrula.',
              en: 'Pull by digest, verify the signature (cosign).',
            },
          },
        },
      },
    ],
  },
};

export function expectedThreats(el: ThreatElement): Stride[] {
  const set = new Set<Stride>([...BASE_THREATS[el.kind], ...(el.add ?? [])]);
  for (const s of el.remove ?? []) set.delete(s);
  return STRIDE.filter((s) => set.has(s));
}

/** Kategori için gerekçe ve önlem: öğeye özgü metin, yoksa tür geneli */
export function threatDetail(el: ThreatElement, s: Stride): { why: Bi; fix: Bi } | null {
  return el.specific?.[s] ?? GENERIC[el.kind][s] ?? null;
}

export type Marks = Record<string, Partial<Record<Stride, boolean>>>;

export interface ElementScore {
  found: Stride[];
  missed: Stride[];
  extra: Stride[];
}

export function scoreElement(el: ThreatElement, marks: Marks): ElementScore {
  const exp = new Set(expectedThreats(el));
  const m = marks[el.id] ?? {};
  const found: Stride[] = [];
  const missed: Stride[] = [];
  const extra: Stride[] = [];
  for (const s of STRIDE) {
    if (m[s] && exp.has(s)) found.push(s);
    else if (!m[s] && exp.has(s)) missed.push(s);
    else if (m[s] && !exp.has(s)) extra.push(s);
  }
  return { found, missed, extra };
}

export interface ModelScore {
  found: number;
  total: number;
  extra: number;
  /** Hiç işaretlenmemiş öğe sayısı */
  untouched: number;
  perElement: Record<string, ElementScore>;
}

export function scoreModel(scenario: ThreatScenario, marks: Marks): ModelScore {
  let found = 0;
  let total = 0;
  let extra = 0;
  let untouched = 0;
  const perElement: Record<string, ElementScore> = {};
  for (const el of scenario.elements) {
    const s = scoreElement(el, marks);
    perElement[el.id] = s;
    found += s.found.length;
    total += s.found.length + s.missed.length;
    extra += s.extra.length;
    if (!Object.values(marks[el.id] ?? {}).some(Boolean)) untouched++;
  }
  return { found, total, extra, untouched, perElement };
}

export function toggleMark(marks: Marks, elementId: string, s: Stride): Marks {
  const cur = marks[elementId] ?? {};
  return { ...marks, [elementId]: { ...cur, [s]: !cur[s] } };
}
