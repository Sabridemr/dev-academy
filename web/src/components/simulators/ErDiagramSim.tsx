'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, RotateCcw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Field, Select, SimShell } from './ui';
import { boolParam, strParam, type SimulatorProps } from './types';

type Cardinality = '1-1' | '1-N' | 'N-M';
type PresetId = 'ecommerce' | 'social' | 'payments' | 'messaging';

type FieldDef = { name: string; type: string; pk?: boolean; fk?: string };
type EntityData = { name: string; fields: FieldDef[] };
type EntityNode = Node<EntityData, 'entity'>;
type RelEdge = Edge<{ cardinality: Cardinality }>;

const PRESETS: Record<
  PresetId,
  { entities: EntityData[]; relations: [string, string, Cardinality][] }
> = {
  ecommerce: {
    entities: [
      {
        name: 'customers',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'email', type: 'VARCHAR(255)' },
          { name: 'name', type: 'VARCHAR(120)' },
        ],
      },
      {
        name: 'orders',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'customer_id', type: 'BIGINT', fk: 'customers' },
          { name: 'status', type: 'VARCHAR(20)' },
          { name: 'created_at', type: 'TIMESTAMP' },
        ],
      },
      {
        name: 'order_items',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'order_id', type: 'BIGINT', fk: 'orders' },
          { name: 'product_id', type: 'BIGINT', fk: 'products' },
          { name: 'quantity', type: 'INT' },
        ],
      },
      {
        name: 'products',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'sku', type: 'VARCHAR(64)' },
          { name: 'price', type: 'NUMERIC(10,2)' },
        ],
      },
    ],
    relations: [
      ['customers', 'orders', '1-N'],
      ['orders', 'order_items', '1-N'],
      ['products', 'order_items', '1-N'],
    ],
  },
  social: {
    entities: [
      {
        name: 'users',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'handle', type: 'VARCHAR(30)' },
          { name: 'bio', type: 'TEXT' },
        ],
      },
      {
        name: 'posts',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'user_id', type: 'BIGINT', fk: 'users' },
          { name: 'body', type: 'TEXT' },
          { name: 'created_at', type: 'TIMESTAMP' },
        ],
      },
      {
        name: 'likes',
        fields: [
          { name: 'user_id', type: 'BIGINT', pk: true, fk: 'users' },
          { name: 'post_id', type: 'BIGINT', pk: true, fk: 'posts' },
        ],
      },
      {
        name: 'profiles',
        fields: [
          { name: 'user_id', type: 'BIGINT', pk: true, fk: 'users' },
          { name: 'avatar_url', type: 'TEXT' },
        ],
      },
    ],
    relations: [
      ['users', 'posts', '1-N'],
      ['posts', 'likes', '1-N'],
      ['users', 'profiles', '1-1'],
    ],
  },
  payments: {
    entities: [
      {
        name: 'merchants',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'name', type: 'VARCHAR(120)' },
        ],
      },
      {
        name: 'accounts',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'merchant_id', type: 'BIGINT', fk: 'merchants' },
          { name: 'currency', type: 'CHAR(3)' },
        ],
      },
      {
        name: 'transactions',
        fields: [
          { name: 'id', type: 'UUID', pk: true },
          { name: 'idempotency_key', type: 'VARCHAR(64)' },
          { name: 'amount', type: 'NUMERIC(18,2)' },
          { name: 'status', type: 'VARCHAR(20)' },
        ],
      },
      {
        name: 'ledger_entries',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'transaction_id', type: 'UUID', fk: 'transactions' },
          { name: 'account_id', type: 'BIGINT', fk: 'accounts' },
          { name: 'direction', type: 'CHAR(1)' },
          { name: 'amount', type: 'NUMERIC(18,2)' },
        ],
      },
    ],
    relations: [
      ['merchants', 'accounts', '1-N'],
      ['transactions', 'ledger_entries', '1-N'],
      ['accounts', 'ledger_entries', '1-N'],
    ],
  },
  messaging: {
    entities: [
      {
        name: 'users',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'name', type: 'VARCHAR(120)' },
        ],
      },
      {
        name: 'conversations',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'title', type: 'VARCHAR(120)' },
          { name: 'is_group', type: 'BOOLEAN' },
        ],
      },
      {
        name: 'participants',
        fields: [
          { name: 'conversation_id', type: 'BIGINT', pk: true, fk: 'conversations' },
          { name: 'user_id', type: 'BIGINT', pk: true, fk: 'users' },
          { name: 'joined_at', type: 'TIMESTAMP' },
        ],
      },
      {
        name: 'messages',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'conversation_id', type: 'BIGINT', fk: 'conversations' },
          { name: 'sender_id', type: 'BIGINT', fk: 'users' },
          { name: 'body', type: 'TEXT' },
          { name: 'sent_at', type: 'TIMESTAMP' },
        ],
      },
      {
        name: 'message_receipts',
        fields: [
          { name: 'message_id', type: 'BIGINT', pk: true, fk: 'messages' },
          { name: 'user_id', type: 'BIGINT', pk: true, fk: 'users' },
          { name: 'read_at', type: 'TIMESTAMP' },
        ],
      },
    ],
    relations: [
      ['conversations', 'participants', '1-N'],
      ['users', 'participants', '1-N'],
      ['conversations', 'messages', '1-N'],
      ['users', 'messages', '1-N'],
      ['messages', 'message_receipts', '1-N'],
    ],
  },
};
const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
const CARDS: Cardinality[] = ['1-1', '1-N', 'N-M'];

