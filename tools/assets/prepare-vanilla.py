#!/usr/bin/env python3
"""Prepare a local vanilla pack from the exact, user-supplied Minecraft client.

No assets are downloaded, executed, rewritten or added to the repository.
The output contains the client's original assets plus explicit Studio provenance
and pack metadata for its embedded target format.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
LOCK = json.loads((Path(__file__).with_name('minecraft-client.lock.json')).read_text())


def encode(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode('utf-8')


def prepare(client, output):
    # Read one admitted immutable snapshot. Every byte used below is hash checked.
    with client.open('rb') as source:
        data = source.read(LOCK['clientBytes'] + 1)
    if (len(data) != LOCK['clientBytes']
            or hashlib.sha1(data).hexdigest() != LOCK['clientSha1']
            or hashlib.sha256(data).hexdigest() != LOCK['clientSha256']):
        raise ValueError('Client identity differs from the pinned Minecraft 26.3 download. No output written.')
    entries = {}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        version = json.loads(archive.read('version.json'))
        formats = version.get('pack_version', {})
        if (version.get('id') != LOCK['minecraftVersion']
                or [formats.get('resource_major'), formats.get('resource_minor')] != LOCK['resourceFormat']):
            raise ValueError('Embedded Minecraft version or resource format differs.')
        expanded = 0
        for info in archive.infolist():
            if info.is_dir() or not info.filename.startswith('assets/'):
                continue
            name = info.filename
            parts = PurePosixPath(name).parts
            if ('\\' in name or any(part in ('', '.', '..') for part in name.split('/'))
                    or len(parts) < 2 or info.flag_bits & 1
                    or (info.external_attr >> 16) & 0o170000 == 0o120000
                    or name in entries):
                raise ValueError('Unsafe or duplicate client asset path.')
            expanded += info.file_size
            if info.file_size > 8 * 1024 * 1024 or expanded > 64 * 1024 * 1024 or len(entries) >= 19990:
                raise ValueError('Client assets exceed the browser pack budget.')
            entries[name] = archive.read(info)  # zipfile verifies CRC while reading.
    if not all(key in entries for key in (
            'assets/minecraft/blockstates/stone.json',
            'assets/minecraft/models/block/stone.json',
            'assets/minecraft/textures/block/stone.png')):
        raise ValueError('Pinned client is missing its baseline block assets.')
    asset_count = len(entries)
    entries['pack.mcmeta'] = encode({'pack': {
        'description': 'Local Minecraft 26.3 vanilla assets for Iris Terrain Studio',
        'min_format': LOCK['resourceFormat'], 'max_format': LOCK['resourceFormat']}})
    entries['studio-vanilla-source.json'] = encode({
        'format': 'iris-terrain-studio-vanilla-source', 'version': 1,
        'source': LOCK, 'assetFiles': asset_count, 'assetBytes': expanded,
        'scope': 'All original assets/ entries. No classes, native libraries or server data. Asset bytes are unchanged.',
        'clientRenderingVerified': False, 'terrainParityVerified': False,
        'notice': 'Minecraft assets remain owned by their respective rightsholders. This local preparation does not grant redistribution rights.'})
    output.parent.mkdir(parents=True, exist_ok=True)
    # Atomic publication; an existing pack survives every validation/write error.
    descriptor, temporary = tempfile.mkstemp(prefix=output.name + '.', dir=output.parent)
    try:
        with os.fdopen(descriptor, 'w+b') as target:
            with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_STORED) as archive:
                for name, contents in sorted(entries.items()):
                    info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_STORED
                    info.external_attr = 0o100644 << 16
                    archive.writestr(info, contents)
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary, output)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return {'minecraftVersion': LOCK['minecraftVersion'], 'resourceFormat': LOCK['resourceFormat'],
            'assetFiles': asset_count, 'assetBytes': expanded, 'archiveBytes': output.stat().st_size,
            'archiveSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'output': str(output),
            'clientRenderingVerified': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client', type=Path, required=True, help='Authorized local Minecraft 26.3 client.jar')
    parser.add_argument('--output', type=Path, default=ROOT / '.local-assets/vanilla-26.3.zip')
    args = parser.parse_args()
    if args.client.resolve() == args.output.resolve():
        parser.error('Output must differ from the client input.')
    try:
        result = prepare(args.client, args.output)
    except (ValueError, OSError, KeyError, zipfile.BadZipFile) as error:
        parser.exit(1, str(error) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
