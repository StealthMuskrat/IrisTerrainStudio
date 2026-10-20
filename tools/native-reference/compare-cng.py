"""Compare native CNG isolation captures, without qualifying a release dependency."""
import argparse
import json
from pathlib import Path
import re

SEEDS = ['813753', '-935731', '-9223372036854775808']
EXPECTED = '5059606393854142913'


def validate(capture):
    if capture.get('formatVersion') != 1 or capture.get('scope') != 'native-cng-isolation-diagnostic':
        raise ValueError('Unsupported capture')
    rows = capture.get('styles')
    if not isinstance(rows, list) or not rows or len(rows) % len(SEEDS):
        raise ValueError('Missing style/seed coverage')
    keys = []
    aggregate = 0xcbf29ce484222325
    for i, row in enumerate(rows):
        if not isinstance(row.get('style'), str) or not re.fullmatch(r'[A-Z][A-Z0-9_]*', row['style']):
            raise ValueError('Invalid style')
        if row.get('seed') != SEEDS[i % 3] or i % 3 and row['style'] != rows[i - 1]['style']:
            raise ValueError('Incorrect seed or style ordering')
        key = (row['style'], row['seed'])
        if key in keys:
            raise ValueError('Duplicate style/seed')
        keys.append(key)
        bits = row.get('bits')
        if not isinstance(bits, list) or len(bits) != 30:
            raise ValueError('Incomplete coordinate coverage')
        for value in bits:
            if not isinstance(value, str) or not re.fullmatch('[0-9a-f]{16}', value):
                raise ValueError('Invalid IEEE-754 bits')
            aggregate = ((aggregate ^ int(value, 16)) * 0x100000001b3) & ((1 << 64) - 1)
    if aggregate >= 1 << 63:
        aggregate -= 1 << 64
    if capture.get('aggregate') != str(aggregate):
        raise ValueError('Aggregate differs from raw samples')
    return keys


def compare(current, historical, expected_styles=None):
    current_keys = validate(current)
    if current_keys != validate(historical):
        raise ValueError('Style/seed coverage differs')
    if expected_styles is not None and current_keys != [(style, seed) for style in expected_styles for seed in SEEDS]:
        raise ValueError('Coverage differs from pinned NoiseStyle enum')
    changed = {}
    first = None
    for now, before in zip(current['styles'], historical['styles']):
        for i, (a, b) in enumerate(zip(now['bits'], before['bits'])):
            if a != b:
                changed[now['style']] = changed.get(now['style'], 0) + 1
                if first is None:
                    first = {'style': now['style'], 'seed': now['seed'], 'coordinateIndex': i // 3,
                             'dimensions': i % 3 + 1, 'currentBits': a, 'historicalBits': b}
    return {'aggregate': historical['aggregate'], 'matchesUpstreamChecksum': historical['aggregate'] == EXPECTED,
            'sampleCount': len(historical['styles']) * 30,
            'differencesFromCurrent': sum(changed.values()), 'changedStyles': changed, 'firstDifference': first}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--captures', required=True, type=Path)
    args = parser.parse_args()
    root = args.captures
    manifest = json.loads((root / 'manifest.json').read_text())
    current = json.loads((root / 'current.json').read_text())
    report = {'formatVersion': 1, 'scope': 'native-cng-isolation-diagnostic', 'releaseMatchVerified': False,
              'irisBrowserParityVerified': False, 'expectedUpstreamChecksum': EXPECTED, 'profiles': {}}
    for profile in manifest['profiles']:
        capture = json.loads((root / (profile['id'] + '.json')).read_text())
        report['profiles'][profile['id']] = {**profile, 'cngClassSha256': capture['cngClassSha256'],
                                            **compare(current, capture, manifest['expectedStyleOrder'])}
    (root / 'comparison.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
