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
    lessons: [
      lesson('a', 1, 'client-server-dns-http', { tr: 'İstemci-Sunucu, DNS, HTTP/HTTPS, TCP/UDP, WebSocket', en: 'Client-Server, DNS, HTTP/HTTPS, TCP/UDP, WebSocket' }, { tr: 'Bir URL yazdığınızda ağda neler olur? DNS çözümlemeden WebSocket akışına.', en: 'What happens on the network when you type a URL? From DNS resolution to WebSocket flows.' }),
      lesson('a', 2, 'latency-throughput-cap', { tr: 'Gecikme vs. Verimlilik, SLA/SLO, CAP ve Tutarlılık', en: 'Latency vs. Throughput, SLA/SLO, CAP and Consistency' }, { tr: 'Performans ölçütleri, hizmet seviyeleri, CAP teoremi ve tutarlılık modelleri.', en: 'Performance metrics, service levels, the CAP theorem and consistency models.' }, ['cap-theorem']),
      lesson('a', 3, 'horizontal-vertical-scaling', { tr: 'Yatay ve Dikey Ölçekleme', en: 'Horizontal and Vertical Scaling' }, { tr: 'Tek sunucu patlıyor → replika ekleniyor: karşılaştırmalı animasyon.', en: 'A single server melts down → replicas are added: a side-by-side animation.' }, ['scaling']),
      lesson('a', 4, 'stateless-stateful-sessions', { tr: 'Stateless vs. Stateful Servisler ve Oturum Yönetimi', en: 'Stateless vs. Stateful Services and Session Management' }, { tr: 'Durum nerede tutulur? Sticky session, merkezi oturum deposu, JWT.', en: 'Where does state live? Sticky sessions, central session stores, JWT.' }),
      lesson('a', 5, 'load-balancing', { tr: 'Load Balancer: L4/L7 ve Dağıtım Algoritmaları', en: 'Load Balancer: L4/L7 and Distribution Algorithms' }, { tr: 'Round-robin, least connections, IP hash, weighted, health check ve sticky session simülatörü.', en: 'Round-robin, least connections, IP hash, weighted, health checks and a sticky session simulator.' }, ['load-balancer']),
      lesson('a', 6, 'api-gateway', { tr: 'API Gateway', en: 'API Gateway' }, { tr: 'Routing, auth, rate limiting, aggregation, circuit breaker; Gateway vs. Reverse Proxy vs. Service Mesh.', en: 'Routing, auth, rate limiting, aggregation, circuit breaker; Gateway vs. Reverse Proxy vs. Service Mesh.' }),
      lesson('a', 7, 'caching', { tr: 'Caching: Katmanlar ve Stratejiler', en: 'Caching: Layers and Strategies' }, { tr: 'Browser → CDN → gateway → uygulama → DB; cache-aside, write-through, write-back, TTL, LRU/LFU.', en: 'Browser → CDN → gateway → app → DB; cache-aside, write-through, write-back, TTL, LRU/LFU.' }, ['cache']),
      lesson('a', 8, 'cdn-edge', { tr: 'CDN ve Edge Computing', en: 'CDN and Edge Computing' }, { tr: 'Statik içerik dağıtımı, PoP’lar, edge fonksiyonları.', en: 'Static content delivery, PoPs, edge functions.' }),
      lesson('a', 9, 'message-queues-event-driven', { tr: 'Mesaj Kuyrukları ve Event-Driven Mimari', en: 'Message Queues and Event-Driven Architecture' }, { tr: 'Kafka, RabbitMQ, SQS; pub/sub, dead-letter queue, idempotency.', en: 'Kafka, RabbitMQ, SQS; pub/sub, dead-letter queues, idempotency.' }, ['message-queue']),
      lesson('a', 10, 'rate-limiting', { tr: 'Rate Limiting Algoritmaları', en: 'Rate Limiting Algorithms' }, { tr: 'Token bucket, leaky bucket, sliding window — interaktif karşılaştırma.', en: 'Token bucket, leaky bucket, sliding window — interactive comparison.' }, ['rate-limiter']),
      lesson('a', 11, 'consistent-hashing-sharding', { tr: 'Consistent Hashing, Sharding, Partitioning', en: 'Consistent Hashing, Sharding, Partitioning' }, { tr: 'Animasyonlu halka, sanal düğümler, yeniden dağıtım maliyeti.', en: 'Animated ring, virtual nodes, redistribution cost.' }, ['consistent-hashing']),
      lesson('a', 12, 'replication', { tr: 'Replication: Master-Slave, Master-Master, Leader Election, Quorum', en: 'Replication: Leader-Follower, Multi-Leader, Leader Election, Quorum' }, { tr: 'Veri kopyalama stratejileri ve quorum simülatörü.', en: 'Data replication strategies and a quorum simulator.' }, ['replication-quorum']),
      lesson('a', 13, 'observability-12-factor', { tr: 'Observability ve 12-Factor App', en: 'Observability and the 12-Factor App' }, { tr: 'Logging, metrics, tracing; üretim için 12 ilke.', en: 'Logging, metrics, tracing; twelve principles for production.' }),
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
    lessons: [
      lesson('b', 1, 'monolith-to-microservices', { tr: 'Monolith → Modüler Monolith → Mikroservis', en: 'Monolith → Modular Monolith → Microservices' }, { tr: 'Evrim adımları, ayrıştırma kriterleri, ekip topolojisi.', en: 'Evolution steps, decomposition criteria, team topology.' }),
      lesson('b', 2, 'microservice-communication', { tr: 'Mikroservis İletişimi: Sync/Async, Saga, CQRS, Event Sourcing', en: 'Microservice Communication: Sync/Async, Saga, CQRS, Event Sourcing' }, { tr: 'REST/gRPC vs. event; saga koreografi/orkestrasyon; CQRS ve event sourcing.', en: 'REST/gRPC vs. events; saga choreography/orchestration; CQRS and event sourcing.' }),
      lesson('b', 3, 'serverless-bff-clean-ddd', { tr: 'Serverless, BFF, Hexagonal/Clean Architecture, DDD', en: 'Serverless, BFF, Hexagonal/Clean Architecture, DDD' }, { tr: 'Fonksiyon tabanlı mimari, istemciye özel backend, port-adaptör, bounded context.', en: 'Function-based architecture, client-specific backends, ports & adapters, bounded contexts.' }),
      lesson('b', 4, 'multi-region-dr', { tr: 'Multi-Region, Aktif-Aktif/Aktif-Pasif, Disaster Recovery', en: 'Multi-Region, Active-Active/Active-Passive, Disaster Recovery' }, { tr: 'RPO/RTO, failover animasyonu, veri yerleşimi.', en: 'RPO/RTO, failover animation, data residency.' }),
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
    lessons: [
      lesson('c', 1, 'creational-patterns', { tr: 'Creational: Singleton, Factory, Abstract Factory, Builder, Prototype', en: 'Creational: Singleton, Factory, Abstract Factory, Builder, Prototype' }, { tr: 'Nesne üretimini soyutlayan kalıplar.', en: 'Patterns that abstract object creation.' }),
      lesson('c', 2, 'structural-patterns', { tr: 'Structural: Adapter, Decorator, Facade, Proxy, Composite, Bridge', en: 'Structural: Adapter, Decorator, Facade, Proxy, Composite, Bridge' }, { tr: 'Sınıf ve nesneleri daha büyük yapılarda birleştiren kalıplar.', en: 'Patterns that compose classes and objects into larger structures.' }),
      lesson('c', 3, 'behavioral-patterns', { tr: 'Behavioral: Observer, Strategy, Command, State, Chain of Responsibility, Mediator, Template Method', en: 'Behavioral: Observer, Strategy, Command, State, Chain of Responsibility, Mediator, Template Method' }, { tr: 'Nesneler arası sorumluluk ve iletişim kalıpları.', en: 'Patterns for responsibility and communication between objects.' }),
      lesson('c', 4, 'distributed-patterns', { tr: 'Dağıtık Sistem Kalıpları: Circuit Breaker, Retry+Backoff, Bulkhead, Sidecar, Strangler Fig, Outbox', en: 'Distributed Patterns: Circuit Breaker, Retry+Backoff, Bulkhead, Sidecar, Strangler Fig, Outbox' }, { tr: 'Dayanıklılık ve geçiş kalıpları.', en: 'Resilience and migration patterns.' }),
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
    lessons: [
      lesson('d', 1, 'relational-modeling-normalization', { tr: 'İlişkisel Modelleme, Normalizasyon (1NF→BCNF), ER Diyagramları', en: 'Relational Modeling, Normalization (1NF→BCNF), ER Diagrams' }, { tr: 'Interaktif ER çizim aracıyla şema tasarımı.', en: 'Schema design with an interactive ER drawing tool.' }, ['er-diagram']),
      lesson('d', 2, 'indexing', { tr: 'İndeksleme: B-tree, Hash, Composite — Sorgu Planı', en: 'Indexing: B-tree, Hash, Composite — Query Plans' }, { tr: 'İndeksin sorgu planını nasıl değiştirdiğini animasyonla izleyin.', en: 'Watch how an index changes the query plan.' }, ['index-query-plan']),
      lesson('d', 3, 'transactions-acid-isolation', { tr: 'Transaction, ACID, İzolasyon Seviyeleri, Deadlock', en: 'Transactions, ACID, Isolation Levels, Deadlocks' }, { tr: 'Dirty read’den serializable’a; deadlock görselleştirmesi.', en: 'From dirty reads to serializable; deadlock visualization.' }, ['isolation-levels']),
      lesson('d', 4, 'sql-vs-nosql', { tr: 'SQL vs NoSQL: Key-Value, Document, Wide-Column, Graph, Time-Series', en: 'SQL vs NoSQL: Key-Value, Document, Wide-Column, Graph, Time-Series' }, { tr: 'Karşılaştırma matrisi ve seçim rehberi.', en: 'Comparison matrix and selection guide.' }),
      lesson('d', 5, 'read-write-scaling', { tr: 'Okuma/Yazma Ölçekleme: Read Replica, Connection Pool, Sharding', en: 'Read/Write Scaling: Read Replicas, Connection Pools, Sharding' }, { tr: 'Replika gecikmesi, havuz boyutlandırma, shard anahtarı seçimi.', en: 'Replica lag, pool sizing, shard key selection.' }),
      lesson('d', 6, 'example-schemas', { tr: 'Örnek Şemalar: E-ticaret, Sosyal Medya, Ödeme, Mesajlaşma', en: 'Example Schemas: E-commerce, Social Media, Payments, Messaging' }, { tr: 'Gerçek dünyadan dört şema ve tasarım kararları.', en: 'Four real-world schemas and their design decisions.' }, ['er-diagram']),
    ],
  },
  {
    id: 'e-case-studies',
    slug: 'case-studies',
    code: 'E',
    order: 5,
    title: { tr: 'Yüksek Trafikli Sistem Vaka Çalışmaları', en: 'High-Traffic System Case Studies' },
    description: {
      tr: 'Gereksinim → kapasite → mimari → darboğaz → animasyonlu istek yolculuğu.',
      en: 'Requirements → capacity → architecture → bottlenecks → animated request journey.',
    },
    icon: 'rocket',
    color: '#ef4444',
    lessons: [
      lesson('e', 1, 'amazon-scale-ecommerce', { tr: 'Amazon Ölçeğinde E-ticaret', en: 'Amazon-Scale E-commerce' }, { tr: 'Katalog, sepet, sipariş, envanter, ödeme, arama, öneri; Black Friday simülasyonu.', en: 'Catalog, cart, orders, inventory, payments, search, recommendations; Black Friday simulation.' }, ['capacity-estimator', 'traffic-wave', 'request-journey']),
      lesson('e', 2, 'video-streaming', { tr: 'Netflix/YouTube: Video Depolama, Transcoding, CDN, Adaptive Bitrate', en: 'Netflix/YouTube: Video Storage, Transcoding, CDN, Adaptive Bitrate' }, { tr: 'Upload’dan oynatmaya video boru hattı.', en: 'The video pipeline from upload to playback.' }, ['capacity-estimator']),
      lesson('e', 3, 'twitter-timeline', { tr: 'Twitter/X: Timeline Fan-out, Cache, Trending', en: 'Twitter/X: Timeline Fan-out, Cache, Trending' }, { tr: 'Fan-out on write vs. read, ünlü problemi.', en: 'Fan-out on write vs. read, the celebrity problem.' }, ['fan-out']),
      lesson('e', 4, 'uber-geo-matching', { tr: 'Uber: Coğrafi İndeksleme, Eşleştirme, Gerçek Zamanlı Konum', en: 'Uber: Geo Indexing, Matching, Real-time Location' }, { tr: 'Geohash/H3, sürücü eşleştirme, konum akışı.', en: 'Geohash/H3, driver matching, location streams.' }, ['geo-index']),
      lesson('e', 5, 'whatsapp-messaging', { tr: 'WhatsApp: Mesaj Teslimi, Online Durum, Uçtan Uca Şifreleme', en: 'WhatsApp: Message Delivery, Presence, End-to-End Encryption' }, { tr: 'Teslim garantileri, presence, Signal protokolü kavramsal.', en: 'Delivery guarantees, presence, the Signal protocol conceptually.' }),
      lesson('e', 6, 'classic-interview-systems', { tr: 'URL Kısaltıcı, Rate Limiter, Notification Servisi', en: 'URL Shortener, Rate Limiter, Notification Service' }, { tr: 'Klasik mülakat soruları ve çözüm şablonu.', en: 'Classic interview questions and a solution template.' }, ['rate-limiter', 'capacity-estimator']),
    ],
  },
  {
    id: 'f-code-and-infrastructure',
    slug: 'code-and-infrastructure',
    code: 'F',
    order: 6,
    title: { tr: 'Kod ve Altyapı: Kod Nerede, Nasıl Tutulur, Nasıl Çalışır?', en: 'Code and Infrastructure: Where Code Lives and How It Runs' },
    description: {
      tr: 'Amazon benzeri bir şirkette kodun yaşam döngüsü: geliştirici makinesinden production’a.',
      en: 'The lifecycle of code at an Amazon-like company: from a developer laptop to production.',
    },
    icon: 'server',
    color: '#8b5cf6',
    lessons: [
      lesson('f', 1, 'servers-datacenters-regions', { tr: 'Sunucu Türleri ve Veri Merkezi → Region → Availability Zone', en: 'Server Types and Data Center → Region → Availability Zone' }, { tr: 'Bare metal, VM, container, serverless; fiziksel yerleşim.', en: 'Bare metal, VMs, containers, serverless; physical placement.' }),
      lesson('f', 2, 'code-journey-ci-cd', { tr: 'Kodun Yolculuğu: Git → CI → Artifact → CD → Canary → Production', en: 'The Code Journey: Git → CI → Artifact → CD → Canary → Production' }, { tr: 'Monorepo/polyrepo, branching, pipeline, deploy stratejileri — tam animasyonlu.', en: 'Monorepo/polyrepo, branching, pipelines, deploy strategies — fully animated.' }, ['pipeline']),
      lesson('f', 3, 'kubernetes-basics', { tr: 'Kubernetes Temelleri: Pod, Deployment, Service, Ingress, HPA', en: 'Kubernetes Basics: Pod, Deployment, Service, Ingress, HPA' }, { tr: 'Otomatik ölçekleme animasyonu.', en: 'Autoscaling animation.' }, ['kubernetes-hpa']),
      lesson('f', 4, 'iac-config-secrets-flags', { tr: 'Infrastructure as Code, Konfigürasyon, Secret Yönetimi, Feature Flag’ler', en: 'Infrastructure as Code, Configuration, Secrets, Feature Flags' }, { tr: 'Terraform, ortam değişkenleri, vault, kademeli açılış.', en: 'Terraform, environment variables, vaults, gradual rollout.' }),
      lesson('f', 5, 'physical-request-path', { tr: 'Bir İsteğin Fiziksel Yolu', en: 'The Physical Path of a Request' }, { tr: 'Kullanıcı → DNS → CDN → LB → Gateway → Servis → Cache → DB; hangi katman hangi sunucuda?', en: 'User → DNS → CDN → LB → Gateway → Service → Cache → DB; which layer runs on which server?' }, ['request-journey']),
      lesson('f', 6, 'where-data-lives', { tr: 'Hangi Veri Nerede Tutulur?', en: 'Where Does Each Kind of Data Live?' }, { tr: 'İlişkisel DB, NoSQL, object storage, cache, data warehouse, log/metrik depoları — veri akış diyagramı.', en: 'Relational DB, NoSQL, object storage, cache, data warehouse, log/metric stores — data flow diagram.' }),
      lesson('f', 7, 'security-layers', { tr: 'Güvenlik Katmanları: WAF, DDoS, TLS, IAM, Zero-Trust', en: 'Security Layers: WAF, DDoS, TLS, IAM, Zero-Trust' }, { tr: 'Derinlemesine savunma.', en: 'Defense in depth.' }),
      lesson('f', 8, 'devacademy-architecture', { tr: 'DevAcademy’nin Kendi Mimarisi', en: 'DevAcademy’s Own Architecture' }, { tr: 'Bu uygulamanın monorepo, backend, web ve mobil katmanları nasıl çalışıyor?', en: 'How this app’s monorepo, backend, web and mobile layers work together.' }),
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
    lessons: [
      lesson('g', 1, 'ml-foundations', { tr: 'ML Temelleri: Öğrenme Türleri, Veri Ayrımı, Overfitting', en: 'ML Foundations: Learning Types, Data Splits, Overfitting' }, { tr: 'Supervised/unsupervised/reinforcement; overfitting animasyonu.', en: 'Supervised/unsupervised/reinforcement; overfitting animation.' }),
      lesson('g', 2, 'classical-algorithms', { tr: 'Klasik Algoritmalar: Regresyon, Ağaçlar, SVM, k-means, PCA', en: 'Classical Algorithms: Regression, Trees, SVM, k-means, PCA' }, { tr: 'İnteraktif gradient descent ve nokta bulutu görselleştirmeleri.', en: 'Interactive gradient descent and point-cloud visualizations.' }, ['gradient-descent', 'k-means', 'decision-tree']),
      lesson('g', 3, 'neural-networks', { tr: 'Sinir Ağları: Nöron, Aktivasyon, Forward/Backward Propagation', en: 'Neural Networks: Neurons, Activations, Forward/Backward Propagation' }, { tr: 'Adım adım ileri ve geri yayılım animasyonu, loss yüzeyi.', en: 'Step-by-step forward and backward propagation, loss surface.' }),
      lesson('g', 4, 'deep-learning-architectures', { tr: 'Derin Öğrenme Mimarileri: CNN, RNN/LSTM, Transformer, GAN, Diffusion', en: 'Deep Learning Architectures: CNN, RNN/LSTM, Transformer, GAN, Diffusion' }, { tr: 'Konvolüsyon filtresi ve self-attention görselleştirmesi.', en: 'Convolution filter and self-attention visualization.' }, ['convolution', 'attention']),
      lesson('g', 5, 'llms', { tr: 'LLM’ler: Tokenization, Embedding, Pretraining/Fine-tuning, RAG, Agent’lar', en: 'LLMs: Tokenization, Embeddings, Pretraining/Fine-tuning, RAG, Agents' }, { tr: 'Token’dan agent’a büyük dil modelleri.', en: 'Large language models from tokens to agents.' }, ['tokenizer', 'embedding-space']),
      lesson('g', 6, 'mlops', { tr: 'MLOps: Veri Pipeline, Feature Store, Eğitim, Serving, A/B, Drift', en: 'MLOps: Data Pipelines, Feature Store, Training, Serving, A/B, Drift' }, { tr: 'Modelin üretime giden yolu ve izlenmesi.', en: 'The model’s path to production and its monitoring.' }),
      lesson('g', 7, 'production-ai-systems', { tr: 'Üretimde AI Sistem Tasarımı: Öneri, Arama Sıralaması, Fraud', en: 'Production AI System Design: Recommendations, Search Ranking, Fraud' }, { tr: 'Amazon öneri sistemi örneğiyle ölçekli mimari.', en: 'Scaled architecture using Amazon’s recommender as the example.' }),
      lesson('g', 8, 'nn-playground', { tr: 'Mini Playground: Tarayıcıda Sinir Ağı Eğitme', en: 'Mini Playground: Train a Neural Network in the Browser' }, { tr: 'TensorFlow.js ile ağırlık değişimini canlı izleyin.', en: 'Watch weights change live with TensorFlow.js.' }, ['neural-network-playground']),
    ],
  },
  {
    id: "h-devops-tools",
    slug: "devops-tools",
    code: "H",
    order: 8,
    title: { tr: "DevOps ve Araçlar", en: "DevOps and Tooling" },
    description: { tr: "Linux, sunucu yönetimi, Git, Docker, CI/CD, Grafana ve DevOps'ta yapay zekâ: kişisel notlar ve rehberler.", en: "Linux, server management, Git, Docker, CI/CD, Grafana and AI in DevOps: personal notes and guides." },
    icon: "server",
    color: "#0ea5e9",
    lessons: [
      lesson("h", 1, "linux-notes", { tr: "Linux: Başlangıçtan İleri Seviyeye Tam Notlar", en: "Linux Complete Notes (Beginner to Advanced)" }, { tr: "Linux'a giriş, mimari, dosya sistemi, gezinme, dosya ve dizin komutları, izinler, metin işleme, süreç, disk, ağ ve paket yönetimi, shell betikleri, gerçek projelerde kullanım ve mülakat sorularını kapsar.", en: "Covers an introduction to Linux, its architecture, file system, navigation, file and directory commands, permissions, text processing, process, disk, network and package management, shell scripting, real-project usage and interview questions." }),
      lesson("h", 2, "linux-temelleri-vps-kurulumu-ve-guvenlik", { tr: "Linux ve VPS Kullanım Rehberi: Linux Temelleri, VPS Kurulumu ve Güvenlik", en: "Linux and VPS Usage Guide: Linux Basics, VPS Setup and Security" }, { tr: "Linux dağıtımları, dosya sistemi, terminal komutları, kullanıcı ve izinler, paket, süreç ve servis yönetimi, ağ temelleri ile VPS seçimi, SSH bağlantısı, ilk güvenlik sıkılaştırması ve DNS ayarını kapsar.", en: "Covers Linux distributions, the file system, terminal commands, users and permissions, package, process and service management, networking basics, plus choosing a VPS, connecting over SSH, initial security hardening and DNS setup." }),
      lesson("h", 3, "canliya-alma-yedekleme-ve-bakim", { tr: "Linux ve VPS Kullanım Rehberi: Canlıya Alma, Yedekleme ve Bakım", en: "Linux and VPS Usage Guide: Deployment, Backups and Maintenance" }, { tr: "Statik site, systemd ile Node.js, Docker Compose ve Coolify ile canlıya alma yöntemlerini, GitHub Actions ile otomatik yayını, yedekleme, izleme, sorun giderme ve canlıya alma kontrol listesini kapsar.", en: "Covers deployment methods with a static site, Node.js under systemd, Docker Compose and Coolify, automated deployment with GitHub Actions, backups, monitoring, troubleshooting and the go-live checklist." }),
      lesson("h", 4, "git-notes", { tr: "Git: Başlangıçtan İleri Seviyeye Tam Notlar", en: "Git Complete Notes (Beginner to Advanced)" }, { tr: "Git'e giriş, mimari ve yaşam döngüsü, kurulum, temel komutlar, iş akışı, dallanma, merge ve rebase, uzak depolar, geri alma, stash ve etiketler, GitHub iş birliği, QA ve CI/CD kullanımı, sık hatalar, ileri komutlar ve mülakat sorularını kapsar.", en: "Covers an introduction to Git, its architecture and lifecycle, installation, essential commands, workflow, branching, merge and rebase, remote repositories, undo and recovery, stash and tags, GitHub collaboration, use in QA and CI/CD, common errors, advanced commands and interview questions." }),
      lesson("h", 5, "devops-ve-docker-kullanim-rehberi", { tr: "DevOps ve Docker Kullanım Rehberi", en: "DevOps and Docker Usage Guide" }, { tr: "DevOps ilkeleri, Git, Docker ve Dockerfile, volume ve ağ, Docker Compose, GitHub Actions ile CI/CD, sunucu hazırlığı, IaC, Kubernetes, izleme, yedekleme, güvenlik ve sorun giderme konularını başlangıçtan üretime kadar ele alır.", en: "Covers DevOps principles, Git, Docker and Dockerfiles, volumes and networking, Docker Compose, CI/CD with GitHub Actions, server preparation, IaC, Kubernetes, monitoring, backups, security and troubleshooting from getting started to production." }),
      lesson("h", 6, "cicd-temelleri-ve-ilk-workflow", { tr: "CI/CD ve GitHub Actions: Temeller, Pipeline ve İlk Workflow", en: "CI/CD and GitHub Actions: Fundamentals, Pipeline and First Workflow" }, { tr: "CI/CD kavramları, CI ile iki farklı CD arasındaki fark, pipeline aşamaları, ortamlar, Git dallanma stratejileri, branch protection, GitHub Actions temel kavramları, YAML temelleri ve ilk workflow dosyası.", en: "CI/CD concepts, the difference between CI and the two kinds of CD, pipeline stages, environments, Git branching strategies, branch protection, GitHub Actions core concepts, YAML basics and the first workflow file." }),
      lesson("h", 7, "tetikleyiciler-secrets-cache-ve-testler", { tr: "CI/CD ve GitHub Actions: Tetikleyiciler, İfadeler, Secrets, Matrix, Cache ve Testler", en: "CI/CD and GitHub Actions: Triggers, Expressions, Secrets, Matrix, Cache and Tests" }, { tr: "Workflow tetikleyicileri, job bağımlılıkları, koşullar ve context'ler, ortam değişkenleri ve çıktılar, secrets ve variables, matrix, cache, artifact, PostgreSQL ile entegrasyon testi ve test piramidi.", en: "Workflow triggers, job dependencies, conditions and contexts, environment variables and outputs, secrets and variables, matrix, cache, artifacts, integration testing with PostgreSQL and the test pyramid." }),
      lesson("h", 8, "docker-deploy-ve-guvenlik", { tr: "CI/CD ve GitHub Actions: Docker, Deploy, Rollback ve Güvenlik", en: "CI/CD and GitHub Actions: Docker, Deployment, Rollback and Security" }, { tr: "Docker ile konteyner tabanlı CI/CD, deploy yöntemleri, environments ve onay kapıları, veritabanı migration'ları, deployment stratejileri, rollback, concurrency, reusable workflow ve composite action, runner türleri, güvenlik ve izinler.", en: "Container-based CI/CD with Docker, deployment methods, environments and approval gates, database migrations, deployment strategies, rollback, concurrency, reusable workflows and composite actions, runner types, security and permissions." }),
      lesson("h", 9, "kalite-izleme-ve-tam-pipeline", { tr: "CI/CD ve GitHub Actions: Kod Kalitesi, Sürümleme, İzleme ve Tam Pipeline", en: "CI/CD and GitHub Actions: Code Quality, Versioning, Monitoring and the Full Pipeline" }, { tr: "Kod kalitesi ve güvenlik taraması, sürümleme ve release, izleme ve bildirimler, hata ayıklama, maliyet ve limitler, diğer CI/CD araçları ve toptan gıda e-ticaret projesi için tam pipeline.", en: "Code quality and security scanning, versioning and releases, monitoring and notifications, debugging, cost and limits, other CI/CD tools and a complete pipeline for the wholesale food e-commerce project." }),
      lesson("h", 10, "mulakat-soru-cevap-ve-ozet", { tr: "CI/CD ve GitHub Actions: Mülakat Soru-Cevap ve Tek Sayfalık Özet", en: "CI/CD and GitHub Actions: Interview Q&A and One-Page Summary" }, { tr: "CI/CD ve GitHub Actions üzerine 30 mülakat sorusu ile cevapları ve rehberin tek sayfalık özeti.", en: "Thirty interview questions and answers on CI/CD and GitHub Actions, plus a one-page summary of the guide." }),
      lesson("h", 11, "grafana-notes", { tr: "Grafana: Başlangıçtan İleri Seviyeye Tam Notlar", en: "Grafana Complete Notes (Beginner to Advanced)" }, { tr: "Grafana mimarisini, veri kaynaklarını, dashboard ve panelleri, PromQL ve LogQL sorgularını, uyarıları, log-metrik-trace gözlemlenebilirliğini, gerçek dünya izleme senaryolarını ve performans en iyi uygulamalarını kapsar.", en: "Covers Grafana architecture, data sources, dashboards and panels, PromQL and LogQL queries, alerting, logs-metrics-traces observability, real-world monitoring scenarios and performance best practices." }),
      lesson("h", 12, "ai-for-devops-notes", { tr: "DevOps için Yapay Zeka: Başlangıçtan İleri Seviyeye Tam Notlar", en: "AI for DevOps Complete Notes (Beginner to Advanced)" }, { tr: "Yapay zekanın CI/CD, altyapı yönetimi, izleme ve gözlemlenebilirlik, AIOps, olay yönetimi, log analizi, bulut maliyeti, DevSecOps, otomasyon, kodlama asistanları, Kubernetes ve Docker'da kullanımını, araçları, en iyi uygulamaları ve mülakat sorularını kapsar.", en: "Covers how AI is used in CI/CD, infrastructure management, monitoring and observability, AIOps, incident management, log analysis, cloud cost, DevSecOps, automation, coding assistants, Kubernetes and Docker, along with tools, best practices and interview questions." }),
    ],
  },
  {
    id: "i-api-sql-testing",
    slug: "api-sql-testing",
    code: "I",
    order: 9,
    title: { tr: "API, SQL ve Test", en: "APIs, SQL and Testing" },
    description: { tr: "API nasıl oluşturulur ve çağrılır, REST tasarımı, API testleri ve SQL: kişisel notlar ve rehberler.", en: "How APIs are built and called, REST design, API testing and SQL: personal notes and guides." },
    icon: "route",
    color: "#f97316",
    lessons: [
      lesson("i", 1, "how-apis-are-created-and-called", { tr: "API Nasıl Oluşturulur? / API Çağrıldığında Ne Olur?", en: "How to Create an API? / What Happens When an API is Called?" }, { tr: "Node.js, Express ve MongoDB ile planlamadan yayına 9 adımda uçtan uca API oluşturmayı ve bir API çağrısının istemciden arayüz güncellemesine kadar izlediği 10 adımlık akışı anlatır.", en: "Covers building an API end to end in 9 steps with Node.js, Express and MongoDB, from planning to deployment, and the 10-step flow an API call follows from the client to the UI update." }),
      lesson("i", 2, "api-ve-rest-api-temeller-ve-guvenlik", { tr: "API ve REST API: Temeller, HTTP, Kimlik Doğrulama, CORS ve Postman ile Test", en: "API and REST API: Fundamentals, HTTP, Authentication, CORS and Testing with Postman" }, { tr: "API ve REST kavramlarını, HTTP yöntemlerini, durum kodlarını, header'ları, kimlik doğrulama ve yetkilendirmeyi, API key, JWT ve OAuth 2.0'ı, CORS'u, rate limiting'i, API Gateway'i ve Postman ile API testini toptan gıda e-ticareti örnekleriyle anlatır.", en: "Explains API and REST concepts, HTTP methods, status codes, headers, authentication and authorization, API keys, JWT and OAuth 2.0, CORS, rate limiting, API Gateway and API testing with Postman using wholesale food e-commerce examples." }),
      lesson("i", 3, "api-ve-rest-api-tasarim-guvenlik-ve-idempotency", { tr: "API ve REST API: Versiyonlama, Webhook, Pagination, Dokümantasyon, Güvenlik ve Idempotency", en: "API and REST API: Versioning, Webhooks, Pagination, Documentation, Security and Idempotency" }, { tr: "API versiyonlamayı, latency'yi, senkron ve asenkron API'leri, webhook'ları, parametreleri, pagination'ı, hata yönetimini, OpenAPI ve schema'yı, REST'in SOAP ve GraphQL ile farkını, HATEOAS'ı, tasarım ilkelerini, API güvenliğini ve idempotency'yi anlatır.", en: "Covers API versioning, latency, synchronous and asynchronous APIs, webhooks, parameters, pagination, error handling, OpenAPI and schemas, REST vs SOAP and GraphQL, HATEOAS, design principles, API security and idempotency." }),
      lesson("i", 4, "api-ve-rest-api-uctan-uca-ornek-ve-mulakat", { tr: "API ve REST API: Uçtan Uca E-ticaret Örneği, Mülakat Soru-Cevap ve Özet", en: "API and REST API: End-to-End E-commerce Example, Interview Q&A and Summary" }, { tr: "Toptan satış sitesi için örnek endpoint yapısını, uçtan uca sipariş akışını, Google ile giriş (OAuth 2.0) akışını, PostgreSQL veritabanı taslağını ve Postman koleksiyonunu anlatır; ardından 30 mülakat sorusu ve tek sayfalık özet tablolarını verir.", en: "Presents a sample endpoint structure for a wholesale site, the end-to-end order flow, the Sign in with Google (OAuth 2.0) flow, a PostgreSQL database draft and the Postman collection, followed by 30 interview questions and one-page summary tables." }),
      lesson("i", 5, "api-testing-notes", { tr: "API Testi: Kapsamlı Notlar", en: "API Testing Complete Notes" }, { tr: "HTTP temelleri, metotlar, istek ve yanıt yapısı, durum kodları, kimlik doğrulama, JSON ve JSONPath, test iş akışı ve doğrulama, Postman, REST Assured, mülakat soruları ve hata ayıklamayı kapsayan API testi notları.", en: "API testing notes covering HTTP fundamentals, methods, request and response structure, status codes, authentication, JSON and JSONPath, testing workflow and validation, Postman, REST Assured, interview questions and debugging." }),
      lesson("i", 6, "sql-notes", { tr: "SQL Kapsamlı Notlar", en: "SQL Complete Notes" }, { tr: "SQL temellerinden SELECT, filtreleme, sıralama, aggregate fonksiyonlar, GROUP BY, JOIN, alt sorgular, CASE, DDL, DML, TCL, kısıtlar, indeksler, view ve window fonksiyonlarına, mülakat özetiyle birlikte.", en: "From SQL basics through SELECT, filtering, sorting, aggregate functions, GROUP BY, joins, subqueries, CASE, DDL, DML, TCL, constraints, indexes, views and window functions, with an interview cheat sheet." }),
    ],
  },
  {
    id: "j-system-design-notes",
    slug: "system-design-notes",
    code: "J",
    order: 10,
    title: { tr: "Sistem Tasarımı Notları ve Vakalar", en: "System Design Notes and Case Studies" },
    description: { tr: "Temel sistem tasarımı kalıpları, Redis ve Kafka, Amazon ölçeğinde e-ticaret ve yemek siparişi platformu tasarımı.", en: "Core system design patterns, Redis and Kafka, Amazon-scale e-commerce and a food delivery platform design." },
    icon: "network",
    color: "#14b8a6",
    lessons: [
      lesson("j", 1, "must-know-system-design-patterns", { tr: "Bilinmesi Gereken 15 Sistem Tasarımı Kalıbı", en: "Top 15 Must-Know System Design Patterns" }, { tr: "Load balancer, caching, replikasyon, sharding, mesaj kuyruğu, event-driven mimari, API gateway, circuit breaker, CQRS, saga, rate limiting, distributed lock, service discovery ve CDN kalıplarını mülakat ipuçlarıyla anlatan el yazısı notlar.", en: "Handwritten notes covering load balancing, caching, replication, sharding, message queues, event-driven architecture, API gateway, circuit breaker, CQRS, saga, rate limiting, distributed lock, service discovery and CDN with interview tips." }),
      lesson("j", 2, "system-design-notes-part-1", { tr: "Sistem Tasarımı: Kapsamlı Notlar (Bölüm 1)", en: "System Design Complete Notes Part 1" }, { tr: "Sistem tasarımının temel kavramlarını, gereksinimleri, istek yaşam döngüsünü, mülakat akışını, temel bileşenleri, API ve veritabanı tasarımını, indekslemeyi, önbelleklemeyi, CDN'i, yük dengelemeyi, ölçeklemeyi ve monolit ile mikroservis karşılaştırmasını anlatan notlar.", en: "Notes covering system design fundamentals, requirements, the request lifecycle, interview workflow, core components, API and database design, indexing, caching, CDN, load balancing, scaling and monolith versus microservices." }),
      lesson("j", 3, "system-design-with-redis-and-kafka", { tr: "Redis ve Kafka ile Sistem Tasarımı: Kapsamlı Notlar", en: "System Design with Redis & Kafka (Complete Notes)" }, { tr: "Sistem tasarımı temelleri, mimariler, ağ, veritabanları, önbellekleme, dağıtık sistemler, mesajlaşma, ölçeklenebilirlik, depolama ve güvenlikten Redis ve Kafka'nın ayrıntılarına ve gerçek bir yemek siparişi sistem tasarımına kadar uzanan notlar.", en: "Notes spanning system design fundamentals, architectures, networking, databases, caching, distributed systems, messaging, scalability, storage and security through Redis and Kafka in depth and a real food-delivery system design." }),
      lesson("j", 4, "amazon-mimari-veri-ve-siparis-akisi", { tr: "Amazon Ölçeğinde E-Ticaret Sistem Tasarımı: Mimari, Veri ve Sipariş Akışı", en: "Amazon-Scale E-Commerce System Design: Architecture, Data and Order Flow" }, { tr: "Tek sunucudan mikroservise büyüme evrelerini, global altyapıyı, uçtan uca mimariyi, bir isteğin yolculuğunu, önbelleklemeyi, veritabanı ölçeklemeyi, son 1 ürün problemini, Saga ile sipariş-ödeme akışını ve arama, öneri ve fiyat servislerini ele alır.", en: "Covers the growth stages from a single server to microservices, global infrastructure, end-to-end architecture, the journey of a request, caching, database scaling, the last-item problem, the order-payment flow with Saga, and search, recommendation and pricing services." }),
      lesson("j", 5, "amazon-dayaniklilik-mesajlasma-ve-isletim", { tr: "Amazon Ölçeğinde E-Ticaret Sistem Tasarımı: Dayanıklılık, Mesajlaşma ve İşletim", en: "Amazon-Scale E-Commerce System Design: Resilience, Messaging and Operations" }, { tr: "Güvenilirlik desenlerini, güvenliği, DevOps ve gözlemlenebilirliği, kampanya günü hazırlığını, kapasite hesabını, Kafka, RabbitMQ ve SQS ile mesajlaşmayı, servis iletişimini, Kubernetes'i, yardımcı servisleri ve kendi projen için yol haritasını ele alır.", en: "Covers reliability patterns, security, DevOps and observability, campaign-day preparation, capacity estimation, messaging with Kafka, RabbitMQ and SQS, service communication, Kubernetes, supporting services and a roadmap for your own project." }),
      lesson("j", 6, "giris-mimari-ve-siparis-akisi", { tr: "Yemek Siparişi Platformu: Giriş, Yüksek Seviye Mimari ve Sipariş Akışı", en: "Food Delivery Platform: Introduction, High-Level Architecture and Order Flow" }, { tr: "Rehberin kapsamı, sistem tasarımı mülakat adımları ve gereksinimler, mikroservis tabanlı yüksek seviye mimari ile uçtan uca kullanıcı yolculuğu ve sipariş akışı.", en: "The guide scope, system design interview steps and requirements, the microservice-based high-level architecture, and the end-to-end user journey and order flow." }),
      lesson("j", 7, "kesif-menu-ve-siparis-servisi", { tr: "Yemek Siparişi Platformu: Restoran Keşfi, Menü ve Sipariş Servisi", en: "Food Delivery Platform: Restaurant Discovery, Menu and Order Service" }, { tr: "Elasticsearch ve Redis ile restoran arama, restoran ve menü servisinin veri modeli ve önbellek stratejisi, sipariş servisinin durum makinesi, Saga ve Outbox desenleri.", en: "Restaurant search with Elasticsearch and Redis, the restaurant and menu service data model and caching strategy, and the order service state machine with the Saga and Outbox patterns." }),
      lesson("j", 8, "sepet-odeme-ve-kurye-atama", { tr: "Yemek Siparişi Platformu: Sepet, Ödeme ve Kurye Atama", en: "Food Delivery Platform: Cart, Payment and Courier Assignment" }, { tr: "Redis tabanlı sepet ve checkout akışı, ödeme sisteminin mimarisi, durumları, şeması ve webhook yönetimi ile puanlama algoritması ve Redis Geo kullanan kurye atama sistemi.", en: "The Redis-based cart and checkout flow, the payment system architecture, states, schema and webhook handling, and the courier assignment system using a scoring algorithm and Redis Geo." }),
      lesson("j", 9, "takip-bildirim-ve-kampanyalar", { tr: "Yemek Siparişi Platformu: Gerçek Zamanlı Takip, Bildirim ve Kupon Sistemleri", en: "Food Delivery Platform: Real-Time Tracking, Notification and Coupon Systems" }, { tr: "WebSocket, polling ve SSE ile gerçek zamanlı sipariş takibi ve ETA hesaplama, çok kanallı bildirim sistemi ve hata yönetimi ile kupon ve kampanya doğrulama ve indirim hesaplama.", en: "Real-time order tracking with WebSocket, polling and SSE plus ETA calculation, the multi-channel notification system and failure handling, and coupon and campaign validation and discount calculation." }),
      lesson("j", 10, "sadakat-olcekleme-ve-en-iyi-uygulamalar", { tr: "Yemek Siparişi Platformu: Sadakat, Takip Sistemini Ölçekleme ve En İyi Uygulamalar", en: "Food Delivery Platform: Loyalty, Scaling the Tracking System and Best Practices" }, { tr: "Sadakat ve davet sisteminin akışları ve veri modeli, takip sistemini Redis GeoHash, Kafka ve WebSocket ile ölçekleme, ardından en iyi uygulamalar, gerçek dünyadan dersler ve nihai teknoloji yığını.", en: "The flows and data model of the loyalty and referral system, scaling the tracking system with Redis GeoHash, Kafka and WebSocket, followed by best practices, real-world lessons and the final technology stack." }),
      lesson("j", 11, "odunlesimler-mulakat-ve-ozet", { tr: "Yemek Siparişi Platformu: Ödünleşimler, Mülakat Soruları ve Özet", en: "Food Delivery Platform: Trade-offs, Interview Questions and Summary" }, { tr: "Sistem tasarımı ödünleşimleri (SQL ve NoSQL, CAP, eventual consistency, ölçekleme), örnek cevaplı mülakat soruları, proje yol haritası, sonraki adımlar ve tek sayfalık özet.", en: "System design trade-offs (SQL vs NoSQL, CAP, eventual consistency, scaling), interview questions with sample answers, a project roadmap, next steps and a one-page summary." }),
    ],
  },
];

export const LEARNING_PATHS: LearningPathManifest[] = [
  {
    id: 'backend',
    slug: 'backend',
    title: { tr: 'Backend Geliştirici', en: 'Backend Developer' },
    description: { tr: 'API’ler, veritabanları, kuyruklar ve altyapı.', en: 'APIs, databases, queues and infrastructure.' },
    icon: 'terminal',
    items: ['a-system-design-fundamentals', 'd-database-design', 'c-design-patterns', 'f-code-and-infrastructure'],
  },
  {
    id: 'system-design',
    slug: 'system-design',
    title: { tr: 'Sistem Tasarımı', en: 'System Design' },
    description: { tr: 'Ölçeklenebilir sistemlerin tasarımı ve vaka çalışmaları.', en: 'Designing scalable systems with case studies.' },
    icon: 'network',
    items: ['a-system-design-fundamentals', 'b-architectures', 'e-case-studies', 'f-code-and-infrastructure'],
  },
  {
    id: 'ai',
    slug: 'ai',
    title: { tr: 'Yapay Zekâ', en: 'Artificial Intelligence' },
    description: { tr: 'ML temellerinden LLM ve MLOps’a.', en: 'From ML foundations to LLMs and MLOps.' },
    icon: 'brain',
    items: ['g-artificial-intelligence', 'a-system-design-fundamentals/a-07-caching', 'a-system-design-fundamentals/a-09-message-queues-event-driven'],
  },
  {
    id: 'interview-prep',
    slug: 'interview-prep',
    title: { tr: 'Mülakat Hazırlığı', en: 'Interview Preparation' },
    description: { tr: 'Sistem tasarımı mülakatları için hızlandırılmış rota.', en: 'An accelerated route for system design interviews.' },
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

export function findLesson(lessonId: string): { module: CurriculumModule; lesson: CurriculumLesson } | undefined {
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
