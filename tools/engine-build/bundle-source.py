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
    for project in ('Iris', 'VolmLib', 'Paralithic'):
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
    for filename in sorted((root/'.local-tools/rotation-sources').rglob('*.java')):
        add('generated/rotation/'+str(filename.relative_to(root/'.local-tools/rotation-sources')),filename.read_bytes())
    for name in ('rotation-inputs.json','rotation-properties.json','noise-cache-identity.json','expression-math-inputs.json','layer-kernel-inputs.json'):
        add('platform-inputs/'+name,(root/'.local-tools'/name).read_bytes())
    with zipfile.ZipFile(root/'.local-tools/engine-jars/native-rotation.jar') as rotation:
        for name in ('net/minecraft/world/level/block/state/properties/RotationSegment.class','net/minecraft/util/SegmentedAnglePrecision.class'):
            add('platform-inputs/minecraft/'+name,rotation.read(name))
    for filename in sorted((root/'.local-tools/config-reader-sources/studio/engine/expression').glob('*.java')):
        add('generated/expression/'+filename.name,filename.read_bytes())
    add('package.json', (root / 'package.json').read_bytes())
    add('native-inputs.json', (root / '.local-tools/iris-inputs.json').read_bytes())
    dependency_lock=json.loads((root/'tools/engine-build/dependencies.lock.json').read_text())['brigadier']
    source_jar=root/'.local-tools'/dependency_lock['sourceArchive']
    if hashlib.sha256(source_jar.read_bytes()).hexdigest()!=dependency_lock['sourceSha256']:
        raise ValueError('Brigadier source archive differs from its pinned checksum')
    with zipfile.ZipFile(source_jar) as source:
        for name in sorted(source.namelist()):
            if name.endswith('.java'):
                add('upstream/Brigadier/'+name,source.read(name))
    add('upstream/Brigadier/LICENSE.txt',(root/'tools/engine-build/BRIGADIER-LICENSE.txt').read_bytes())
    with zipfile.ZipFile(jdk / 'lib/src.zip') as source:
        # Read-only reference for original hydrology record/enum fingerprint identity.
        add('reference/OpenJDK/java.base/java/lang/Enum.java', source.read('java.base/java/lang/Enum.java'))
        for name in ('java.base/java/lang/Math.java','java.base/java/util/SplittableRandom.java', 'java.base/java/util/random/RandomGenerator.java', 'java.base/jdk/internal/util/random/RandomSupport.java'):
            add('upstream/OpenJDK/' + name, source.read(name))
        # Raster-model references only; AWT/ImageIO are not compiled into the worker module.
        for name in ('java.desktop/com/sun/imageio/plugins/png/PNGImageReader.java','java.desktop/javax/imageio/ImageTypeSpecifier.java','java.desktop/java/awt/image/IndexColorModel.java','java.desktop/java/awt/Color.java'):
            add('reference/OpenJDK/' + name, source.read(name))
    for filename in sorted((jdk / 'legal/java.desktop').glob('*')):
        if filename.is_file():
            add('reference/OpenJDK/legal/java.desktop/' + filename.name, filename.read_bytes())
    for filename in sorted((jdk / 'legal/java.base').glob('*')):
        if filename.is_file():
            add('upstream/OpenJDK/legal/java.base/' + filename.name, filename.read_bytes())
    add('BUILD-INSTRUCTIONS.txt', b'Iris Terrain Studio development browser engine.\nUse Node 24+, Python 3, git, curl and tar. Run npm run engine:setup then npm run engine:build in the repository root.\nThe setup uses checksummed development tools and pinned Iris/VolmLib source commits. Java source is unmodified; browser-only bytecode platform adapters are retained with the sources.\nThis is not a qualified release build. Noise-style native/browser qualification and full terrain implementation remain outstanding.\n')
    add('SOURCE-SHA256.json', (json.dumps(records, indent=2, sort_keys=True) + '\n').encode())
(output / 'LICENSE.txt').write_bytes((root / '.upstream/Iris/LICENSE.md').read_bytes())
(output / 'THIRD-PARTY-NOTICES.txt').write_text('Iris and VolmLib: GPL-3.0-or-later. Full corresponding upstream and adapter source is in source.zip.\nOpenJDK restricted SplittableRandom and Math.round adapters: GPL-2.0-only WITH Classpath-exception-2.0. Full source files and license notices are in source.zip. Read-only PNG raster-model reference sources and java.desktop license notices are also retained; AWT/ImageIO do not execute in the worker.\nBrigadier 1.3.10: Copyright (c) Microsoft Corporation. All rights reserved. MIT License; complete pinned sources and license are in source.zip.\nParalithic 0.8.1: MIT, dfsek; candidate source and original license retained under upstream/Paralithic in source.zip. Native resolved JAR provenance remains unqualified.\nTeaVM 0.16.0: Apache-2.0. Runtime source and license: https://github.com/konsoletyper/teavm/tree/0.16.0 .\n')
print(f'Retained {len(records)} source/build files and license notices.')
