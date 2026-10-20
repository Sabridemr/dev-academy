/**
 * OAuth 2.0 akışlarının adım listesi ve "authorization code ele geçirildi" saldırısının sonucu.
 * Saf veri: değerler sabit ve örnek amaçlıdır (PKCE çifti RFC 7636 Ek B'deki örnektir).
 */

export const OAUTH_FLOWS = ['authorization-code', 'client-credentials', 'implicit'] as const;
export type OAuthFlow = (typeof OAUTH_FLOWS)[number];
export type Actor = 'browser' | 'client' | 'auth' | 'resource';
export const ACTORS: Actor[] = ['browser', 'client', 'auth', 'resource'];
type Loc = 'tr' | 'en';

export interface OAuthStep {
  id: string;
  from: Actor;
  to: Actor;
  title: string;
  /** Mesajda taşınan parametreler */
  params: [string, string][];
  note?: string;
  /** Bu adımda gizli bir değer (code/token) tarayıcı üzerinden geçer mi? */
  exposes?: 'code' | 'token';
}

export const SAMPLE = {
  clientId: 'demo-app',
  clientSecret: 's3cr3t-only-on-server',
  redirectUri: 'https://app.example/callback',
  scope: 'profile:read',
  state: 'af0ifjsldkj',
  code: 'SplxlOBeZQQYbYS6WxSbIA',
  codeVerifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
  codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  accessToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig',
  refreshToken: 'tGzv3JOkF0XG5Qx2TlKWIA',
} as const;

const T = {
  tr: {
    click: 'Kullanıcı “Giriş yap”a tıklar',
    redirectAuthorize: '302 yönlendirme: /authorize',
    authorize: 'GET /authorize: giriş ve onay ekranı',
    login: 'Kullanıcı giriş yapar ve izin verir',
    redirectCode: '302 yönlendirme: redirect_uri?code=…',
    redirectToken: '302 yönlendirme: redirect_uri#access_token=…',
    callback: 'GET /callback: uygulama state’i doğrular',
    readFragment: 'Sayfadaki JavaScript URL parçasından (#) token’ı okur',
    tokenReq: 'POST /token: kodu token ile takas et',
    tokenRes: '200: token yanıtı',
    ccReq: 'POST /token: istemci kimlik bilgileriyle',
    api: 'GET /api/me: Bearer token ile',
    apiRes: '200: korunan kaynak',
    noteState: 'state CSRF’e karşı: dönüşte aynı değer gelmezse istek reddedilir.',
    notePkce:
      'code_challenge = BASE64URL(SHA-256(code_verifier)). Doğrulayıcı (verifier) uygulamada gizli kalır.',
    noteNoPkce:
      'PKCE yok: kodu ele geçiren herkes onu token’a çevirebilir (genel/public istemcilerde gizli anahtar yoktur).',
    noteCode: 'Kod tarayıcı adres çubuğundan geçer: kısa ömürlü ve tek kullanımlıktır.',
    noteVerify: 'Sunucu SHA-256(code_verifier) değerini kayıtlı code_challenge ile karşılaştırır.',
    noteCc:
      'Kullanıcı ve tarayıcı yok: makineden makineye. client_secret yalnızca sunucuda tutulur.',
    noteImplicit:
      'Token URL parçasında: tarayıcı geçmişi, eklentiler ve Referer üzerinden sızabilir; yenileme token’ı da yoktur.',
    noteBearer: 'Kaynak sunucu token’ın imzasını, süresini ve kapsamını (scope) doğrular.',
  },
  en: {
    click: 'User clicks “Sign in”',
    redirectAuthorize: '302 redirect: /authorize',
    authorize: 'GET /authorize: login and consent screen',
    login: 'User signs in and grants consent',
    redirectCode: '302 redirect: redirect_uri?code=…',
    redirectToken: '302 redirect: redirect_uri#access_token=…',
    callback: 'GET /callback: app validates state',
    readFragment: 'Page JavaScript reads the token from the URL fragment (#)',
    tokenReq: 'POST /token: exchange the code for tokens',
    tokenRes: '200: token response',
    ccReq: 'POST /token: with client credentials',
    api: 'GET /api/me: with Bearer token',
    apiRes: '200: protected resource',
    noteState:
      'state defends against CSRF: if the same value does not come back, the request is rejected.',
    notePkce:
      'code_challenge = BASE64URL(SHA-256(code_verifier)). The verifier stays secret inside the app.',
    noteNoPkce:
      'No PKCE: anyone who intercepts the code can redeem it (public clients have no secret).',
    noteCode: 'The code passes through the browser address bar: short-lived and single-use.',
    noteVerify: 'The server compares SHA-256(code_verifier) to the stored code_challenge.',
    noteCc: 'No user, no browser: machine to machine. client_secret lives only on the server.',
    noteImplicit:
      'The token sits in the URL fragment: it can leak via history, extensions and Referer; there is no refresh token.',
    noteBearer: 'The resource server checks the token signature, expiry and scope.',
  },
};

const bearer = (loc: Loc): OAuthStep[] => [
  {
    id: 'api',
    from: 'client',
    to: 'resource',
    title: T[loc].api,
    params: [['Authorization', `Bearer ${SAMPLE.accessToken}`]],
    note: T[loc].noteBearer,
  },
  {
    id: 'api-res',
    from: 'resource',
    to: 'client',
    title: T[loc].apiRes,
    params: [['body', '{ "id": "123", "name": "Ada" }']],
  },
];

