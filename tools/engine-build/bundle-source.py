"""Retain corresponding upstream/adapter sources and build identities beside Wasm."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[2]
output = Path(sys.argv[1]).resolve()
jdk = Path(sys.argv[2]).resolve()
archive = output / 'source.zip'
records = {}
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
    def add(name, data):
        records[name] = hashlib.sha256(data).hexdigest()
        bundle.writestr(name, data)
    for project in ('Iris', 'VolmLib'):
        directory = root / '.upstream' / project
        tracked = subprocess.check_output(['git', '-C', str(directory), 'ls-files', '-z']).decode().split('\0')
        for relative in sorted(filter(None, tracked)):
            filename = directory / relative
            if filename.is_file():
                add(f'upstream/{project}/{relative}', filename.read_bytes())
    for relative in ('tools/engine-build', 'tools/portability-probe', 'tools/native-reference', 'packages/iris-engine', 'packages/shared'):
        for filename in sorted((root / relative).rglob('*')):
            if filename.is_file() and 'target' not in filename.relative_to(root).parts:
                add(str(filename.relative_to(root)), filename.read_bytes())
    add('package.json', (root / 'package.json').read_bytes())
    add('native-inputs.json', (root / '.local-tools/iris-inputs.json').read_bytes())
    with zipfile.ZipFile(jdk / 'lib/src.zip') as source:
        for name in ('java.base/java/util/SplittableRandom.java', 'java.base/java/util/random/RandomGenerator.java', 'java.base/jdk/internal/util/random/RandomSupport.java'):
            add('upstream/OpenJDK/' + name, source.read(name))
    for filename in sorted((jdk / 'legal/java.base').glob('*')):
        if filename.is_file():
            add('upstream/OpenJDK/legal/java.base/' + filename.name, filename.read_bytes())
    add('BUILD-INSTRUCTIONS.txt', b'Iris Terrain Studio development browser engine.\nUse Node 24+, Python 3, git, curl and tar. Run npm run engine:setup then npm run engine:build in the repository root.\nThe setup uses checksummed development tools and pinned Iris/VolmLib source commits. Java source is unmodified; browser-only bytecode platform adapters are retained with the sources.\nThis is not a qualified release build. Noise-style native/browser qualification and full terrain implementation remain outstanding.\n')
    add('SOURCE-SHA256.json', (json.dumps(records, indent=2, sort_keys=True) + '\n').encode())
(output / 'LICENSE.txt').write_bytes((root / '.upstream/Iris/LICENSE.md').read_bytes())
(output / 'THIRD-PARTY-NOTICES.txt').write_text('Iris and VolmLib: GPL-3.0-or-later. Full corresponding upstream and adapter source is in source.zip.\nOpenJDK restricted SplittableRandom adapter: GPL-2.0-only WITH Classpath-exception-2.0. Full source files and license notices are in source.zip.\nTeaVM 0.16.0: Apache-2.0. Runtime source and license: https://github.com/konsoletyper/teavm/tree/0.16.0 .\n')
print(f'Retained {len(records)} source/build files and license notices.')
