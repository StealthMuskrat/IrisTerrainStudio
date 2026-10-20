import tempfile
import unittest
from pathlib import Path
from report import summarize


class NativeReportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def write(self, body, tests=1, failures=0, errors=0, skipped=0):
        (self.root / 'TEST-sample.xml').write_text(
            f'<testsuite name="required.Suite" tests="{tests}" failures="{failures}" errors="{errors}" skipped="{skipped}">'
            f'{body}</testsuite>')

    def test_native_pass_requires_actual_cases_and_successful_process(self):
        self.write('<testcase name="actual"/>')
        self.assertTrue(summarize(self.root, 0, ['required.Suite'])['nativeRegressionsPassed'])
        self.assertFalse(summarize(self.root, 1, ['required.Suite'])['nativeRegressionsPassed'])

    def test_missing_reports_cannot_pass(self):
        report = summarize(self.root, 0, ['required.Suite'])
        self.assertFalse(report['nativeRegressionsPassed'])
        self.assertEqual(report['missingRequiredSuites'], ['required.Suite'])

    def test_empty_requirement_list_cannot_certify_a_run(self):
        self.write('<testcase name="actual"/>')
        with self.assertRaises(ValueError):
            summarize(self.root, 0, [])

    def test_empty_suite_cannot_pass(self):
        self.write('', tests=0)
        self.assertFalse(summarize(self.root, 0, ['required.Suite'])['nativeRegressionsPassed'])

    def test_each_failure_mode_cannot_pass(self):
        for name in ['failure', 'error', 'skipped']:
            with self.subTest(name=name):
                fields = {'failures': 0, 'errors': 0, 'skipped': 0}
                fields[{'failure': 'failures', 'error': 'errors', 'skipped': 'skipped'}[name]] = 1
                self.write(f'<testcase name="broken"><{name}/></testcase>', **fields)
                self.assertFalse(summarize(self.root, 0, ['required.Suite'])['nativeRegressionsPassed'])

    def test_failure_evidence_retains_case_and_native_message(self):
        self.write('<testcase name="checksum"><failure message="expected 1 but was 2"/></testcase>', failures=1)
        report = summarize(self.root, 1, ['required.Suite'])
        self.assertEqual(report['failedCases'][0]['case'], 'checksum')
        self.assertEqual(report['failedCases'][0]['message'], 'expected 1 but was 2')

    def test_report_counters_cannot_hide_a_failure(self):
        self.write('<testcase name="broken"><failure/></testcase>')
        report = summarize(self.root, 0, ['required.Suite'])
        self.assertFalse(report['nativeRegressionsPassed'])
        self.assertTrue(report['diagnostics'])

    def test_malformed_xml_cannot_pass(self):
        (self.root / 'TEST-bad.xml').write_text('<bad')
        report = summarize(self.root, 0, ['required.Suite'])
        self.assertFalse(report['nativeRegressionsPassed'])
        self.assertTrue(report['diagnostics'])

    def test_unrelated_suite_cannot_replace_required_suite(self):
        self.write('<testcase name="actual"/>')
        report = summarize(self.root, 0, ['other.Suite'])
        self.assertFalse(report['nativeRegressionsPassed'])
        self.assertEqual(report['missingRequiredSuites'], ['other.Suite'])


if __name__ == '__main__':
    unittest.main()
