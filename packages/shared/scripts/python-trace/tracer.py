#!/usr/bin/env python3
"""
PYTHON KOD İZİ ÜRETİCİSİ
------------------------
content/ altındaki her `<ad>.trace.py` dosyasını gerçekten çalıştırır ve yanına `<ad>.trace.json`
yazar: her adımda çalışacak satır, çağrı yığını (çerçeveler + yerel değişkenler), heap'teki
nesneler ve o ana kadarki çıktı. Şema: packages/shared/src/content/trace.ts (CodeTraceSchema).

Kaynak dosyadaki özel yorumlar (gösterilen koddan çıkarılır, satır numaraları buna göre verilir):
  x = 5  #@ Türkçe açıklama | English note   → bu satır çalışmadan önceki adımda gösterilir
  #@ Türkçe açıklama | English note          → tek başına satır: bir sonraki kod satırına bağlanır
  #! heap-primitives                         → int/str gibi basit değerleri de heap nesnesi olarak göster

Kullanım (depo kökünden):
  pnpm content:traces                 # tüm izleri yeniden üret
  python3 tracer.py <dosya.trace.py>  # tek dosya
"""
import builtins
import contextlib
import hashlib
import inspect
import io
import json
import os
import re
import sys
import types
from pathlib import Path

MAX_STEPS = 300
MAX_ITEMS = 30
MAX_REPR = 60
FILENAME = '<trace>'
PRIMITIVES = (int, float, complex, str, bool, type(None))
NOTE_RE = re.compile(r'(^|\s)#@\s?(.*)$')


class TraceError(Exception):
    pass


def parse_source(src: str):
    """Ayar satırlarını ve açıklama yorumlarını ayıklar → (gösterilen kod, ayarlar, satır → not)."""
    options: set[str] = set()
    lines: list[str] = []
    notes: dict[int, list[str]] = {}
    pending: list[str] = []
    for raw in src.rstrip().split('\n'):
        if raw.startswith('#!'):
            options.update(raw[2:].split())
            continue
        m = NOTE_RE.search(raw)
        code = raw[: m.start()].rstrip() if m else raw.rstrip()
        if m and not code.strip():
            pending.append(m.group(2).strip())
            continue
        lines.append(code)
        texts = pending + ([m.group(2).strip()] if m else [])
        pending = []
        if texts:
            notes[len(lines)] = texts
    if pending:
        raise TraceError('Dosya sonundaki #@ açıklamasının bağlanacağı kod satırı yok')
    parsed: dict[int, dict] = {}
    for line, texts in notes.items():
        tr, en = [], []
        for t in texts:
            a, sep, b = t.partition('|')
            tr.append(a.strip())
            if sep:
                en.append(b.strip())
        parsed[line] = {'tr': ' '.join(tr), 'en': ' '.join(en)} if en else ' '.join(tr)
    return '\n'.join(lines), options, parsed


ADDRESS_RE = re.compile(r' at 0x[0-9a-fA-F]+')


def short_repr(v) -> str:
    # Bellek adresi her çalıştırmada değişir: iz deterministik kalsın
    r = ADDRESS_RE.sub('', repr(v))
    return r if len(r) <= MAX_REPR else r[: MAX_REPR - 1] + '…'


def signature(fn) -> str:
    try:
        sig = str(inspect.signature(fn))
    except (TypeError, ValueError):
        sig = '(…)'
    name = fn.__name__ if fn.__name__ != '<lambda>' else 'lambda'
    return f'{name}{sig}'