export function buildSteps(flow: OAuthFlow, pkce: boolean, loc: Loc): OAuthStep[] {
  const t = T[loc];
  if (flow === 'client-credentials') {
    return [
      {
        id: 'cc-token',
        from: 'client',
        to: 'auth',
        title: t.ccReq,
        params: [
          ['grant_type', 'client_credentials'],
          ['client_id', SAMPLE.clientId],
          ['client_secret', SAMPLE.clientSecret],
          ['scope', SAMPLE.scope],
        ],
        note: t.noteCc,
      },
      {
        id: 'cc-res',
        from: 'auth',
        to: 'client',
        title: t.tokenRes,
        params: [
          ['access_token', SAMPLE.accessToken],
          ['token_type', 'Bearer'],
          ['expires_in', '3600'],
        ],
      },
      ...bearer(loc),
    ];
  }
  const implicit = flow === 'implicit';
  const usePkce = pkce && !implicit;
  const authorizeParams: [string, string][] = [
    ['response_type', implicit ? 'token' : 'code'],
    ['client_id', SAMPLE.clientId],
    ['redirect_uri', SAMPLE.redirectUri],
    ['scope', SAMPLE.scope],
    ['state', SAMPLE.state],
    ...(usePkce
      ? ([
          ['code_challenge', SAMPLE.codeChallenge],
          ['code_challenge_method', 'S256'],
        ] as [string, string][])
      : []),
  ];
  const head: OAuthStep[] = [
    { id: 'click', from: 'browser', to: 'client', title: t.click, params: [] },
    {
      id: 'redirect-authorize',
      from: 'client',
      to: 'browser',
      title: t.redirectAuthorize,
      params: authorizeParams,
      note: usePkce ? t.notePkce : t.noteState,
    },
    {
      id: 'authorize',
      from: 'browser',
      to: 'auth',
      title: t.authorize,
      params: authorizeParams.slice(0, 2).concat([['…', t.login]]),
    },
  ];
  if (implicit) {
    return [
      ...head,
      {
        id: 'redirect-token',
        from: 'auth',
        to: 'browser',
        title: t.redirectToken,
        params: [
          ['access_token', SAMPLE.accessToken],
          ['token_type', 'Bearer'],
          ['expires_in', '3600'],
          ['state', SAMPLE.state],
        ],
        note: t.noteImplicit,
        exposes: 'token',
      },
      {
        id: 'fragment',
        from: 'browser',
        to: 'client',
        title: t.readFragment,
        params: [['#access_token', SAMPLE.accessToken]],
      },
      ...bearer(loc),
    ];
  }
  return [
    ...head,
    {
      id: 'redirect-code',
      from: 'auth',
      to: 'browser',
      title: t.redirectCode,
      params: [
        ['code', SAMPLE.code],
        ['state', SAMPLE.state],
      ],
      note: t.noteCode,
      exposes: 'code',
    },
    {
      id: 'callback',
      from: 'browser',
      to: 'client',
      title: t.callback,
      params: [
        ['code', SAMPLE.code],
        ['state', SAMPLE.state],
      ],
      note: t.noteState,
    },
    {
      id: 'token',
      from: 'client',
      to: 'auth',
      title: t.tokenReq,
      params: [
        ['grant_type', 'authorization_code'],
        ['code', SAMPLE.code],
        ['redirect_uri', SAMPLE.redirectUri],
        ['client_id', SAMPLE.clientId],
        ...(usePkce ? ([['code_verifier', SAMPLE.codeVerifier]] as [string, string][]) : []),
      ],
      note: usePkce ? t.noteVerify : t.noteNoPkce,
    },
    {
      id: 'token-res',
      from: 'auth',
      to: 'client',
      title: t.tokenRes,
      params: [
        ['access_token', SAMPLE.accessToken],
        ['token_type', 'Bearer'],
        ['expires_in', '3600'],
        ['refresh_token', SAMPLE.refreshToken],
      ],
    },
    ...bearer(loc),
  ];
}

export type AttackOutcome = 'stolen' | 'blocked' | 'token-leaked' | 'not-applicable';

/**
 * Saldırgan yönlendirmedeki kodu (ya da implicit akışta token'ı) ele geçirirse ne olur?
 * PKCE açıkken saldırganın elinde code_verifier olmadığından /token isteği invalid_grant ile düşer.
 */
export function interceptOutcome(flow: OAuthFlow, pkce: boolean): AttackOutcome {
  if (flow === 'client-credentials') return 'not-applicable';
  if (flow === 'implicit') return 'token-leaked';
  return pkce ? 'blocked' : 'stolen';
}

/** Saldırganın /token isteği (code_verifier olmadan) ve sunucu yanıtı */
export function attackExchange(
  flow: OAuthFlow,
  pkce: boolean,
): { request: [string, string][]; response: string } {
  const outcome = interceptOutcome(flow, pkce);
  const request: [string, string][] = [
    ['grant_type', 'authorization_code'],
    ['code', SAMPLE.code],
    ['redirect_uri', SAMPLE.redirectUri],
    ['client_id', SAMPLE.clientId],
  ];
  if (outcome === 'blocked')
    return {
      request,
      response: '400 { "error": "invalid_grant", "error_description": "code_verifier required" }',
    };
  if (outcome === 'stolen')
    return { request, response: `200 { "access_token": "${SAMPLE.accessToken}", … }` };
  return { request: [], response: '' };
}
