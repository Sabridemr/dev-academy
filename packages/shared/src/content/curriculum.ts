import type { LocalizedString } from '../i18n';
import type { LearningPathManifest, ModuleManifest } from './schema';

/**
 * MÜFREDAT
 * --------
 * Tüm modül ve derslerin tek doğruluk kaynağı. content/ klasörü bu ağaca göre düzenlenir,
 * seed scripti eksik dersleri raporlar, web/mobil navigasyon bu sırayı kullanır.
 */

export interface CurriculumLesson {
  id: string;
  slug: string;
  order: number;
  title: LocalizedString;
  summary: LocalizedString;
  /** Bu derste yer alması beklenen interaktif simülatörler (içerik doğrulaması için ipucu) */
  interactives?: string[];
}

export interface CurriculumModule extends ModuleManifest {
  lessons: CurriculumLesson[];
}

function lesson(
  moduleCode: string,
  order: number,
  slug: string,
  title: LocalizedString,
  summary: LocalizedString,
  interactives?: string[],
): CurriculumLesson {
  const id = `${moduleCode.toLowerCase()}-${String(order).padStart(2, '0')}-${slug}`;
  return { id, slug, order, title, summary, interactives };
}

export const CURRICULUM: CurriculumModule[] = [
  {
    id: 'a-system-design-fundamentals',
    slug: 'system-design-fundamentals',
    code: 'A',
    order: 1,
    title: { tr: 'Sistem Tasarımı Temelleri', en: 'System Design Fundamentals' },
    description: {
      tr: 'İstemci-sunucu modelinden consistent hashing’e, ölçeklenebilir sistemlerin yapı taşları.',
      en: 'From the client-server model to consistent hashing: the building blocks of scalable systems.',
    },
    icon: 'layers',
    color: '#6366f1',
    group: 'system-design',
    lessons: [
      lesson(
        'a',
        1,
        'client-server-dns-http',
        {
          tr: 'İstemci-Sunucu, DNS, HTTP/HTTPS, TCP/UDP, WebSocket',
          en: 'Client-Server, DNS, HTTP/HTTPS, TCP/UDP, WebSocket',
        },
        {
          tr: 'Bir URL yazdığınızda ağda neler olur? DNS çözümlemeden WebSocket akışına.',
          en: 'What happens on the network when you type a URL? From DNS resolution to WebSocket flows.',
        },
      ),
      lesson(
        'a',
        2,
        'latency-throughput-cap',
        {
          tr: 'Gecikme vs. Verimlilik, SLA/SLO, CAP ve Tutarlılık',
          en: 'Latency vs. Throughput, SLA/SLO, CAP and Consistency',
        },
        {
          tr: 'Performans ölçütleri, hizmet seviyeleri, CAP teoremi ve tutarlılık modelleri.',
          en: 'Performance metrics, service levels, the CAP theorem and consistency models.',
        },
        ['cap-theorem'],
      ),
      lesson(
        'a',
        3,
        'horizontal-vertical-scaling',
        { tr: 'Yatay ve Dikey Ölçekleme', en: 'Horizontal and Vertical Scaling' },
        {
          tr: 'Tek sunucu patlıyor → replika ekleniyor: karşılaştırmalı animasyon.',
          en: 'A single server melts down → replicas are added: a side-by-side animation.',
        },
        ['scaling'],
      ),
      lesson(
        'a',
        4,
        'stateless-stateful-sessions',
        {
          tr: 'Stateless vs. Stateful Servisler ve Oturum Yönetimi',
          en: 'Stateless vs. Stateful Services and Session Management',
        },
        {
          tr: 'Durum nerede tutulur? Sticky session, merkezi oturum deposu, JWT.',
          en: 'Where does state live? Sticky sessions, central session stores, JWT.',
        },
      ),
      lesson(
        'a',
        5,
        'load-balancing',
        {
          tr: 'Load Balancer: L4/L7 ve Dağıtım Algoritmaları',
          en: 'Load Balancer: L4/L7 and Distribution Algorithms',
        },
        {
          tr: 'Round-robin, least connections, IP hash, weighted, health check ve sticky session simülatörü.',
          en: 'Round-robin, least connections, IP hash, weighted, health checks and a sticky session simulator.',
        },
        ['load-balancer'],
      ),
      lesson(
        'a',
        6,
        'api-gateway',
        { tr: 'API Gateway', en: 'API Gateway' },
        {
          tr: 'Routing, auth, rate limiting, aggregation, circuit breaker; Gateway vs. Reverse Proxy vs. Service Mesh.',
          en: 'Routing, auth, rate limiting, aggregation, circuit breaker; Gateway vs. Reverse Proxy vs. Service Mesh.',
        },
      ),
      lesson(
        'a',
        7,
        'caching',
        { tr: 'Caching: Katmanlar ve Stratejiler', en: 'Caching: Layers and Strategies' },
        {
          tr: 'Browser → CDN → gateway → uygulama → DB; cache-aside, write-through, write-back, TTL, LRU/LFU.',
          en: 'Browser → CDN → gateway → app → DB; cache-aside, write-through, write-back, TTL, LRU/LFU.',
        },
        ['cache'],
      ),
      lesson(
        'a',
        8,
        'cdn-edge',
        { tr: 'CDN ve Edge Computing', en: 'CDN and Edge Computing' },
        {
          tr: 'Statik içerik dağıtımı, PoP’lar, edge fonksiyonları.',
          en: 'Static content delivery, PoPs, edge functions.',
        },
      ),
      lesson(
        'a',
        9,
        'message-queues-event-driven',
        {
          tr: 'Mesaj Kuyrukları ve Event-Driven Mimari',
          en: 'Message Queues and Event-Driven Architecture',
        },
        {
          tr: 'Kafka, RabbitMQ, SQS; pub/sub, dead-letter queue, idempotency.',
          en: 'Kafka, RabbitMQ, SQS; pub/sub, dead-letter queues, idempotency.',
        },
        ['message-queue'],
      ),
      lesson(
        'a',
        10,
        'rate-limiting',
        { tr: 'Rate Limiting Algoritmaları', en: 'Rate Limiting Algorithms' },
        {
          tr: 'Token bucket, leaky bucket, sliding window — interaktif karşılaştırma.',
          en: 'Token bucket, leaky bucket, sliding window — interactive comparison.',
        },
        ['rate-limiter'],
      ),
      lesson(
        'a',
        11,
        'consistent-hashing-sharding',
        {
          tr: 'Consistent Hashing, Sharding, Partitioning',
          en: 'Consistent Hashing, Sharding, Partitioning',
        },
        {
          tr: 'Animasyonlu halka, sanal düğümler, yeniden dağıtım maliyeti.',
          en: 'Animated ring, virtual nodes, redistribution cost.',
        },
        ['consistent-hashing'],
      ),
      lesson(
        'a',
        12,
        'replication',
        {
          tr: 'Replication: Master-Slave, Master-Master, Leader Election, Quorum',
          en: 'Replication: Leader-Follower, Multi-Leader, Leader Election, Quorum',
        },
        {
          tr: 'Veri kopyalama stratejileri ve quorum simülatörü.',
          en: 'Data replication strategies and a quorum simulator.',
        },
        ['replication-quorum'],
      ),
      lesson(
        'a',
        13,
        'observability-12-factor',
        { tr: 'Observability ve 12-Factor App', en: 'Observability and the 12-Factor App' },
        {
          tr: 'Logging, metrics, tracing; üretim için 12 ilke.',
          en: 'Logging, metrics, tracing; twelve principles for production.',
        },
      ),
    ],
  },
  {
    id: 'b-architectures',
    slug: 'architectures',
    code: 'B',
    order: 2,
    title: { tr: 'Mimariler', en: 'Architectures' },
    description: {
      tr: 'Monolitten mikroservise, serverless’tan multi-region dağıtıma mimari evrim.',
      en: 'Architectural evolution from monolith to microservices, serverless to multi-region.',
    },
    icon: 'boxes',
    color: '#0ea5e9',
    group: 'system-design',
    lessons: [
      lesson(
        'b',
        1,
        'monolith-to-microservices',
        {
          tr: 'Monolith → Modüler Monolith → Mikroservis',
          en: 'Monolith → Modular Monolith → Microservices',
        },
        {
          tr: 'Evrim adımları, ayrıştırma kriterleri, ekip topolojisi.',
          en: 'Evolution steps, decomposition criteria, team topology.',
        },
      ),
      lesson(
        'b',
        2,
        'microservice-communication',
        {
          tr: 'Mikroservis İletişimi: Sync/Async, Saga, CQRS, Event Sourcing',
          en: 'Microservice Communication: Sync/Async, Saga, CQRS, Event Sourcing',
        },
        {
          tr: 'REST/gRPC vs. event; saga koreografi/orkestrasyon; CQRS ve event sourcing.',
          en: 'REST/gRPC vs. events; saga choreography/orchestration; CQRS and event sourcing.',
        },
      ),
      lesson(
        'b',
        3,
        'serverless-bff-clean-ddd',
        {
          tr: 'Serverless, BFF, Hexagonal/Clean Architecture, DDD',
          en: 'Serverless, BFF, Hexagonal/Clean Architecture, DDD',
        },
        {
          tr: 'Fonksiyon tabanlı mimari, istemciye özel backend, port-adaptör, bounded context.',
          en: 'Function-based architecture, client-specific backends, ports & adapters, bounded contexts.',
        },
      ),
      lesson(
        'b',
        4,
        'multi-region-dr',
        {
          tr: 'Multi-Region, Aktif-Aktif/Aktif-Pasif, Disaster Recovery',
          en: 'Multi-Region, Active-Active/Active-Passive, Disaster Recovery',
        },
        {
          tr: 'RPO/RTO, failover animasyonu, veri yerleşimi.',
          en: 'RPO/RTO, failover animation, data residency.',
        },
      ),
    ],
  },
  {
    id: 'c-design-patterns',
    slug: 'design-patterns',
    code: 'C',
    order: 3,
    title: { tr: 'Tasarım Kalıpları', en: 'Design Patterns' },
    description: {
      tr: 'GoF kalıpları ve dağıtık sistem kalıpları: UML, animasyonlu nesne etkileşimi, üç dilde kod.',
      en: 'GoF and distributed-system patterns: UML, animated object interaction, code in three languages.',
    },
    icon: 'puzzle',
    color: '#f59e0b',
    group: 'software',
    lessons: [
      lesson(
        'c',
        1,
        'creational-patterns',
        {
          tr: 'Creational: Singleton, Factory, Abstract Factory, Builder, Prototype',
          en: 'Creational: Singleton, Factory, Abstract Factory, Builder, Prototype',
        },
        {
          tr: 'Nesne üretimini soyutlayan kalıplar.',
          en: 'Patterns that abstract object creation.',
        },
      ),
      lesson(
        'c',
        2,
        'structural-patterns',
        {
          tr: 'Structural: Adapter, Decorator, Facade, Proxy, Composite, Bridge',
          en: 'Structural: Adapter, Decorator, Facade, Proxy, Composite, Bridge',
        },
        {
          tr: 'Sınıf ve nesneleri daha büyük yapılarda birleştiren kalıplar.',
          en: 'Patterns that compose classes and objects into larger structures.',
        },
      ),
      lesson(
        'c',
        3,
        'behavioral-patterns',
        {
          tr: 'Behavioral: Observer, Strategy, Command, State, Chain of Responsibility, Mediator, Template Method',
          en: 'Behavioral: Observer, Strategy, Command, State, Chain of Responsibility, Mediator, Template Method',
        },
        {
          tr: 'Nesneler arası sorumluluk ve iletişim kalıpları.',
          en: 'Patterns for responsibility and communication between objects.',
        },
      ),
      lesson(
        'c',
        4,
        'distributed-patterns',
        {
          tr: 'Dağıtık Sistem Kalıpları: Circuit Breaker, Retry+Backoff, Bulkhead, Sidecar, Strangler Fig, Outbox',
          en: 'Distributed Patterns: Circuit Breaker, Retry+Backoff, Bulkhead, Sidecar, Strangler Fig, Outbox',
        },
        { tr: 'Dayanıklılık ve geçiş kalıpları.', en: 'Resilience and migration patterns.' },
      ),
    ],
  },
  {
    id: 'd-database-design',
    slug: 'database-design',
    code: 'D',
    order: 4,
    title: { tr: 'Veritabanı Tasarımı', en: 'Database Design' },
    description: {
      tr: 'Modelleme, indeksleme, transaction’lar, SQL/NoSQL seçimi ve ölçekleme.',
      en: 'Modeling, indexing, transactions, SQL/NoSQL choice and scaling.',
    },
    icon: 'database',
    color: '#10b981',
    group: 'software',
    lessons: [
      lesson(
        'd',
        1,
        'relational-modeling-normalization',
        {
          tr: 'İlişkisel Modelleme, Normalizasyon (1NF→BCNF), ER Diyagramları',
          en: 'Relational Modeling, Normalization (1NF→BCNF), ER Diagrams',
        },
        {
          tr: 'Interaktif ER çizim aracıyla şema tasarımı.',
          en: 'Schema design with an interactive ER drawing tool.',
        },
        ['er-diagram'],
      ),
      lesson(
        'd',
        2,
        'indexing',
        {
          tr: 'İndeksleme: B-tree, Hash, Composite — Sorgu Planı',
          en: 'Indexing: B-tree, Hash, Composite — Query Plans',
        },
        {
          tr: 'İndeksin sorgu planını nasıl değiştirdiğini animasyonla izleyin.',
          en: 'Watch how an index changes the query plan.',
        },
        ['index-query-plan'],
      ),
      lesson(
        'd',
        3,
        'transactions-acid-isolation',
        {
          tr: 'Transaction, ACID, İzolasyon Seviyeleri, Deadlock',
          en: 'Transactions, ACID, Isolation Levels, Deadlocks',
        },
        {
          tr: 'Dirty read’den serializable’a; deadlock görselleştirmesi.',
          en: 'From dirty reads to serializable; deadlock visualization.',
        },
        ['isolation-levels'],
      ),
      lesson(
        'd',
        4,
        'sql-vs-nosql',
        {
          tr: 'SQL vs NoSQL: Key-Value, Document, Wide-Column, Graph, Time-Series',
          en: 'SQL vs NoSQL: Key-Value, Document, Wide-Column, Graph, Time-Series',
        },
        {
          tr: 'Karşılaştırma matrisi ve seçim rehberi.',
          en: 'Comparison matrix and selection guide.',
        },
      ),
      lesson(
        'd',
        5,
        'read-write-scaling',
        {
          tr: 'Okuma/Yazma Ölçekleme: Read Replica, Connection Pool, Sharding',
          en: 'Read/Write Scaling: Read Replicas, Connection Pools, Sharding',
        },
        {
          tr: 'Replika gecikmesi, havuz boyutlandırma, shard anahtarı seçimi.',
          en: 'Replica lag, pool sizing, shard key selection.',
        },
      ),
      lesson(
        'd',
        6,
        'example-schemas',
        {
          tr: 'Örnek Şemalar: E-ticaret, Sosyal Medya, Ödeme, Mesajlaşma',
          en: 'Example Schemas: E-commerce, Social Media, Payments, Messaging',
        },
        {
          tr: 'Gerçek dünyadan dört şema ve tasarım kararları.',
          en: 'Four real-world schemas and their design decisions.',
        },
        ['er-diagram'],
      ),
    ],
  },
  {
    id: 'e-case-studies',
    slug: 'case-studies',
    code: 'E',
    order: 5,
    title: {
      tr: 'Yüksek Trafikli Sistem Vaka Çalışmaları',
      en: 'High-Traffic System Case Studies',
    },
    description: {
      tr: 'Gereksinim → kapasite → mimari → darboğaz → animasyonlu istek yolculuğu.',
      en: 'Requirements → capacity → architecture → bottlenecks → animated request journey.',
    },
    icon: 'rocket',
    color: '#ef4444',
    group: 'system-design',
    lessons: [
      lesson(
        'e',
        1,
        'amazon-scale-ecommerce',
        { tr: 'Amazon Ölçeğinde E-ticaret', en: 'Amazon-Scale E-commerce' },
        {
          tr: 'Katalog, sepet, sipariş, envanter, ödeme, arama, öneri; Black Friday simülasyonu.',
          en: 'Catalog, cart, orders, inventory, payments, search, recommendations; Black Friday simulation.',
        },
        ['capacity-estimator', 'traffic-wave', 'request-journey'],
      ),
      lesson(
        'e',
        2,
        'video-streaming',
        {
          tr: 'Netflix/YouTube: Video Depolama, Transcoding, CDN, Adaptive Bitrate',
          en: 'Netflix/YouTube: Video Storage, Transcoding, CDN, Adaptive Bitrate',
        },
        {
          tr: 'Upload’dan oynatmaya video boru hattı.',
          en: 'The video pipeline from upload to playback.',
        },
        ['capacity-estimator'],
      ),
      lesson(
        'e',
        3,
        'twitter-timeline',
        {
          tr: 'Twitter/X: Timeline Fan-out, Cache, Trending',
          en: 'Twitter/X: Timeline Fan-out, Cache, Trending',
        },
        {
          tr: 'Fan-out on write vs. read, ünlü problemi.',
          en: 'Fan-out on write vs. read, the celebrity problem.',
        },
        ['fan-out'],
      ),
      lesson(
        'e',
        4,
        'uber-geo-matching',
        {
          tr: 'Uber: Coğrafi İndeksleme, Eşleştirme, Gerçek Zamanlı Konum',
          en: 'Uber: Geo Indexing, Matching, Real-time Location',
        },
        {
          tr: 'Geohash/H3, sürücü eşleştirme, konum akışı.',
          en: 'Geohash/H3, driver matching, location streams.',
        },
        ['geo-index'],
      ),
      lesson(
        'e',
        5,
        'whatsapp-messaging',
        {
          tr: 'WhatsApp: Mesaj Teslimi, Online Durum, Uçtan Uca Şifreleme',
          en: 'WhatsApp: Message Delivery, Presence, End-to-End Encryption',
        },
        {
          tr: 'Teslim garantileri, presence, Signal protokolü kavramsal.',
          en: 'Delivery guarantees, presence, the Signal protocol conceptually.',
        },
      ),
      lesson(
        'e',
        6,
        'classic-interview-systems',
        {
          tr: 'URL Kısaltıcı, Rate Limiter, Notification Servisi',
          en: 'URL Shortener, Rate Limiter, Notification Service',
        },
        {
          tr: 'Klasik mülakat soruları ve çözüm şablonu.',
          en: 'Classic interview questions and a solution template.',
        },
        ['rate-limiter', 'capacity-estimator'],
      ),
    ],
  },
  {
    id: 'f-code-and-infrastructure',
    slug: 'code-and-infrastructure',
    code: 'F',
    order: 6,
    title: {
      tr: 'Kod ve Altyapı: Kod Nerede, Nasıl Tutulur, Nasıl Çalışır?',
      en: 'Code and Infrastructure: Where Code Lives and How It Runs',
    },
    description: {
      tr: 'Amazon benzeri bir şirkette kodun yaşam döngüsü: geliştirici makinesinden production’a.',
      en: 'The lifecycle of code at an Amazon-like company: from a developer laptop to production.',
    },
    icon: 'server',
    color: '#8b5cf6',
    group: 'infrastructure',
    lessons: [
      lesson(
        'f',
        1,
        'servers-datacenters-regions',
        {
          tr: 'Sunucu Türleri ve Veri Merkezi → Region → Availability Zone',
          en: 'Server Types and Data Center → Region → Availability Zone',
        },
        {
          tr: 'Bare metal, VM, container, serverless; fiziksel yerleşim.',
          en: 'Bare metal, VMs, containers, serverless; physical placement.',
        },
      ),
      lesson(
        'f',
        2,
        'code-journey-ci-cd',
        {
          tr: 'Kodun Yolculuğu: Git → CI → Artifact → CD → Canary → Production',
          en: 'The Code Journey: Git → CI → Artifact → CD → Canary → Production',
        },
        {
          tr: 'Monorepo/polyrepo, branching, pipeline, deploy stratejileri — tam animasyonlu.',
          en: 'Monorepo/polyrepo, branching, pipelines, deploy strategies — fully animated.',
        },
        ['pipeline'],
      ),
      lesson(
        'f',
        3,
        'kubernetes-basics',
        {
          tr: 'Kubernetes Temelleri: Pod, Deployment, Service, Ingress, HPA',
          en: 'Kubernetes Basics: Pod, Deployment, Service, Ingress, HPA',
        },
        { tr: 'Otomatik ölçekleme animasyonu.', en: 'Autoscaling animation.' },
        ['kubernetes-hpa'],
      ),
      lesson(
        'f',
        4,
        'iac-config-secrets-flags',
        {
          tr: 'Infrastructure as Code, Konfigürasyon, Secret Yönetimi, Feature Flag’ler',
          en: 'Infrastructure as Code, Configuration, Secrets, Feature Flags',
        },
        {
          tr: 'Terraform, ortam değişkenleri, vault, kademeli açılış.',
          en: 'Terraform, environment variables, vaults, gradual rollout.',
        },
      ),
      lesson(
        'f',
        5,
        'physical-request-path',
        { tr: 'Bir İsteğin Fiziksel Yolu', en: 'The Physical Path of a Request' },
        {
          tr: 'Kullanıcı → DNS → CDN → LB → Gateway → Servis → Cache → DB; hangi katman hangi sunucuda?',
          en: 'User → DNS → CDN → LB → Gateway → Service → Cache → DB; which layer runs on which server?',
        },
        ['request-journey'],
      ),
      lesson(
        'f',
        6,
        'where-data-lives',
        { tr: 'Hangi Veri Nerede Tutulur?', en: 'Where Does Each Kind of Data Live?' },
        {
          tr: 'İlişkisel DB, NoSQL, object storage, cache, data warehouse, log/metrik depoları — veri akış diyagramı.',
          en: 'Relational DB, NoSQL, object storage, cache, data warehouse, log/metric stores — data flow diagram.',
        },
      ),
      lesson(
        'f',
        7,
        'security-layers',
        {
          tr: 'Güvenlik Katmanları: WAF, DDoS, TLS, IAM, Zero-Trust',
          en: 'Security Layers: WAF, DDoS, TLS, IAM, Zero-Trust',
        },
        { tr: 'Derinlemesine savunma.', en: 'Defense in depth.' },
      ),
      lesson(
        'f',
        8,
        'devacademy-architecture',
        { tr: 'DevAcademy’nin Kendi Mimarisi', en: 'DevAcademy’s Own Architecture' },
        {
          tr: 'Bu uygulamanın monorepo, backend, web ve mobil katmanları nasıl çalışıyor?',
          en: 'How this app’s monorepo, backend, web and mobile layers work together.',
        },
      ),
    ],
  },
  {
    id: 'g-artificial-intelligence',
    slug: 'artificial-intelligence',
    code: 'G',
    order: 7,
    title: { tr: 'Yapay Zekâ: ML ve DL', en: 'Artificial Intelligence: ML and DL' },
    description: {
      tr: 'Makine öğrenmesi temellerinden LLM’lere ve üretimde AI sistem tasarımına.',
      en: 'From machine learning fundamentals to LLMs and production AI system design.',
    },
    icon: 'brain',
    color: '#ec4899',
    group: 'ai',
    lessons: [
      lesson(
        'g',
        1,
        'ml-foundations',
        {
          tr: 'ML Temelleri: Öğrenme Türleri, Veri Ayrımı, Overfitting',
          en: 'ML Foundations: Learning Types, Data Splits, Overfitting',
        },
        {
          tr: 'Supervised/unsupervised/reinforcement; overfitting animasyonu.',
          en: 'Supervised/unsupervised/reinforcement; overfitting animation.',
        },
      ),
      lesson(
        'g',
        2,
        'classical-algorithms',
        {
          tr: 'Klasik Algoritmalar: Regresyon, Ağaçlar, SVM, k-means, PCA',
          en: 'Classical Algorithms: Regression, Trees, SVM, k-means, PCA',
        },
        {
          tr: 'İnteraktif gradient descent ve nokta bulutu görselleştirmeleri.',
          en: 'Interactive gradient descent and point-cloud visualizations.',
        },
        ['gradient-descent', 'k-means', 'decision-tree'],
      ),
      lesson(
        'g',
        3,
        'neural-networks',
        {
          tr: 'Sinir Ağları: Nöron, Aktivasyon, Forward/Backward Propagation',
          en: 'Neural Networks: Neurons, Activations, Forward/Backward Propagation',
        },
        {
          tr: 'Adım adım ileri ve geri yayılım animasyonu, loss yüzeyi.',
          en: 'Step-by-step forward and backward propagation, loss surface.',
        },
      ),
      lesson(
        'g',
        4,
        'deep-learning-architectures',
        {
          tr: 'Derin Öğrenme Mimarileri: CNN, RNN/LSTM, Transformer, GAN, Diffusion',
          en: 'Deep Learning Architectures: CNN, RNN/LSTM, Transformer, GAN, Diffusion',
        },
        {
          tr: 'Konvolüsyon filtresi ve self-attention görselleştirmesi.',
          en: 'Convolution filter and self-attention visualization.',
        },
        ['convolution', 'attention'],
      ),
      lesson(
        'g',
        5,
        'llms',
        {
          tr: 'LLM’ler: Tokenization, Embedding, Pretraining/Fine-tuning, RAG, Agent’lar',
          en: 'LLMs: Tokenization, Embeddings, Pretraining/Fine-tuning, RAG, Agents',
        },
        {
          tr: 'Token’dan agent’a büyük dil modelleri.',
          en: 'Large language models from tokens to agents.',
        },
        ['tokenizer', 'embedding-space'],
      ),
      lesson(
        'g',
        6,
        'mlops',
        {
          tr: 'MLOps: Veri Pipeline, Feature Store, Eğitim, Serving, A/B, Drift',
          en: 'MLOps: Data Pipelines, Feature Store, Training, Serving, A/B, Drift',
        },
        {
          tr: 'Modelin üretime giden yolu ve izlenmesi.',
          en: 'The model’s path to production and its monitoring.',
        },
      ),
      lesson(
        'g',
        7,
        'production-ai-systems',
        {
          tr: 'Üretimde AI Sistem Tasarımı: Öneri, Arama Sıralaması, Fraud',
          en: 'Production AI System Design: Recommendations, Search Ranking, Fraud',
        },
        {
          tr: 'Amazon öneri sistemi örneğiyle ölçekli mimari.',
          en: 'Scaled architecture using Amazon’s recommender as the example.',
        },
      ),
      lesson(
        'g',
        8,
        'nn-playground',
        {
          tr: 'Mini Playground: Tarayıcıda Sinir Ağı Eğitme',
          en: 'Mini Playground: Train a Neural Network in the Browser',
        },
        {
          tr: 'TensorFlow.js ile ağırlık değişimini canlı izleyin.',
          en: 'Watch weights change live with TensorFlow.js.',
        },
        ['neural-network-playground'],
      ),
    ],
  },
  {
    id: 'h-devops-tools',
    slug: 'devops-tools',
    code: 'H',
    order: 8,
    title: { tr: 'DevOps ve Araçlar', en: 'DevOps and Tooling' },
    description: {
      tr: "Linux, sunucu yönetimi, Git, Docker, CI/CD, Grafana ve DevOps'ta yapay zekâ: kişisel notlar ve rehberler.",
      en: 'Linux, server management, Git, Docker, CI/CD, Grafana and AI in DevOps: personal notes and guides.',
    },
    icon: 'container',
    color: '#0ea5e9',
    group: 'infrastructure',
    lessons: [
      lesson(
        'h',
        1,
        'linux-notes',
        { tr: 'Linux Temelleri: Terminal, Dosya Sistemi ve İzinler', en: 'Linux Basics: Terminal, File System and Permissions' },
        {
          tr: "Linux'a giriş, mimari, dosya sistemi, gezinme, dosya ve dizin komutları, izinler, metin işleme, süreç, disk, ağ ve paket yönetimi, shell betikleri, gerçek projelerde kullanım ve mülakat sorularını kapsar.",
          en: 'Covers an introduction to Linux, its architecture, file system, navigation, file and directory commands, permissions, text processing, process, disk, network and package management, shell scripting, real-project usage and interview questions.',
        },
      ),
      lesson(
        'h',
        2,
        'linux-temelleri-vps-kurulumu-ve-guvenlik',
        {
          tr: 'Linux ve VPS Kullanım Rehberi: Linux Temelleri, VPS Kurulumu ve Güvenlik',
          en: 'Linux and VPS Usage Guide: Linux Basics, VPS Setup and Security',
        },
        {
          tr: 'Linux dağıtımları, dosya sistemi, terminal komutları, kullanıcı ve izinler, paket, süreç ve servis yönetimi, ağ temelleri ile VPS seçimi, SSH bağlantısı, ilk güvenlik sıkılaştırması ve DNS ayarını kapsar.',
          en: 'Covers Linux distributions, the file system, terminal commands, users and permissions, package, process and service management, networking basics, plus choosing a VPS, connecting over SSH, initial security hardening and DNS setup.',
        },
      ),
      lesson(
        'h',
        3,
        'canliya-alma-yedekleme-ve-bakim',
        {
          tr: 'Linux ve VPS Kullanım Rehberi: Canlıya Alma, Yedekleme ve Bakım',
          en: 'Linux and VPS Usage Guide: Deployment, Backups and Maintenance',
        },
        {
          tr: 'Statik site, systemd ile Node.js, Docker Compose ve Coolify ile canlıya alma yöntemlerini, GitHub Actions ile otomatik yayını, yedekleme, izleme, sorun giderme ve canlıya alma kontrol listesini kapsar.',
          en: 'Covers deployment methods with a static site, Node.js under systemd, Docker Compose and Coolify, automated deployment with GitHub Actions, backups, monitoring, troubleshooting and the go-live checklist.',
        },
      ),
      lesson(
        'h',
        4,
        'git-notes',
        { tr: 'Git: Commit Grafiği, Dallanma, Merge ve Rebase', en: 'Git: Commit Graph, Branching, Merge and Rebase' },
        {
          tr: "Git'e giriş, mimari ve yaşam döngüsü, kurulum, temel komutlar, iş akışı, dallanma, merge ve rebase, uzak depolar, geri alma, stash ve etiketler, GitHub iş birliği, QA ve CI/CD kullanımı, sık hatalar, ileri komutlar ve mülakat sorularını kapsar.",
          en: 'Covers an introduction to Git, its architecture and lifecycle, installation, essential commands, workflow, branching, merge and rebase, remote repositories, undo and recovery, stash and tags, GitHub collaboration, use in QA and CI/CD, common errors, advanced commands and interview questions.',
        },
      ),
      lesson(
        'h',
        5,
        'devops-ve-docker-kullanim-rehberi',
        { tr: 'DevOps ve Docker Kullanım Rehberi', en: 'DevOps and Docker Usage Guide' },
        {
          tr: 'DevOps ilkeleri, Git, Docker ve Dockerfile, volume ve ağ, Docker Compose, GitHub Actions ile CI/CD, sunucu hazırlığı, IaC, Kubernetes, izleme, yedekleme, güvenlik ve sorun giderme konularını başlangıçtan üretime kadar ele alır.',
          en: 'Covers DevOps principles, Git, Docker and Dockerfiles, volumes and networking, Docker Compose, CI/CD with GitHub Actions, server preparation, IaC, Kubernetes, monitoring, backups, security and troubleshooting from getting started to production.',
        },
      ),
      lesson(
        'h',
        6,
        'cicd-temelleri-ve-ilk-workflow',
        {
          tr: 'CI/CD ve GitHub Actions: Temeller, Pipeline ve İlk Workflow',
          en: 'CI/CD and GitHub Actions: Fundamentals, Pipeline and First Workflow',
        },
        {
          tr: 'CI/CD kavramları, CI ile iki farklı CD arasındaki fark, pipeline aşamaları, ortamlar, Git dallanma stratejileri, branch protection, GitHub Actions temel kavramları, YAML temelleri ve ilk workflow dosyası.',
          en: 'CI/CD concepts, the difference between CI and the two kinds of CD, pipeline stages, environments, Git branching strategies, branch protection, GitHub Actions core concepts, YAML basics and the first workflow file.',
        },
      ),
      lesson(
        'h',
        7,
        'tetikleyiciler-secrets-cache-ve-testler',
        {
          tr: 'CI/CD ve GitHub Actions: Tetikleyiciler, İfadeler, Secrets, Matrix, Cache ve Testler',
          en: 'CI/CD and GitHub Actions: Triggers, Expressions, Secrets, Matrix, Cache and Tests',
        },
        {
          tr: "Workflow tetikleyicileri, job bağımlılıkları, koşullar ve context'ler, ortam değişkenleri ve çıktılar, secrets ve variables, matrix, cache, artifact, PostgreSQL ile entegrasyon testi ve test piramidi.",
          en: 'Workflow triggers, job dependencies, conditions and contexts, environment variables and outputs, secrets and variables, matrix, cache, artifacts, integration testing with PostgreSQL and the test pyramid.',
        },
      ),
      lesson(
        'h',
        8,
        'docker-deploy-ve-guvenlik',
        {
          tr: 'CI/CD ve GitHub Actions: Docker, Deploy, Rollback ve Güvenlik',
          en: 'CI/CD and GitHub Actions: Docker, Deployment, Rollback and Security',
        },
        {
          tr: "Docker ile konteyner tabanlı CI/CD, deploy yöntemleri, environments ve onay kapıları, veritabanı migration'ları, deployment stratejileri, rollback, concurrency, reusable workflow ve composite action, runner türleri, güvenlik ve izinler.",
          en: 'Container-based CI/CD with Docker, deployment methods, environments and approval gates, database migrations, deployment strategies, rollback, concurrency, reusable workflows and composite actions, runner types, security and permissions.',
        },
      ),
      lesson(
        'h',
        9,
        'kalite-izleme-ve-tam-pipeline',
        {
          tr: 'CI/CD ve GitHub Actions: Kod Kalitesi, Sürümleme, İzleme ve Tam Pipeline',
          en: 'CI/CD and GitHub Actions: Code Quality, Versioning, Monitoring and the Full Pipeline',
        },
        {
          tr: 'Kod kalitesi ve güvenlik taraması, sürümleme ve release, izleme ve bildirimler, hata ayıklama, maliyet ve limitler, diğer CI/CD araçları ve toptan gıda e-ticaret projesi için tam pipeline.',
          en: 'Code quality and security scanning, versioning and releases, monitoring and notifications, debugging, cost and limits, other CI/CD tools and a complete pipeline for the wholesale food e-commerce project.',
        },
      ),
      lesson(
        'h',
        10,
        'mulakat-soru-cevap-ve-ozet',
        {
          tr: 'CI/CD ve GitHub Actions: Mülakat Soru-Cevap ve Tek Sayfalık Özet',
          en: 'CI/CD and GitHub Actions: Interview Q&A and One-Page Summary',
        },
        {
          tr: 'CI/CD ve GitHub Actions üzerine 30 mülakat sorusu ile cevapları ve rehberin tek sayfalık özeti.',
          en: 'Thirty interview questions and answers on CI/CD and GitHub Actions, plus a one-page summary of the guide.',
        },
      ),
      lesson(
        'h',
        11,
        'grafana-notes',
        { tr: 'Gözlemlenebilirlik: Prometheus, Grafana ve Alarmlar', en: 'Observability: Prometheus, Grafana and Alerting' },
        {
          tr: 'Grafana mimarisini, veri kaynaklarını, dashboard ve panelleri, PromQL ve LogQL sorgularını, uyarıları, log-metrik-trace gözlemlenebilirliğini, gerçek dünya izleme senaryolarını ve performans en iyi uygulamalarını kapsar.',
          en: 'Covers Grafana architecture, data sources, dashboards and panels, PromQL and LogQL queries, alerting, logs-metrics-traces observability, real-world monitoring scenarios and performance best practices.',
        },
      ),
      lesson(
        'h',
        12,
        'ai-for-devops-notes',
        { tr: 'DevOps’ta Yapay Zekâ: AIOps, Log Analizi ve Sorumlu Kullanım', en: 'AI in DevOps: AIOps, Log Analysis and Responsible Use' },
        {
          tr: "Yapay zekânın CI/CD, altyapı yönetimi, izleme ve gözlemlenebilirlik, AIOps, olay yönetimi, log analizi, bulut maliyeti, DevSecOps, otomasyon, kodlama asistanları, Kubernetes ve Docker'da kullanımını, araçları, en iyi uygulamaları ve mülakat sorularını kapsar.",
          en: 'Covers how AI is used in CI/CD, infrastructure management, monitoring and observability, AIOps, incident management, log analysis, cloud cost, DevSecOps, automation, coding assistants, Kubernetes and Docker, along with tools, best practices and interview questions.',
        },
      ),
    ],
  },
  {
    id: 'i-api-sql-testing',
    slug: 'api-sql-testing',
    code: 'I',
    order: 9,
    title: { tr: 'API, SQL ve Test', en: 'APIs, SQL and Testing' },
    description: {
      tr: 'API nasıl oluşturulur ve çağrılır, REST tasarımı, API testleri ve SQL: kişisel notlar ve rehberler.',
      en: 'How APIs are built and called, REST design, API testing and SQL: personal notes and guides.',
    },
    icon: 'route',
    color: '#f97316',
    group: 'software',
    lessons: [
      lesson(
        'i',
        1,
        'how-apis-are-created-and-called',
        {
          tr: 'API Nasıl Oluşturulur? / API Çağrıldığında Ne Olur?',
          en: 'How to Create an API? / What Happens When an API is Called?',
        },
        {
          tr: 'Node.js, Express ve MongoDB ile planlamadan yayına 9 adımda uçtan uca API oluşturmayı ve bir API çağrısının istemciden arayüz güncellemesine kadar izlediği 10 adımlık akışı anlatır.',
          en: 'Covers building an API end to end in 9 steps with Node.js, Express and MongoDB, from planning to deployment, and the 10-step flow an API call follows from the client to the UI update.',
        },
      ),
      lesson(
        'i',
        2,
        'api-ve-rest-api-temeller-ve-guvenlik',
        {
          tr: 'API ve REST API: Temeller, HTTP, Kimlik Doğrulama, CORS ve Postman ile Test',
          en: 'API and REST API: Fundamentals, HTTP, Authentication, CORS and Testing with Postman',
        },
        {
          tr: "API ve REST kavramlarını, HTTP yöntemlerini, durum kodlarını, header'ları, kimlik doğrulama ve yetkilendirmeyi, API key, JWT ve OAuth 2.0'ı, CORS'u, rate limiting'i, API Gateway'i ve Postman ile API testini toptan gıda e-ticareti örnekleriyle anlatır.",
          en: 'Explains API and REST concepts, HTTP methods, status codes, headers, authentication and authorization, API keys, JWT and OAuth 2.0, CORS, rate limiting, API Gateway and API testing with Postman using wholesale food e-commerce examples.',
        },
      ),
      lesson(
        'i',
        3,
        'api-ve-rest-api-tasarim-guvenlik-ve-idempotency',
        {
          tr: 'API ve REST API: Versiyonlama, Webhook, Pagination, Dokümantasyon, Güvenlik ve Idempotency',
          en: 'API and REST API: Versioning, Webhooks, Pagination, Documentation, Security and Idempotency',
        },
        {
          tr: "API versiyonlamayı, latency'yi, senkron ve asenkron API'leri, webhook'ları, parametreleri, pagination'ı, hata yönetimini, OpenAPI ve schema'yı, REST'in SOAP ve GraphQL ile farkını, HATEOAS'ı, tasarım ilkelerini, API güvenliğini ve idempotency'yi anlatır.",
          en: 'Covers API versioning, latency, synchronous and asynchronous APIs, webhooks, parameters, pagination, error handling, OpenAPI and schemas, REST vs SOAP and GraphQL, HATEOAS, design principles, API security and idempotency.',
        },
      ),
      lesson(
        'i',
        4,
        'api-ve-rest-api-uctan-uca-ornek-ve-mulakat',
        {
          tr: 'API ve REST API: Uçtan Uca E-ticaret Örneği, Mülakat Soru-Cevap ve Özet',
          en: 'API and REST API: End-to-End E-commerce Example, Interview Q&A and Summary',
        },
        {
          tr: 'Toptan satış sitesi için örnek endpoint yapısını, uçtan uca sipariş akışını, Google ile giriş (OAuth 2.0) akışını, PostgreSQL veritabanı taslağını ve Postman koleksiyonunu anlatır; ardından 30 mülakat sorusu ve tek sayfalık özet tablolarını verir.',
          en: 'Presents a sample endpoint structure for a wholesale site, the end-to-end order flow, the Sign in with Google (OAuth 2.0) flow, a PostgreSQL database draft and the Postman collection, followed by 30 interview questions and one-page summary tables.',
        },
      ),
      lesson(
        'i',
        5,
        'api-testing-notes',
        { tr: 'API Testi: Piramit, Contract Test ve Yük Testi', en: 'API Testing: Pyramid, Contract Tests and Load Tests' },
        {
          tr: 'HTTP temelleri, metotlar, istek ve yanıt yapısı, durum kodları, kimlik doğrulama, JSON ve JSONPath, test iş akışı ve doğrulama, Postman, REST Assured, mülakat soruları ve hata ayıklamayı kapsayan API testi notları.',
          en: 'API testing notes covering HTTP fundamentals, methods, request and response structure, status codes, authentication, JSON and JSONPath, testing workflow and validation, Postman, REST Assured, interview questions and debugging.',
        },
      ),
      lesson(
        'i',
        6,
        'sql-notes',
        { tr: 'SQL: JOIN, Toplama, Transaction ve İndeksler', en: 'SQL: Joins, Aggregation, Transactions and Indexes' },
        {
          tr: 'SQL temellerinden SELECT, filtreleme, sıralama, aggregate fonksiyonlar, GROUP BY, JOIN, alt sorgular, CASE, DDL, DML, TCL, kısıtlar, indeksler, view ve window fonksiyonlarına, mülakat özetiyle birlikte.',
          en: 'From SQL basics through SELECT, filtering, sorting, aggregate functions, GROUP BY, joins, subqueries, CASE, DDL, DML, TCL, constraints, indexes, views and window functions, with an interview cheat sheet.',
        },
      ),
    ],
  },
  {
    id: 'j-system-design-notes',
    slug: 'system-design-notes',
    code: 'J',
    order: 10,
    title: { tr: 'Sistem Tasarımı Notları ve Vakalar', en: 'System Design Notes and Case Studies' },
    description: {
      tr: 'Temel sistem tasarımı kalıpları, Redis ve Kafka, Amazon ölçeğinde e-ticaret ve yemek siparişi platformu tasarımı.',
      en: 'Core system design patterns, Redis and Kafka, Amazon-scale e-commerce and a food delivery platform design.',
    },
    icon: 'network',
    color: '#14b8a6',
    group: 'system-design',
    lessons: [
      lesson(
        'j',
        1,
        'must-know-system-design-patterns',
        {
          tr: 'Bilinmesi Gereken 15 Sistem Tasarımı Kalıbı',
          en: 'Top 15 Must-Know System Design Patterns',
        },
        {
          tr: 'Load balancer, caching, replikasyon, sharding, mesaj kuyruğu, event-driven mimari, API gateway, circuit breaker, CQRS, saga, rate limiting, distributed lock, service discovery ve CDN kalıplarını mülakat ipuçlarıyla anlatan el yazısı notlar.',
          en: 'Handwritten notes covering load balancing, caching, replication, sharding, message queues, event-driven architecture, API gateway, circuit breaker, CQRS, saga, rate limiting, distributed lock, service discovery and CDN with interview tips.',
        },
      ),
      lesson(
        'j',
        2,
        'system-design-notes-part-1',
        { tr: 'Sistem Tasarımı Mülakat Çerçevesi ve Kapasite Tahmini', en: 'System Design Interview Framework and Capacity Estimation' },
        {
          tr: "Sistem tasarımının temel kavramlarını, gereksinimleri, istek yaşam döngüsünü, mülakat akışını, temel bileşenleri, API ve veritabanı tasarımını, indekslemeyi, önbelleklemeyi, CDN'i, yük dengelemeyi, ölçeklemeyi ve monolit ile mikroservis karşılaştırmasını anlatan notlar.",
          en: 'Notes covering system design fundamentals, requirements, the request lifecycle, interview workflow, core components, API and database design, indexing, caching, CDN, load balancing, scaling and monolith versus microservices.',
        },
      ),
      lesson(
        'j',
        3,
        'system-design-with-redis-and-kafka',
        { tr: 'Redis ve Kafka ile Sistem Tasarımı', en: 'System Design with Redis and Kafka' },
        {
          tr: "Sistem tasarımı temelleri, mimariler, ağ, veritabanları, önbellekleme, dağıtık sistemler, mesajlaşma, ölçeklenebilirlik, depolama ve güvenlikten Redis ve Kafka'nın ayrıntılarına ve gerçek bir yemek siparişi sistem tasarımına kadar uzanan notlar.",
          en: 'Notes spanning system design fundamentals, architectures, networking, databases, caching, distributed systems, messaging, scalability, storage and security through Redis and Kafka in depth and a real food-delivery system design.',
        },
      ),
      lesson(
        'j',
        4,
        'amazon-mimari-veri-ve-siparis-akisi',
        {
          tr: 'Amazon Ölçeğinde E-Ticaret Sistem Tasarımı: Mimari, Veri ve Sipariş Akışı',
          en: 'Amazon-Scale E-Commerce System Design: Architecture, Data and Order Flow',
        },
        {
          tr: 'Tek sunucudan mikroservise büyüme evrelerini, global altyapıyı, uçtan uca mimariyi, bir isteğin yolculuğunu, önbelleklemeyi, veritabanı ölçeklemeyi, son 1 ürün problemini, Saga ile sipariş-ödeme akışını ve arama, öneri ve fiyat servislerini ele alır.',
          en: 'Covers the growth stages from a single server to microservices, global infrastructure, end-to-end architecture, the journey of a request, caching, database scaling, the last-item problem, the order-payment flow with Saga, and search, recommendation and pricing services.',
        },
      ),
      lesson(
        'j',
        5,
        'amazon-dayaniklilik-mesajlasma-ve-isletim',
        {
          tr: 'Amazon Ölçeğinde E-Ticaret Sistem Tasarımı: Dayanıklılık, Mesajlaşma ve İşletim',
          en: 'Amazon-Scale E-Commerce System Design: Resilience, Messaging and Operations',
        },
        {
          tr: "Güvenilirlik desenlerini, güvenliği, DevOps ve gözlemlenebilirliği, kampanya günü hazırlığını, kapasite hesabını, Kafka, RabbitMQ ve SQS ile mesajlaşmayı, servis iletişimini, Kubernetes'i, yardımcı servisleri ve kendi projen için yol haritasını ele alır.",
          en: 'Covers reliability patterns, security, DevOps and observability, campaign-day preparation, capacity estimation, messaging with Kafka, RabbitMQ and SQS, service communication, Kubernetes, supporting services and a roadmap for your own project.',
        },
      ),
      lesson(
        'j',
        6,
        'giris-mimari-ve-siparis-akisi',
        {
          tr: 'Yemek Siparişi Platformu: Giriş, Yüksek Seviye Mimari ve Sipariş Akışı',
          en: 'Food Delivery Platform: Introduction, High-Level Architecture and Order Flow',
        },
        {
          tr: 'Rehberin kapsamı, sistem tasarımı mülakat adımları ve gereksinimler, mikroservis tabanlı yüksek seviye mimari ile uçtan uca kullanıcı yolculuğu ve sipariş akışı.',
          en: 'The guide scope, system design interview steps and requirements, the microservice-based high-level architecture, and the end-to-end user journey and order flow.',
        },
      ),
      lesson(
        'j',
        7,
        'kesif-menu-ve-siparis-servisi',
        {
          tr: 'Yemek Siparişi Platformu: Restoran Keşfi, Menü ve Sipariş Servisi',
          en: 'Food Delivery Platform: Restaurant Discovery, Menu and Order Service',
        },
        {
          tr: 'Elasticsearch ve Redis ile restoran arama, restoran ve menü servisinin veri modeli ve önbellek stratejisi, sipariş servisinin durum makinesi, Saga ve Outbox desenleri.',
          en: 'Restaurant search with Elasticsearch and Redis, the restaurant and menu service data model and caching strategy, and the order service state machine with the Saga and Outbox patterns.',
        },
      ),
      lesson(
        'j',
        8,
        'sepet-odeme-ve-kurye-atama',
        {
          tr: 'Yemek Siparişi Platformu: Sepet, Ödeme ve Kurye Atama',
          en: 'Food Delivery Platform: Cart, Payment and Courier Assignment',
        },
        {
          tr: 'Redis tabanlı sepet ve checkout akışı, ödeme sisteminin mimarisi, durumları, şeması ve webhook yönetimi ile puanlama algoritması ve Redis Geo kullanan kurye atama sistemi.',
          en: 'The Redis-based cart and checkout flow, the payment system architecture, states, schema and webhook handling, and the courier assignment system using a scoring algorithm and Redis Geo.',
        },
      ),
      lesson(
        'j',
        9,
        'takip-bildirim-ve-kampanyalar',
        {
          tr: 'Yemek Siparişi Platformu: Gerçek Zamanlı Takip, Bildirim ve Kupon Sistemleri',
          en: 'Food Delivery Platform: Real-Time Tracking, Notification and Coupon Systems',
        },
        {
          tr: 'WebSocket, polling ve SSE ile gerçek zamanlı sipariş takibi ve ETA hesaplama, çok kanallı bildirim sistemi ve hata yönetimi ile kupon ve kampanya doğrulama ve indirim hesaplama.',
          en: 'Real-time order tracking with WebSocket, polling and SSE plus ETA calculation, the multi-channel notification system and failure handling, and coupon and campaign validation and discount calculation.',
        },
      ),
      lesson(
        'j',
        10,
        'sadakat-olcekleme-ve-en-iyi-uygulamalar',
        {
          tr: 'Yemek Siparişi Platformu: Sadakat, Takip Sistemini Ölçekleme ve En İyi Uygulamalar',
          en: 'Food Delivery Platform: Loyalty, Scaling the Tracking System and Best Practices',
        },
        {
          tr: 'Sadakat ve davet sisteminin akışları ve veri modeli, takip sistemini Redis GeoHash, Kafka ve WebSocket ile ölçekleme, ardından en iyi uygulamalar, gerçek dünyadan dersler ve nihai teknoloji yığını.',
          en: 'The flows and data model of the loyalty and referral system, scaling the tracking system with Redis GeoHash, Kafka and WebSocket, followed by best practices, real-world lessons and the final technology stack.',
        },
      ),
      lesson(
        'j',
        11,
        'odunlesimler-mulakat-ve-ozet',
        {
          tr: 'Yemek Siparişi Platformu: Ödünleşimler, Mülakat Soruları ve Özet',
          en: 'Food Delivery Platform: Trade-offs, Interview Questions and Summary',
        },
        {
          tr: 'Sistem tasarımı ödünleşimleri (SQL ve NoSQL, CAP, eventual consistency, ölçekleme), örnek cevaplı mülakat soruları, proje yol haritası, sonraki adımlar ve tek sayfalık özet.',
          en: 'System design trade-offs (SQL vs NoSQL, CAP, eventual consistency, scaling), interview questions with sample answers, a project roadmap, next steps and a one-page summary.',
        },
      ),
    ],
  },
  {
    id: 'k-python',
    slug: 'python',
    code: 'K',
    order: 11,
    title: { tr: "Python: Sıfırdan İleri Seviyeye", en: "Python: From Zero to Advanced" },
    description: {
      tr: "Değişkenler ve bellek modelinden fonksiyonlara, OOP'ye ve dependency injection'a: her konu satır satır kod simülasyonuyla.",
      en: "From variables and the memory model to functions, OOP and dependency injection: every topic with line-by-line code simulations.",
    },
    icon: 'code',
    color: '#3776ab',
    group: 'programming',
    lessons: [
      lesson('k', 1, "python-nasil-calisir", { tr: "Python Nasıl Çalışır: Yorumlayıcı, Bytecode ve İlk Program", en: "How Python Runs: Interpreter, Bytecode and Your First Program" }, { tr: "Python kodunun bytecode'a dönüşüp satır satır çalışmasını izleyerek ilk programını yaz.", en: "Write your first program while watching Python compile to bytecode and run line by line." }),
      lesson('k', 2, "degiskenler-ve-bellek-modeli", { tr: "Değişkenler ve Bellek Modeli: İsimler, Nesneler ve Referanslar", en: "Variables and the Memory Model: Names, Objects and References" }, { tr: "Değişkenin kutu değil etiket olduğunu; stack, heap, id() ve değiştirilebilirliği simülasyonla gör.", en: "See that variables are labels, not boxes: stack, heap, id() and mutability, simulated." }),
      lesson('k', 3, "veri-tipleri-ve-operatorler", { tr: "Temel Veri Tipleri ve Operatörler", en: "Core Data Types and Operators" }, { tr: "int, float, str, bool ve None ile çalış; operatörleri, dönüşümleri ve string işlemlerini öğren.", en: "Work with int, float, str, bool and None; learn operators, conversions and string operations." }),
      lesson('k', 4, "kosullar-ve-donguler", { tr: "Kontrol Akışı: Koşullar ve Döngüler", en: "Control Flow: Conditions and Loops" }, { tr: "if/elif/else, while, for ve range ile programın akışını adım adım yönetmeyi öğren.", en: "Learn to steer a program step by step with if/elif/else, while, for and range." }),
      lesson('k', 5, "koleksiyonlar-ve-kopyalama", { tr: "Koleksiyonlar: list, tuple, dict, set ve Kopyalama", en: "Collections: list, tuple, dict, set and Copying" }, { tr: "Dört temel koleksiyonu, takma ad tuzağını ve sığ/derin kopyayı bellekte izle.", en: "Track the four core collections, the aliasing trap and shallow vs deep copies in memory." }),
      lesson('k', 6, "fonksiyonlar-ve-cagri-yigini", { tr: "Fonksiyonlar, Parametreler ve Çağrı Yığını", en: "Functions, Parameters and the Call Stack" }, { tr: "Fonksiyon çağrısında açılan çerçeveyi, parametre aktarımını ve return'ü yığında adım adım gör.", en: "Watch frames get pushed, arguments passed and values returned on the call stack." }),
      lesson('k', 7, "kapsam-closure-ve-dekoratorler", { tr: "Kapsam (LEGB), Closure ve Dekoratörler", en: "Scope (LEGB), Closures and Decorators" }, { tr: "İsimlerin nerede arandığını, closure'ın değişkeni nasıl yakaladığını ve dekoratörleri öğren.", en: "Learn where names are looked up, how closures capture variables and how decorators work." }),
      lesson('k', 8, "ozyineleme", { tr: "Özyineleme (Recursion) ve Yığın Derinliği", en: "Recursion and Stack Depth" }, { tr: "Kendini çağıran fonksiyonların yığını nasıl büyütüp küçülttüğünü ve sınırlarını gör.", en: "See how self-calling functions grow and shrink the stack, and where their limits are." }),
      lesson('k', 9, "comprehension-ve-fonksiyonel-araclar", { tr: "Comprehension, lambda ve Fonksiyonel Araçlar", en: "Comprehensions, lambda and Functional Tools" }, { tr: "Comprehension, lambda, map, filter, sorted ve zip ile kısa ve okunur kod yaz.", en: "Write short, readable code with comprehensions, lambda, map, filter, sorted and zip." }),
      lesson('k', 10, "hatalar-istisnalar-ve-dosyalar", { tr: "Hatalar, İstisnalar, Dosyalar ve Context Manager", en: "Errors, Exceptions, Files and Context Managers" }, { tr: "try/except/finally, kendi istisnaların, with bloğu ve dosya okuma/yazmayı öğren.", en: "Learn try/except/finally, custom exceptions, the with statement and file I/O." }, ["regex-playground"]),
      lesson('k', 11, "iterator-ve-generator", { tr: "Iterator ve Generator: Tembel Hesaplama", en: "Iterators and Generators: Lazy Evaluation" }, { tr: "for döngüsünün arkasındaki iterator protokolünü ve yield ile duraklayan fonksiyonları gör.", en: "See the iterator protocol behind for loops and functions that pause with yield." }),
      lesson('k', 12, "siniflar-ve-nesneler", { tr: "OOP 1: Sınıflar, Nesneler ve self", en: "OOP 1: Classes, Objects and self" }, { tr: "Sınıf ile nesne farkını, __init__ ve self'i, örnek ve sınıf niteliklerini bellekte izle.", en: "Track classes vs objects, __init__ and self, instance and class attributes in memory." }),
      lesson('k', 13, "kalitim-ve-polimorfizm", { tr: "OOP 2: Kalıtım, Polimorfizm, super() ve MRO", en: "OOP 2: Inheritance, Polymorphism, super() and MRO" }, { tr: "Kalıtımla kodu yeniden kullan, polimorfizmi uygula; super() ve metot arama sırasını kavra.", en: "Reuse code with inheritance, apply polymorphism and understand super() and method lookup." }),
      lesson('k', 14, "dunder-property-ve-dataclass", { tr: "OOP 3: Özel Metotlar, property, dataclass ve Kapsülleme", en: "OOP 3: Dunder Methods, property, dataclass and Encapsulation" }, { tr: "Özel metotlar, property, dataclass ve soyut sınıflarla temiz nesneler tasarla.", en: "Design clean objects with dunder methods, properties, dataclasses and abstract classes." }),
      lesson('k', 15, "moduller-paketler-ve-tip-ipuclari", { tr: "Modüller, Paketler, Sanal Ortam ve Tip İpuçları", en: "Modules, Packages, Virtual Environments and Type Hints" }, { tr: "import sistemini, venv ve pip'i, tip ipuçlarını ve Protocol ile arayüz tanımlamayı öğren.", en: "Learn imports, venv and pip, type hints and defining interfaces with Protocol." }),
      lesson('k', 16, "solid-ve-dependency-injection", { tr: "SOLID ve Dependency Injection", en: "SOLID and Dependency Injection" }, { tr: "Bağımlılıkları dışarıdan vererek test edilebilir, gevşek bağlı Python kodu tasarla.", en: "Design testable, loosely coupled Python code by injecting dependencies from outside." }),
      lesson('k', 17, "bellek-yonetimi-ve-gc", { tr: "Bellek Yönetimi: Referans Sayımı ve Çöp Toplayıcı", en: "Memory Management: Reference Counting and Garbage Collection" }, { tr: "Nesnelerin ne zaman silindiğini, döngüsel referansları ve __slots__'u öğren.", en: "Learn when objects are freed, how cyclic references are collected and __slots__." }),
      lesson('k', 18, "eszamanlilik-ve-asyncio", { tr: "Eşzamanlılık: Thread, GIL, multiprocessing ve asyncio", en: "Concurrency: Threads, the GIL, multiprocessing and asyncio" }, { tr: "GIL'in etkisini, thread ile process farkını ve asyncio ile beklerken iş yapmayı öğren.", en: "Learn the GIL's impact, threads vs processes and doing work while awaiting with asyncio." }),
      lesson('k', 19, "testler-ve-mini-proje", { tr: "Test Yazma ve Uçtan Uca Mini Proje", en: "Testing and an End-to-End Mini Project" }, { tr: "pytest ile test yaz ve öğrendiklerini OOP ve DI ile bir kütüphane uygulamasında birleştir.", en: "Write tests with pytest and combine everything in a library app built with OOP and DI." }),
    ],
  },
  {
    id: 'l-algorithms-data-structures',
    slug: 'algorithms-data-structures',
    code: 'L',
    order: 12,
    title: { tr: 'Algoritmalar ve Veri Yapıları', en: 'Algorithms and Data Structures' },
    description: {
      tr: 'Big-O’dan dinamik programlamaya: görselleştirilmiş sıralama, graf gezintisi ve satır satır Python izleriyle.',
      en: 'From Big-O to dynamic programming: visualised sorting, graph traversal and line-by-line Python traces.',
    },
    icon: 'puzzle',
    color: '#f59e0b',
    group: 'programming',
    lessons: [
      lesson('l', 1, 'big-o-complexity', { tr: 'Big-O: Algoritma Karmaşıklığı', en: 'Big-O: Algorithmic Complexity' }, { tr: 'Zaman ve bellek karmaşıklığını sezgisel ve grafikle öğren; O(1), O(log n), O(n), O(n log n), O(n²) ve O(2ⁿ) karşılaştırması.', en: 'Learn time and space complexity intuitively and with graphs; compare O(1), O(log n), O(n), O(n log n), O(n²) and O(2ⁿ).' }, ['big-o-plotter']),
      lesson('l', 2, 'arrays-strings-two-pointers', { tr: 'Diziler, Stringler ve İki İşaretçi', en: 'Arrays, Strings and Two Pointers' }, { tr: 'Bellekte ardışık dizi, dinamik diziler, kayan pencere ve iki işaretçi teknikleri; satır satır Python izleriyle.', en: 'Contiguous arrays in memory, dynamic arrays, sliding window and two-pointer techniques with line-by-line Python traces.' }),
      lesson('l', 3, 'hash-tables', { tr: 'Hash Tabloları', en: 'Hash Tables' }, { tr: 'Hash fonksiyonu, kova, çakışma çözümü (zincirleme, açık adresleme), yük faktörü ve yeniden boyutlama; interaktif hash tablosu.', en: 'Hash functions, buckets, collision resolution (chaining, open addressing), load factor and resizing; interactive hash table.' }, ['hash-table']),
      lesson('l', 4, 'stacks-queues', { tr: 'Yığın ve Kuyruk', en: 'Stacks and Queues' }, { tr: 'LIFO ve FIFO yapıları, parantez eşleme, çağrı yığını, deque ve monotonik yığın; Python izleriyle.', en: 'LIFO and FIFO structures, bracket matching, the call stack, deque and monotonic stack; with Python traces.' }),
      lesson('l', 5, 'trees-bst', { tr: 'Ağaçlar ve İkili Arama Ağacı', en: 'Trees and Binary Search Trees' }, { tr: 'Ağaç terminolojisi, dolaşma sıraları, BST ekleme/arama/silme ve dengeli ağaçlara giriş.', en: 'Tree terminology, traversal orders, BST insert/search/delete and an introduction to balanced trees.' }, ['graph-traversal']),
      lesson('l', 6, 'heaps-priority-queues', { tr: 'Heap ve Öncelik Kuyruğu', en: 'Heaps and Priority Queues' }, { tr: 'İkili heap, sift-up/sift-down, heapq ve en büyük k eleman, Dijkstra ile ilişkisi.', en: 'Binary heap, sift-up/sift-down, heapq and top-k, relation to Dijkstra.' }),
      lesson('l', 7, 'graphs-bfs-dfs', { tr: 'Graflar: BFS, DFS ve En Kısa Yol', en: 'Graphs: BFS, DFS and Shortest Paths' }, { tr: 'Komşuluk listesi, BFS/DFS, topolojik sıralama ve Dijkstra; interaktif graf gezintisi.', en: 'Adjacency lists, BFS/DFS, topological sort and Dijkstra; interactive graph traversal.' }, ['graph-traversal']),
      lesson('l', 8, 'sorting', { tr: 'Sıralama Algoritmaları', en: 'Sorting Algorithms' }, { tr: 'Bubble, insertion, selection, merge ve quick sort; kararlılık, yerinde sıralama ve karşılaştırma; görsel sıralayıcı.', en: 'Bubble, insertion, selection, merge and quick sort; stability, in-place sorting and comparison; visual sorter.' }, ['sorting-visualizer']),
      lesson('l', 9, 'binary-search', { tr: 'İkili Arama ve Varyantları', en: 'Binary Search and Its Variants' }, { tr: 'Sıralı veride O(log n) arama, alt/üst sınır, cevap üzerinde ikili arama ve sık hatalar.', en: 'O(log n) search on sorted data, lower/upper bound, binary search on the answer and common bugs.' }, ['big-o-plotter']),
      lesson('l', 10, 'dynamic-programming', { tr: 'Dinamik Programlama', en: 'Dynamic Programming' }, { tr: 'Örtüşen alt problemler, memoization ve tabulation; Fibonacci, sırt çantası ve en uzun ortak alt dizi; Python izleriyle.', en: 'Overlapping subproblems, memoization and tabulation; Fibonacci, knapsack and longest common subsequence; with Python traces.' }),
    ],
  },
  {
    id: 'm-llm-applications',
    slug: 'llm-applications',
    code: 'M',
    order: 13,
    title: { tr: 'LLM Uygulamaları: RAG, Ajanlar ve Üretim', en: 'LLM Applications: RAG, Agents and Production' },
    description: {
      tr: 'Token ve bağlam penceresinden RAG, vektör veritabanı, değerlendirme, ajanlar, guardrail ve maliyet yönetimine.',
      en: 'From tokens and context windows to RAG, vector databases, evaluation, agents, guardrails and cost management.',
    },
    icon: 'brain',
    color: '#a855f7',
    group: 'ai',
    lessons: [
      lesson('m', 1, 'tokens-context-window', { tr: 'Token, Bağlam Penceresi ve Maliyet', en: 'Tokens, Context Windows and Cost' }, { tr: 'LLM\'lerin metni nasıl böldüğü, bağlam penceresinin sınırları, giriş/çıkış token maliyeti ve kesme stratejileri.', en: 'How LLMs split text, context window limits, input/output token cost and truncation strategies.' }, ['tokenizer', 'token-cost']),
      lesson('m', 2, 'prompt-engineering', { tr: 'Prompt Mühendisliği', en: 'Prompt Engineering' }, { tr: 'Sistem/kullanıcı rolleri, few-shot, zincirleme düşünme, yapılandırılmış çıktı ve prompt şablonları; interaktif prompt oyun alanı.', en: 'System/user roles, few-shot, chain of thought, structured output and prompt templates; interactive prompt playground.' }, ['prompt-playground']),
      lesson('m', 3, 'rag-pipeline', { tr: 'RAG: Getirme Destekli Üretim', en: 'RAG: Retrieval-Augmented Generation' }, { tr: 'Belge parçalama, gömme, getirme ve üretim adımları; chunk boyutu ve top-k seçiminin cevaba etkisi; interaktif RAG hattı.', en: 'Chunking, embedding, retrieval and generation; how chunk size and top-k affect the answer; interactive RAG pipeline.' }, ['rag-pipeline']),
      lesson('m', 4, 'vector-databases', { tr: 'Vektör Veritabanları ve Benzerlik Araması', en: 'Vector Databases and Similarity Search' }, { tr: 'Gömme uzayı, kosinüs benzerliği, HNSW ve IVF indeksleri, hibrit arama ve filtreleme.', en: 'Embedding space, cosine similarity, HNSW and IVF indexes, hybrid search and filtering.' }, ['embedding-space']),
      lesson('m', 5, 'evaluation', { tr: 'LLM Uygulamalarını Değerlendirmek', en: 'Evaluating LLM Applications' }, { tr: 'Altın veri seti, LLM-as-judge, RAG metrikleri (faithfulness, recall), regresyon testleri ve çevrimiçi değerlendirme.', en: 'Golden datasets, LLM-as-judge, RAG metrics (faithfulness, recall), regression tests and online evaluation.' }),
      lesson('m', 6, 'agents-tool-use', { tr: 'Ajanlar ve Araç Kullanımı', en: 'Agents and Tool Use' }, { tr: 'Araç çağırma döngüsü, planlama, bellek, MCP ile araç sunma ve ajan güvenliği.', en: 'The tool-calling loop, planning, memory, exposing tools with MCP and agent safety.' }, ['pipeline']),
      lesson('m', 7, 'guardrails-hallucination', { tr: 'Guardrail ve Halüsinasyon Yönetimi', en: 'Guardrails and Hallucination Management' }, { tr: 'Girdi/çıktı filtreleri, prompt enjeksiyonu, kaynak gösterme, doğrulama katmanı ve insan onayı.', en: 'Input/output filters, prompt injection, citations, verification layers and human approval.' }, ['prompt-playground']),
      lesson('m', 8, 'cost-latency-caching', { tr: 'Maliyet, Gecikme ve Önbellekleme', en: 'Cost, Latency and Caching' }, { tr: 'Model seçimi, prompt önbelleği, semantik önbellek, akış (streaming), toplu işleme ve bütçe takibi.', en: 'Model selection, prompt caching, semantic caching, streaming, batching and budget tracking.' }, ['token-cost', 'cache']),
    ],
  },
  {
    id: 'n-auth-security',
    slug: 'auth-security',
    code: 'N',
    order: 14,
    title: { tr: 'Kimlik Doğrulama ve Güvenlik', en: 'Authentication and Security' },
    description: {
      tr: 'Oturum ve token\'dan JWT, OAuth2/OIDC, yetkilendirme, OWASP Top 10, kriptografi temelleri ve tehdit modellemeye.',
      en: 'From sessions and tokens to JWT, OAuth2/OIDC, authorisation, OWASP Top 10, cryptography basics and threat modelling.',
    },
    icon: 'shield',
    color: '#ef4444',
    group: 'software',
    lessons: [
      lesson('n', 1, 'sessions-vs-tokens', { tr: 'Oturum mu, Token mı?', en: 'Sessions or Tokens?' }, { tr: 'Sunucu taraflı oturum, çerez özellikleri (HttpOnly, SameSite), taşıyıcı token ve yenileme; hangi durumda hangisi.', en: 'Server-side sessions, cookie attributes (HttpOnly, SameSite), bearer tokens and refresh; which one when.' }, ['request-journey']),
      lesson('n', 2, 'jwt', { tr: 'JWT: Yapısı, İmzası ve Tuzakları', en: 'JWT: Structure, Signature and Pitfalls' }, { tr: 'Başlık/gövde/imza, HS256 ve RS256, süre dolumu, iptal problemi ve alg=none gibi klasik hatalar; interaktif JWT inceleyici.', en: 'Header/payload/signature, HS256 vs RS256, expiry, the revocation problem and classic mistakes like alg=none; interactive JWT inspector.' }, ['jwt-inspector']),
      lesson('n', 3, 'oauth2-oidc', { tr: 'OAuth 2.0 ve OpenID Connect', en: 'OAuth 2.0 and OpenID Connect' }, { tr: 'Authorization code + PKCE, client credentials, scope ve consent, ID token ve yaygın hatalar; adım adım akış simülatörü.', en: 'Authorization code + PKCE, client credentials, scopes and consent, ID tokens and common mistakes; step-by-step flow simulator.' }, ['oauth-flow']),
      lesson('n', 4, 'authorization-rbac-abac', { tr: 'Yetkilendirme: RBAC ve ABAC', en: 'Authorisation: RBAC and ABAC' }, { tr: 'Rol ve öznitelik tabanlı erişim, politika motorları, en az ayrıcalık, çok kiracılı sistemlerde veri izolasyonu.', en: 'Role- and attribute-based access, policy engines, least privilege, data isolation in multi-tenant systems.' }, ['rbac-abac']),
      lesson('n', 5, 'owasp-top-10', { tr: 'OWASP Top 10 ile Web Güvenliği', en: 'Web Security with OWASP Top 10' }, { tr: 'Enjeksiyon, XSS, CSRF, kırık erişim kontrolü, güvensiz tasarım ve kaba kuvvet; savunmalar ve kod örnekleri; kaba kuvvet simülatörü.', en: 'Injection, XSS, CSRF, broken access control, insecure design and brute force; defences and code examples; brute-force simulator.' }, ['bruteforce-login']),
      lesson('n', 6, 'cryptography-basics', { tr: 'Kriptografi Temelleri', en: 'Cryptography Basics' }, { tr: 'Hash ve şifre saklama (bcrypt/argon2), simetrik ve asimetrik şifreleme, TLS el sıkışması, imza ve anahtar yönetimi.', en: 'Hashing and password storage (bcrypt/argon2), symmetric and asymmetric encryption, the TLS handshake, signatures and key management.' }, ['jwt-inspector', 'hash-salt']),
      lesson('n', 7, 'threat-modeling', { tr: 'Tehdit Modelleme ve Güvenli Tasarım', en: 'Threat Modelling and Secure Design' }, { tr: 'STRIDE, saldırı yüzeyi, güven sınırları, gizli bilgi yönetimi ve tedarik zinciri güvenliği.', en: 'STRIDE, attack surface, trust boundaries, secrets management and supply-chain security.' }, ['threat-model']),
    ],
  },
];