class Tracer:
    def __init__(self, code: str, options: set[str], notes: dict[int, dict]):
        self.code = code
        self.inline = 'heap-primitives' not in options
        self.notes = notes
        self.obj_ids: dict[int, int] = {}
        self.frame_ids: dict[int, int] = {}
        # Kimlikleri sabit tutmak için nesneler iz boyunca canlı tutulur (id() yeniden kullanılmasın)
        self.keep: list = []
        self.steps: list[dict] = []
        self.out = io.StringIO()
        self.globals = {'__name__': '__main__', '__builtins__': builtins}
        self.user_classes: set[int] = set()
        # Hata yayılırken çıkılan çerçeveler: 'return' adımında dönen değer (None) gösterilmez
        self.raising: set[int] = set()

    # ------------------------------------------------------------------ değerler
    def oid(self, obj) -> int:
        key = id(obj)
        if key not in self.obj_ids:
            self.obj_ids[key] = len(self.obj_ids) + 1
            self.keep.append(obj)
        return self.obj_ids[key]

    def encode(self, v, queue: list):
        if self.inline and isinstance(v, PRIMITIVES):
            return {'t': 'prim', 'type': type(v).__name__, 'repr': short_repr(v)}
        queue.append(v)
        return {'t': 'ref', 'id': self.oid(v)}

    def describe(self, v, queue: list) -> dict:
        enc = lambda x: self.encode(x, queue)  # noqa: E731
        obj = {'id': self.oid(v), 'type': type(v).__name__}
        if isinstance(v, PRIMITIVES):
            return {**obj, 'kind': 'prim', 'repr': short_repr(v)}
        if isinstance(v, (list, tuple, set, frozenset)):
            seq = list(v)
            if isinstance(v, (set, frozenset)):
                seq.sort(key=repr)  # küme sırası çalıştırmalar arasında değişebilir
            kind = 'list' if isinstance(v, list) else 'tuple' if isinstance(v, tuple) else 'set'
            items = [enc(x) for x in seq[:MAX_ITEMS]]
            if len(seq) > MAX_ITEMS:
                items.append({'t': 'prim', 'type': 'ellipsis', 'repr': f'… +{len(seq) - MAX_ITEMS}'})
            return {**obj, 'kind': kind, 'items': items}
        if isinstance(v, dict):
            pairs = list(v.items())[:MAX_ITEMS]
            return {**obj, 'kind': 'dict', 'entries': [[enc(k), enc(x)] for k, x in pairs]}
        if isinstance(v, types.FunctionType):
            out = {**obj, 'kind': 'function', 'repr': signature(v)}
            cells = []
            # Varsayılan değerler tanım anında oluşur ve fonksiyon nesnesinde yaşar ("liste=" → nesne)
            try:
                params = inspect.signature(v).parameters.values()
            except (TypeError, ValueError):
                params = []
            for prm in params:
                if prm.default is not inspect.Parameter.empty and not isinstance(prm.default, PRIMITIVES):
                    cells.append([f'{prm.name}=', enc(prm.default)])
            for var, cell in zip(v.__code__.co_freevars, v.__closure__ or ()):
                try:
                    cells.append([var, enc(cell.cell_contents)])
                except ValueError:
                    pass  # henüz atanmamış hücre
            if cells:
                out['attrs'] = cells
            return out
        if isinstance(v, type):
            bases = [b.__name__ for b in v.__bases__ if b is not object]
            attrs = []
            for k, x in vars(v).items():
                method = x.__func__ if isinstance(x, (staticmethod, classmethod)) else x
                if isinstance(method, types.FunctionType):
                    # Metotlar sınıf kutusunda imzalarıyla gösterilir: her metot ayrı heap kutusu olunca
                    # OOP örneklerinde oklar ve kutular okunmaz hâle gelir
                    prefix = '@staticmethod ' if isinstance(x, staticmethod) else '@classmethod ' if isinstance(x, classmethod) else ''
                    attrs.append([k, {'t': 'prim', 'type': 'method', 'repr': prefix + signature(method)[len(method.__name__):]}])
                elif not (k.startswith('__') and k.endswith('__')):
                    attrs.append([k, enc(x)])
            out = {**obj, 'kind': 'class', 'repr': f"{v.__name__}({', '.join(bases)})" if bases else v.__name__}
            if attrs:
                out['attrs'] = attrs
            return out
        if id(type(v)) in self.user_classes:
            fields = dict(vars(v)) if hasattr(v, '__dict__') else {}
            for slot in getattr(type(v), '__slots__', ()):
                if hasattr(v, slot):
                    fields[slot] = getattr(v, slot)
            return {**obj, 'kind': 'instance', 'attrs': [[k, enc(x)] for k, x in fields.items()]}
        if isinstance(v, types.MethodType):
            return {**obj, 'kind': 'other', 'repr': f'{type(v.__self__).__name__}.{v.__func__.__name__} (bound)'}
        if isinstance(v, types.GeneratorType):
            return {**obj, 'kind': 'other', 'repr': f'<generator {v.__name__}>'}
        return {**obj, 'kind': 'other', 'repr': short_repr(v)}

    # ------------------------------------------------------------------ çerçeveler
    @staticmethod
    def visible(name: str, value) -> bool:
        if name.startswith('__') and name.endswith('__'):
            return False
        return not isinstance(value, types.ModuleType)

    def frame_info(self, frame, queue: list) -> dict:
        key = id(frame)
        if key not in self.frame_ids:
            self.frame_ids[key] = len(self.frame_ids)
            self.keep.append(frame)
        f_locals = dict(frame.f_locals) if frame.f_code.co_name != '<module>' else frame.f_globals
        if frame.f_code.co_name == '<module>':
            name = 'Global'
        elif not frame.f_code.co_flags & inspect.CO_OPTIMIZED:
            name = f'class {frame.f_code.co_name}'  # sınıf gövdesi
        else:
            name = getattr(frame.f_code, 'co_qualname', frame.f_code.co_name)
        for v in f_locals.values():
            if isinstance(v, type) and v.__module__ == '__main__':
                self.user_classes.add(id(v))
        local_vars = [[k, self.encode(v, queue)] for k, v in f_locals.items() if self.visible(k, v)]
        return {'id': self.frame_ids[key], 'name': name, 'line': frame.f_lineno or 1, 'locals': local_vars}

    def heap(self, queue: list) -> list:
        seen: dict[int, dict] = {}
        while queue:
            v = queue.pop(0)
            i = self.oid(v)
            if i in seen:
                continue
            seen[i] = self.describe(v, queue)
            if len(seen) > 200:
                raise TraceError('Heap çok büyük (200+ nesne): örneği küçültün')
        return [seen[i] for i in sorted(seen)]

    def record(self, frame, event: str, arg) -> None:
        if len(self.steps) >= MAX_STEPS:
            raise TraceError(f'İz {MAX_STEPS} adımı aşıyor: örneği kısaltın')
        chain = []
        f = frame
        while f is not None:
            if f.f_code.co_filename == FILENAME:
                chain.append(f)
            f = f.f_back
        chain.reverse()
        queue: list = []
        frames = [self.frame_info(f, queue) for f in chain]
        step = {'line': frame.f_lineno or 1, 'event': event, 'frames': frames}
        # Sınıf gövdesinin 'dönüş değeri' anlamsız (her zaman None)
        if event == 'return' and id(frame) not in self.raising and frame.f_code.co_flags & inspect.CO_OPTIMIZED:
            step['returnValue'] = self.encode(arg, queue)
        if event == 'exception':
            exc_type, exc, _ = arg
            step['exception'] = f'{exc_type.__name__}: {exc}' if str(exc) else exc_type.__name__
        step['heap'] = self.heap(queue)
        step['stdout'] = self.out.getvalue()
        if event == 'line' and step['line'] in self.notes:
            prev = self.steps[-1] if self.steps else None
            # Aynı satır art arda yeniden çalışıyorsa (ör. comprehension) not bir kez gösterilir
            repeated = prev is not None and prev['line'] == step['line'] and prev['frames'][-1]['id'] == frames[-1]['id'] and 'note' in prev
            if not repeated:
                step['note'] = self.notes[step['line']]
        self.steps.append(step)

    def trace(self, frame, event, arg):
        # Python 3.14+ tip açıklamaları için derleyicinin ürettiği __annotate__ fonksiyonları gürültüdür
        if frame.f_code.co_filename != FILENAME or frame.f_code.co_name == '__annotate__':
            return None
        if event == 'exception':
            self.raising.add(id(frame))
        elif event == 'line':
            self.raising.discard(id(frame))  # hata yakalandı, çalışma sürüyor
        # Modül çerçevesinin dönüşü gürültü: programın sonu 'end' adımında gösterilir
        if event == 'return' and frame.f_code.co_name == '<module>':
            return self.trace
        if event in ('call', 'line', 'return', 'exception'):
            self.record(frame, event, arg)
        return self.trace

    # ------------------------------------------------------------------ çalıştırma
    def run(self) -> list[dict]:
        compiled = compile(self.code, FILENAME, 'exec')
        error = None
        with contextlib.redirect_stdout(self.out):
            sys.settrace(self.trace)
            try:
                exec(compiled, self.globals)
            except TraceError:
                raise
            except Exception as exc:  # yakalanmamış hata: son adımda gösterilir
                error = f'{type(exc).__name__}: {exc}' if str(exc) else type(exc).__name__
            finally:
                sys.settrace(None)
        # Modül çerçevesinin 'call' adımı gereksiz (henüz hiçbir şey çalışmadı)
        if self.steps and self.steps[0]['event'] == 'call' and self.steps[0]['frames'][-1]['name'] == 'Global':
            self.steps.pop(0)
        queue: list = []
        local_vars = [[k, self.encode(v, queue)] for k, v in self.globals.items() if self.visible(k, v)]
        last_line = self.steps[-1]['line'] if self.steps else 1
        end = {
            'line': last_line,
            'event': 'end',
            'frames': [{'id': 0, 'name': 'Global', 'line': last_line, 'locals': local_vars}],
        }
        end['heap'] = self.heap(queue)
        end['stdout'] = self.out.getvalue()
        if error:
            end['exception'] = error
        self.steps.append(end)
        return self.steps


