"""Report native build readiness; an audit report is not a passing parity gate."""
import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET


def summarize(results, exit_code, required_suites):
    if not required_suites or any(not isinstance(name, str) or not name for name in required_suites):
        raise ValueError('At least one named required suite is necessary')
    suites = {}
    diagnostics = []
    failed_cases = []
    for path in sorted(Path(results).glob('TEST-*.xml')):
        try:
            if path.stat().st_size > 16 * 1024 * 1024:
                raise ValueError('JUnit report exceeds 16 MiB')
            root = ET.parse(path).getroot()
            if root.tag != 'testsuite' or not root.get('name'):
                raise ValueError('Expected a named testsuite')
            name = root.get('name')
            if name in suites:
                raise ValueError('Duplicate suite')
            cases = root.findall('testcase')
            count = len(cases)
            declared = int(root.get('tests', '-1'))
            failures = sum(case.find('failure') is not None for case in cases)
            errors = sum(case.find('error') is not None for case in cases)
            skipped = sum(case.find('skipped') is not None for case in cases)
            if (declared != count or int(root.get('failures', '-1')) != failures or
                    int(root.get('errors', '-1')) != errors or int(root.get('skipped', '0')) != skipped):
                raise ValueError('JUnit summary differs from test cases')
            names = [case.get('name') for case in cases]
            if any(not name for name in names) or len(set(names)) != count:
                raise ValueError('Missing or duplicate test case names')
            suites[name] = {'tests': count, 'failures': failures, 'errors': errors, 'skipped': skipped}
            for case in cases:
                for tag in ['failure', 'error']:
                    problem = case.find(tag)
                    if problem is not None and len(failed_cases) < 20:
                        failed_cases.append({'suite': name, 'case': case.get('name'), 'kind': tag,
                                             'message': problem.get('message', '')[:2000]})
        except (ET.ParseError, OSError, ValueError) as error:
            diagnostics.append(f'{path.name}: {error}')
    missing = sorted(set(required_suites) - suites.keys())
    passed = (exit_code == 0 and not diagnostics and not missing and
              all(suites[name]['tests'] > 0 and not any(suites[name][key] for key in ['failures', 'errors', 'skipped'])
                  for name in required_suites))
    return {'formatVersion': 1, 'scope': 'native-iris-source-build-audit',
            'gradleExitCode': exit_code, 'nativeRegressionsPassed': passed,
            'releaseMatchVerified': False, 'irisBrowserParityVerified': False,
            'suites': suites, 'missingRequiredSuites': missing, 'diagnostics': diagnostics,
            'failedCases': failed_cases}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--results', required=True)
    parser.add_argument('--exit-code', required=True, type=int)
    parser.add_argument('--output', required=True)
    parser.add_argument('--require-pass', action='store_true')
    args = parser.parse_args()
    lock_path = Path(__file__).with_name('source-lock.json')
    lock_bytes = lock_path.read_bytes()
    lock = json.loads(lock_bytes)
    report = summarize(args.results, args.exit_code, lock['requiredSuites'])
    report['sourceManifestSha256'] = hashlib.sha256(lock_bytes).hexdigest()
    report['inputs'] = lock
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    if args.require_pass and not report['nativeRegressionsPassed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
