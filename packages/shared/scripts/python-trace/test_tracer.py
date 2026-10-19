"""tracer.py birim testleri: python3 -m unittest discover -s packages/shared/scripts/python-trace"""
import tempfile
import unittest
from pathlib import Path

from tracer import MAX_STEPS, TraceError, Tracer, build, parse_source


def run(src: str):
    code, options, notes = parse_source(src)
    return Tracer(code, options, notes).run()


def frame_vars(step, frame=-1):
    return dict((k, v) for k, v in step['frames'][frame]['locals'])


class ParseSourceTest(unittest.TestCase):
    def test_notlar_ve_ayarlar_gosterilen_koddan_cikarilir(self):
        code, options, notes = parse_source(
            '#! heap-primitives\n#@ Üstte | Above\nx = 1  #@ Sonda | End\ny = 2\n'
        )
        self.assertEqual(code, 'x = 1\ny = 2')
        self.assertEqual(options, {'heap-primitives'})
        self.assertEqual(notes, {1: {'tr': 'Üstte Sonda', 'en': 'Above End'}})

    def test_yalniz_turkce_not(self):
        _, _, notes = parse_source('a = 1  #@ sadece Türkçe\n')
        self.assertEqual(notes, {1: 'sadece Türkçe'})

    def test_bagli_kod_satiri_olmayan_not_hata(self):
        with self.assertRaises(TraceError):
            parse_source('x = 1\n#@ sahipsiz not\n')


class TracerTest(unittest.TestCase):
    def test_takma_ad_ayni_nesneyi_gosterir(self):
        steps = run('a = [1]\nb = a\nb.append(2)\n')
        end = steps[-1]
        self.assertEqual(end['event'], 'end')
        g = frame_vars(end)
        self.assertEqual(g['a'], g['b'])
        lst = next(o for o in end['heap'] if o['id'] == g['a']['id'])
        self.assertEqual([i['repr'] for i in lst['items']], ['1', '2'])

    def test_cagri_yeni_cerceve_ve_donus_degeri(self):
        steps = run('def kare(x):\n    return x * x\n\ny = kare(3)\n')
        call = next(s for s in steps if s['event'] == 'call')
        self.assertEqual([f['name'] for f in call['frames']], ['Global', 'kare'])
        ret = next(s for s in steps if s['event'] == 'return')
        self.assertEqual(ret['returnValue'], {'t': 'prim', 'type': 'int', 'repr': '9'})
        self.assertEqual(frame_vars(steps[-1])['y']['repr'], '9')

    def test_closure_degiskeni_fonksiyon_nesnesinde(self):
        steps = run('def dis():\n    n = 5\n    def ic():\n        return n\n    return ic\n\nf = dis()\n')
        end = steps[-1]
        fn = next(o for o in end['heap'] if o['id'] == frame_vars(end)['f']['id'])
        self.assertEqual(fn['kind'], 'function')
        self.assertEqual(fn['attrs'], [['n', {'t': 'prim', 'type': 'int', 'repr': '5'}]])

    def test_sinif_ve_ornek(self):
        steps = run('class K:\n    def __init__(self, ad):\n        self.ad = ad\n\nk = K("x")\n')
        end = steps[-1]
        inst = next(o for o in end['heap'] if o['id'] == frame_vars(end)['k']['id'])
        self.assertEqual((inst['kind'], inst['type']), ('instance', 'K'))
        self.assertEqual(inst['attrs'], [['ad', {'t': 'prim', 'type': 'str', 'repr': "'x'"}]])
        cls = next(o for o in end['heap'] if o['kind'] == 'class')
        self.assertEqual(cls['attrs'], [['__init__', {'t': 'prim', 'type': 'method', 'repr': '(self, ad)'}]])

    def test_yakalanmamis_hata_son_adimda(self):
        steps = run('print("önce")\n1 / 0\n')
        self.assertEqual(steps[-1]['exception'], 'ZeroDivisionError: division by zero')
        self.assertEqual(steps[-1]['stdout'], 'önce\n')

    def test_hata_yayilirken_donus_degeri_yok(self):
        steps = run('def f():\n    raise ValueError("x")\n\ntry:\n    f()\nexcept ValueError:\n    pass\n')
        ret = next(s for s in steps if s['event'] == 'return')
        self.assertNotIn('returnValue', ret)

    def test_heap_primitives_basit_degerleri_nesne_yapar(self):
        steps = run('#! heap-primitives\nx = 7\n')
        end = steps[-1]
        ref = frame_vars(end)['x']
        self.assertEqual(ref['t'], 'ref')
        self.assertEqual(end['heap'][0]['repr'], '7')

    def test_adim_siniri(self):
        with self.assertRaises(TraceError):
            run(f'for i in range({MAX_STEPS}):\n    pass\n')

    def test_build_kaynak_ozeti_ve_surum(self):
        with tempfile.TemporaryDirectory() as d:
            py = Path(d) / 'ornek.trace.py'
            py.write_text('x = 1\n', encoding='utf-8')
            trace = build(py)
        self.assertEqual(len(trace['sourceHash']), 64)
        self.assertEqual(trace['code'], 'x = 1')


if __name__ == '__main__':
    unittest.main()