const L = {
  tr: {
    title: 'ER diyagramı → SQL DDL',
    preset: 'Hazır şema',
    presets: {
      ecommerce: 'E-ticaret',
      social: 'Sosyal ağ',
      payments: 'Ödemeler',
      messaging: 'Mesajlaşma',
    } satisfies Record<PresetId, string>,
    cardinality: 'Yeni ilişki kardinalitesi',
    addEntity: 'Varlık ekle',
    entityName: 'Yeni varlık adı',
    addField: 'Seçili varlığa alan ekle',
    fieldName: 'Alan adı',
    fieldType: 'Tip',
    selected: 'Seçili',
    none: 'yok — bir tabloya tıkla',
    ddl: 'Üretilen SQL DDL',
    hint: 'Tabloları sürükle. Bir tablonun sağ tutamacından diğerinin sol tutamacına sürükleyerek ilişki kur. İlişki etiketine tıklayınca kardinalite değişir (1-1 → 1-N → N-M).',
  },
  en: {
    title: 'ER diagram → SQL DDL',
    preset: 'Preset schema',
    presets: {
      ecommerce: 'E-commerce',
      social: 'Social network',
      payments: 'Payments',
      messaging: 'Messaging',
    } satisfies Record<PresetId, string>,
    cardinality: 'New relation cardinality',
    addEntity: 'Add entity',
    entityName: 'New entity name',
    addField: 'Add field to selected entity',
    fieldName: 'Field name',
    fieldType: 'Type',
    selected: 'Selected',
    none: 'none — click a table',
    ddl: 'Generated SQL DDL',
    hint: 'Drag tables. Drag from a table’s right handle to another’s left handle to create a relation. Click a relation label to cycle its cardinality (1-1 → 1-N → N-M).',
  },
};

/** Tablo düğümü: başlık + alan listesi; sol hedef, sağ kaynak tutamaç */
function EntityNodeView({ data, selected }: NodeProps<EntityNode>) {
  return (
    <div
      className={`min-w-[170px] overflow-hidden rounded-xl border-2 bg-surface text-xs shadow-card ${selected ? 'border-primary' : 'border-border'}`}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-[var(--da-accent)]" />
      <div className="bg-primary/15 px-2 py-1 font-semibold text-primary">{data.name}</div>
      <ul className="divide-y divide-border">
        {data.fields.map((f) => (
          <li key={f.name} className="flex justify-between gap-3 px-2 py-0.5 font-mono">
            <span className={f.pk ? 'font-semibold text-fg' : 'text-fg'}>
              {f.pk ? '🔑 ' : f.fk ? '↗ ' : ''}
              {f.name}
            </span>
            <span className="text-muted">{f.type}</span>
          </li>
        ))}
      </ul>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !bg-[var(--da-primary)]"
      />
    </div>
  );
}

const nodeTypes = { entity: EntityNodeView };

function buildPreset(
  preset: PresetId,
  tableFilter: string[] | null,
  showCard: boolean,
): { nodes: EntityNode[]; edges: RelEdge[] } {
  const p = PRESETS[preset];
  const entities =
    tableFilter && tableFilter.length
      ? p.entities.filter((e) => tableFilter.includes(e.name))
      : p.entities;
  const nodes: EntityNode[] = entities.map((e, i) => ({
    id: e.name,
    type: 'entity',
    position: { x: (i % 3) * 250, y: Math.floor(i / 3) * 210 + (i % 2) * 40 },
    data: { name: e.name, fields: e.fields.map((f) => ({ ...f })) },
  }));
  const names = new Set(entities.map((e) => e.name));
  const edges: RelEdge[] = p.relations
    .filter(([a, b]) => names.has(a) && names.has(b))
    .map(([a, b, c]) => makeEdge(a, b, c, showCard));
  return { nodes, edges };
}

