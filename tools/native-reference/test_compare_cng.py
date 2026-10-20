import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('compare_cng', Path(__file__).with_name('compare-cng.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def capture():
    rows = [{'style': 'TEST', 'seed': seed, 'bits': ['0000000000000000'] * 30} for seed in module.SEEDS]
    value = 0xcbf29ce484222325
    for _ in range(90):
        value = (value * 0x100000001b3) & ((1 << 64) - 1)
    if value >= 1 << 63:
        value -= 1 << 64
    return {'formatVersion': 1, 'scope': 'native-cng-isolation-diagnostic', 'styles': rows, 'aggregate': str(value)}


class CaptureValidationTest(unittest.TestCase):
    def test_exact_capture(self):
        result = module.compare(capture(), capture())
        self.assertEqual(result['differencesFromCurrent'], 0)
        self.assertEqual(result['sampleCount'], 90)
        self.assertFalse(result['matchesUpstreamChecksum'])

    def test_rejects_truncation_corruption_reordering_and_duplicates(self):
        original = capture()
        for edit in [lambda c: c['styles'].pop(), lambda c: c['styles'][0]['bits'].pop(),
                     lambda c: c['styles'][0]['bits'].__setitem__(0, 'ffffffffffffffff'),
                     lambda c: c['styles'].reverse(), lambda c: c['styles'].extend(copy.deepcopy(c['styles']))]:
            with self.subTest(edit=edit):
                corrupted = copy.deepcopy(original)
                edit(corrupted)
                with self.assertRaises(ValueError):
                    module.compare(original, corrupted)

    def test_rejects_different_coverage_even_when_hash_is_valid(self):
        changed = capture()
        for row in changed['styles']:
            row['style'] = 'OTHER'
        with self.assertRaises(ValueError):
            module.compare(capture(), changed)


if __name__ == '__main__':
    unittest.main()