def build(py_file: Path) -> dict:
    raw = py_file.read_bytes()
    code, options, notes = parse_source(raw.decode('utf-8'))
    unknown = options - {'heap-primitives'}
    if unknown:
        raise TraceError(f'Bilinmeyen #! ayarı: {", ".join(sorted(unknown))}')
    steps = Tracer(code, options, notes).run()
    return {
        'version': 1,
        'language': 'python',
        'code': code,
        'sourceHash': hashlib.sha256(raw).hexdigest(),
        'pythonVersion': f'{sys.version_info.major}.{sys.version_info.minor}',
        'steps': steps,
    }


def dump(trace: dict) -> str:
    """Okunur ama küçük: üst alanlar ayrı satırlarda, her adım tek satırda (git diff'i adım bazında)."""
    compact = lambda v: json.dumps(v, ensure_ascii=False, separators=(',', ':'))  # noqa: E731
    head = ',\n'.join(f'  {json.dumps(k)}: {compact(v)}' for k, v in trace.items() if k != 'steps')
    steps = ',\n'.join(f'    {compact(s)}' for s in trace['steps'])
    return '{\n' + head + ',\n  "steps": [\n' + steps + '\n  ]\n}\n'


def main(argv: list[str]) -> int:
    # str/bytes hash'leri süreç başına rastgeledir: aynı kaynak her zaman aynı izi üretsin
    if os.environ.get('PYTHONHASHSEED') != '0':
        os.environ['PYTHONHASHSEED'] = '0'
        os.execv(sys.executable, [sys.executable, __file__, *argv])
    targets = [Path(a) for a in argv] or [Path(__file__).resolve().parents[4] / 'content']
    files: list[Path] = []
    for t in targets:
        files += sorted(t.rglob('*.trace.py')) if t.is_dir() else [t]
    failed = 0
    for py in files:
        out = py.with_name(py.name[: -len('.py')] + '.json')
        try:
            trace = build(py)
        except (TraceError, SyntaxError) as exc:
            print(f'✗ {py}: {exc}', file=sys.stderr)
            failed += 1
            continue
        out.write_text(dump(trace), encoding='utf-8')
        print(f'✓ {out.name}: {len(trace["steps"])} adım')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