function makeEdge(
  source: string,
  target: string,
  cardinality: Cardinality,
  showCard = true,
): RelEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    label: showCard ? cardinality : undefined,
    data: { cardinality },
    markerEnd: { type: MarkerType.ArrowClosed },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 6,
    labelStyle: { fill: 'var(--da-fg)', fontWeight: 600, fontSize: 11 },
    labelBgStyle: { fill: 'var(--da-elevated)' },
    style: { stroke: 'var(--da-muted)', strokeWidth: 1.5 },
  };
}

const singular = (name: string) =>
  name.endsWith('ies') ? `${name.slice(0, -3)}y` : name.endsWith('s') ? name.slice(0, -1) : name;

/** DDL üretimi: ilişkilere göre FK kolonları ve N-M için ara tablo eklenir */
function generateDdl(nodes: EntityNode[], edges: RelEdge[]): string {
  const tables = new Map(
    nodes.map((n) => [
      n.id,
      { name: n.data.name, fields: n.data.fields.map((f) => ({ ...f })), extra: [] as string[] },
    ]),
  );
  const junctions: string[] = [];
  for (const e of edges) {
    const src = tables.get(e.source);
    const tgt = tables.get(e.target);
    if (!src || !tgt) continue;
    const card = e.data?.cardinality ?? '1-N';
    if (card === 'N-M') {
      const a = singular(src.name);
      const b = singular(tgt.name);
      junctions.push(
        `CREATE TABLE ${src.name}_${tgt.name} (\n  ${a}_id BIGINT NOT NULL REFERENCES ${src.name}(id),\n  ${b}_id BIGINT NOT NULL REFERENCES ${tgt.name}(id),\n  PRIMARY KEY (${a}_id, ${b}_id)\n);`,
      );
      continue;
    }
    const existing = tgt.fields.find((f) => f.fk === src.name);
    const col = existing?.name ?? `${singular(src.name)}_id`;
    if (!existing) tgt.fields.push({ name: col, type: 'BIGINT', fk: src.name });
    else existing.fk = src.name;
    if (card === '1-1' && !existing?.pk) tgt.extra.push(`UNIQUE (${col})`);
  }
  const out: string[] = [];
  for (const tb of tables.values()) {
    const lines = tb.fields.map(
      (f) =>
        `  ${f.name} ${f.type}${f.pk && tb.fields.filter((x) => x.pk).length === 1 ? ' PRIMARY KEY' : ''}${f.fk ? ` REFERENCES ${f.fk}(id)` : ''}`,
    );
    const pks = tb.fields.filter((x) => x.pk);
    if (pks.length > 1) lines.push(`  PRIMARY KEY (${pks.map((p) => p.name).join(', ')})`);
    for (const x of tb.extra) lines.push(`  ${x}`);
    out.push(`CREATE TABLE ${tb.name} (\n${lines.join(',\n')}\n);`);
  }
  return [...out, ...junctions].join('\n\n');
}