export const LEARNING_PATHS: LearningPathManifest[] = [
  {
    id: 'backend',
    slug: 'backend',
    title: { tr: 'Backend Geliştirici', en: 'Backend Developer' },
    description: {
      tr: 'API’ler, veritabanları, kuyruklar ve altyapı.',
      en: 'APIs, databases, queues and infrastructure.',
    },
    icon: 'terminal',
    items: [
      'a-system-design-fundamentals',
      'd-database-design',
      'c-design-patterns',
      'f-code-and-infrastructure',
    ],
  },
  {
    id: 'system-design',
    slug: 'system-design',
    title: { tr: 'Sistem Tasarımı', en: 'System Design' },
    description: {
      tr: 'Ölçeklenebilir sistemlerin tasarımı ve vaka çalışmaları.',
      en: 'Designing scalable systems with case studies.',
    },
    icon: 'network',
    items: [
      'a-system-design-fundamentals',
      'b-architectures',
      'e-case-studies',
      'f-code-and-infrastructure',
    ],
  },
  {
    id: 'ai',
    slug: 'ai',
    title: { tr: 'Yapay Zekâ', en: 'Artificial Intelligence' },
    description: {
      tr: 'ML temellerinden LLM ve MLOps’a.',
      en: 'From ML foundations to LLMs and MLOps.',
    },
    icon: 'brain',
    items: [
      'g-artificial-intelligence',
      'a-system-design-fundamentals/a-07-caching',
      'a-system-design-fundamentals/a-09-message-queues-event-driven',
    ],
  },
  {
    id: 'interview-prep',
    slug: 'interview-prep',
    title: { tr: 'Mülakat Hazırlığı', en: 'Interview Preparation' },
    description: {
      tr: 'Sistem tasarımı mülakatları için hızlandırılmış rota.',
      en: 'An accelerated route for system design interviews.',
    },
    icon: 'briefcase',
    items: [
      'a-system-design-fundamentals/a-02-latency-throughput-cap',
      'a-system-design-fundamentals/a-05-load-balancing',
      'a-system-design-fundamentals/a-07-caching',
      'a-system-design-fundamentals/a-10-rate-limiting',
      'a-system-design-fundamentals/a-11-consistent-hashing-sharding',
      'a-system-design-fundamentals/a-12-replication',
      'd-database-design/d-04-sql-vs-nosql',
      'e-case-studies',
      'c-design-patterns/c-04-distributed-patterns',
    ],
  },
];

export function findModule(moduleId: string): CurriculumModule | undefined {
  return CURRICULUM.find((m) => m.id === moduleId || m.slug === moduleId);
}

export function findLesson(
  lessonId: string,
): { module: CurriculumModule; lesson: CurriculumLesson } | undefined {
  for (const module of CURRICULUM) {
    const found = module.lessons.find((l) => l.id === lessonId || l.slug === lessonId);
    if (found) return { module, lesson: found };
  }
  return undefined;
}

export function allLessons(): { module: CurriculumModule; lesson: CurriculumLesson }[] {
  return CURRICULUM.flatMap((module) => module.lessons.map((lesson) => ({ module, lesson })));
}

/** Bir dersin müfredattaki bir sonraki dersi (modül sınırını aşabilir) */
export function nextLessonOf(lessonId: string): CurriculumLesson | undefined {
  const flat = allLessons();
  const idx = flat.findIndex((x) => x.lesson.id === lessonId);
  if (idx < 0 || idx === flat.length - 1) return undefined;
  return flat[idx + 1].lesson;
}

export const TOTAL_LESSON_COUNT = allLessons().length;