export default function ErDiagramSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const tableFilter =
    typeof params.tables === 'string'
      ? params.tables
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
  const showCard = boolParam(params, 'showCardinality', true);
  // Preset verilmemişse tablo listesiyle en çok örtüşen hazır şemayı seç
  const guessed: PresetId = tableFilter
    ? PRESET_IDS.reduce((best, id) => {
        const score = (pid: PresetId) =>
          PRESETS[pid].entities.filter((e) => tableFilter.includes(e.name)).length;
        return score(id) > score(best) ? id : best;
      }, 'ecommerce' as PresetId)
    : 'ecommerce';
  const [preset, setPreset] = useState<PresetId>(() =>
    strParam(params, 'preset', guessed, PRESET_IDS),
  );
  // Başlangıç şeması yalnızca ilk render'da kurulur
  const [initial] = useState(() => buildPreset(preset, tableFilter, showCard));
  const [nodes, setNodes] = useState<EntityNode[]>(initial.nodes);
  const [edges, setEdges] = useState<RelEdge[]>(initial.edges);
  const [newCard, setNewCard] = useState<Cardinality>('1-N');
  const [entityName, setEntityName] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('VARCHAR(255)');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange<EntityNode>[]) => {
      setNodes((ns) => applyNodeChanges(changes, ns));
      for (const c of changes) {
        if (c.type === 'select' && c.selected) setSelectedId(c.id);
        if (c.type === 'position' && c.dragging) onInteract();
      }
    },
    [onInteract],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<RelEdge>[]) => setEdges((es) => applyEdgeChanges(changes, es)),
    [],
  );
  const onConnect = useCallback(
    (c: Connection) => {
      onInteract();
      if (!c.source || !c.target || c.source === c.target) return;
      setEdges((es) =>
        addEdge(
          makeEdge(c.source, c.target, newCard, true),
          es.filter((e) => e.id !== `${c.source}->${c.target}`),
        ),
      );
    },
    [newCard, onInteract],
  );
  const cycleEdge = (_: unknown, edge: RelEdge) => {
    onInteract();
    const cur = edge.data?.cardinality ?? '1-N';
    const next = CARDS[(CARDS.indexOf(cur) + 1) % CARDS.length];
    setEdges((es) =>
      es.map((e) => (e.id === edge.id ? makeEdge(e.source, e.target, next, true) : e)),
    );
  };

  const loadPreset = (p: PresetId) => {
    onInteract();
    setPreset(p);
    const b = buildPreset(p, null, showCard);
    setNodes(b.nodes);
    setEdges(b.edges);
    setSelectedId(null);
  };

  const addEntity = () => {
    const name = entityName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
    if (!name || nodes.some((n) => n.id === name)) return;
    onInteract();
    setNodes((ns) => [
      ...ns,
      {
        id: name,
        type: 'entity',
        position: { x: 40 + (ns.length % 3) * 250, y: 380 },
        data: { name, fields: [{ name: 'id', type: 'BIGINT', pk: true }] },
      },
    ]);
    setEntityName('');
    setSelectedId(name);
  };

  const addField = () => {
    const name = fieldName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
    if (!name || !selectedId) return;
    onInteract();
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedId && !n.data.fields.some((f) => f.name === name)
          ? { ...n, data: { ...n.data, fields: [...n.data.fields, { name, type: fieldType }] } }
          : n,
      ),
    );
    setFieldName('');
  };

  const ddl = useMemo(() => generateDdl(nodes, edges), [nodes, edges]);

  // xyflow'un kendi CSS değişkenlerini tema token'larına bağla (açık/koyu tema uyumu)
  const flowStyle = {
    background: 'var(--da-bg)',
    '--xy-node-background-color-default': 'transparent',
    '--xy-node-border-default': 'none',
    '--xy-edge-stroke-default': 'var(--da-muted)',
    '--xy-controls-button-background-color-default': 'var(--da-surface)',
    '--xy-controls-button-color-default': 'var(--da-fg)',
    '--xy-controls-button-border-color-default': 'var(--da-border)',
    '--xy-controls-button-background-color-hover-default': 'var(--da-elevated)',
  } as CSSProperties;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <button type="button" className="btn-ghost" onClick={() => loadPreset(preset)}>
          <RotateCcw size={14} /> {locale === 'tr' ? 'Sıfırla' : 'Reset'}
        </button>
      }
      aside={
        <>
          <Select
            label={l.preset}
            value={preset}
            options={PRESET_IDS.map((p) => ({ id: p, label: l.presets[p] }))}
            onChange={loadPreset}
          />
          <Select
            label={l.cardinality}
            value={newCard}
            options={CARDS.map((c) => ({ id: c, label: c }))}
            onChange={setNewCard}
          />
          <Field label={l.entityName}>
            <div className="flex gap-1">
              <input
                className="input"
                value={entityName}
                placeholder="reviews"
                onChange={(e) => setEntityName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEntity()}
              />
              <button
                type="button"
                className="btn-icon shrink-0"
                aria-label={l.addEntity}
                title={l.addEntity}
                onClick={addEntity}
              >
                <Plus size={14} />
              </button>
            </div>
          </Field>
          <div className="space-y-1">
            <p className="label">{l.addField}</p>
            <p className="text-xs text-muted">
              {l.selected}: <span className="font-mono text-fg">{selectedId ?? l.none}</span>
            </p>
            <div className="flex gap-1">
              <input
                className="input"
                aria-label={l.fieldName}
                placeholder={l.fieldName}
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addField()}
                disabled={!selectedId}
              />
              <select
                className="input w-28 shrink-0"
                aria-label={l.fieldType}
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value)}
                disabled={!selectedId}
              >
                {[
                  'VARCHAR(255)',
                  'TEXT',
                  'INT',
                  'BIGINT',
                  'NUMERIC(10,2)',
                  'BOOLEAN',
                  'TIMESTAMP',
                  'UUID',
                  'JSONB',
                ].map((tp) => (
                  <option key={tp}>{tp}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-icon shrink-0"
                aria-label={l.addField}
                onClick={addField}
                disabled={!selectedId || !fieldName.trim()}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted">{l.hint}</p>
        </>
      }
    >
      <div className="h-[440px] overflow-hidden rounded-xl border border-border">
        <ReactFlow<EntityNode, RelEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={cycleEdge}
          onPaneClick={() => setSelectedId(null)}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
          style={flowStyle}
        >
          <Background color="var(--da-border)" gap={18} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <figure className="mt-3">
        <figcaption className="label">{l.ddl}</figcaption>
        <pre
          className="max-h-72 overflow-auto rounded-xl border border-border bg-bg/60 p-3 font-mono text-[11px] leading-5"
          aria-live="polite"
        >
          {ddl}
        </pre>
      </figure>
    </SimShell>
  );
}
