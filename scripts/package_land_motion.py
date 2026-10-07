"""Attach Mesh2Motion land clips to the unchanged supplied mesh and bind rig.

Uses the already prepared 2K embedded texture. Gameplay owns horizontal travel;
the animation retains vertical hip movement, limb rotations and finger tracks.
Run with Python; no rendering or external service is required during packaging.
"""
from pathlib import Path
import copy, json, struct, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]

def read_glb(path):
    blob = path.read_bytes()
    if struct.unpack_from('<II', blob, 0) != (0x46546C67, 2):
        raise ValueError(f'Not a GLB 2 file: {path}')
    length = struct.unpack_from('<I', blob, 12)[0]
    return json.loads(blob[20:20 + length]), blob[28 + length:]

source, source_bin = read_glb(ROOT / 'assets/characters/ocean-human-source.glb')
motion, motion_bin = read_glb(ROOT / 'assets/characters/ocean-human-mesh2motion-natural.glb')
runtime = ROOT / 'public/models/ocean-player-character.glb'
previous, previous_bin = read_glb(runtime)
image = previous['images'][0]
texture_view = previous['bufferViews'][image['bufferView']]
texture_start = texture_view.get('byteOffset', 0)
texture = previous_bin[texture_start:texture_start + texture_view['byteLength']]

result = copy.deepcopy(source)
binary = bytearray()

def append(data):
    while len(binary) % 4:
        binary.append(0)
    offset = len(binary)
    binary.extend(data)
    return offset

image_view = result['images'][0]['bufferView']
result['images'][0]['mimeType'] = image['mimeType']
for index, view in enumerate(result['bufferViews']):
    original = source['bufferViews'][index]
    start = original.get('byteOffset', 0)
    data = texture if index == image_view else source_bin[start:start + original['byteLength']]
    view.update(buffer=0, byteOffset=append(data), byteLength=len(data))

normalize = lambda name: ''.join(c for c in name.lower() if c.isalnum())
nodes = {normalize(node.get('name', '')): i for i, node in enumerate(result['nodes'])}
accessors = {}

def copy_accessor(index):
    if index in accessors:
        return accessors[index]
    accessor = copy.deepcopy(motion['accessors'][index])
    view = motion['bufferViews'][accessor['bufferView']]
    start = view.get('byteOffset', 0)
    new_view = copy.deepcopy(view)
    new_view.update(byteOffset=append(motion_bin[start:start + view['byteLength']]), buffer=0)
    accessor['bufferView'] = len(result['bufferViews'])
    result['bufferViews'].append(new_view)
    accessors[index] = len(result['accessors'])
    result['accessors'].append(accessor)
    return accessors[index]

names = {'Idle_Subtle_RT': 'Idle', 'Walk_Formal_RT': 'Walk', 'Run_Female_RT': 'Run'}
result['animations'] = []
for animation in motion['animations']:
    if animation['name'] not in names:
        continue
    new = copy.deepcopy(animation)
    new['name'] = names[animation['name']]
    for sampler in new['samplers']:
        sampler['input'] = copy_accessor(sampler['input'])
        sampler['output'] = copy_accessor(sampler['output'])
    for channel in new['channels']:
        name = motion['nodes'][channel['target']['node']]['name']
        channel['target']['node'] = nodes[normalize(name)]
        if channel['target']['path'] == 'translation':
            if not normalize(name).endswith('hips'):
                raise ValueError(f'Unexpected translating joint: {name}')
            accessor = result['accessors'][new['samplers'][channel['sampler']]['output']]
            if accessor['componentType'] != 5126 or accessor['type'] != 'VEC3':
                raise ValueError('Expected floating point hip translations')
            view = result['bufferViews'][accessor['bufferView']]
            offset = view['byteOffset'] + accessor.get('byteOffset', 0)
            stride = view.get('byteStride', 12)
            rest = result['nodes'][channel['target']['node']]['translation']
            y_values = []
            for i in range(accessor['count']):
                value = struct.unpack_from('<fff', binary, offset + i * stride)
                y_values.append(value[1])
                struct.pack_into('<fff', binary, offset + i * stride, rest[0], value[1], rest[2])
            accessor['min'] = [rest[0], min(y_values), rest[2]]
            accessor['max'] = [rest[0], max(y_values), rest[2]]
    result['animations'].append(new)

if {a['name'] for a in result['animations']} != {'Idle', 'Walk', 'Run'}:
    raise ValueError('Missing required land animation')
result['buffers'] = [{'byteLength': len(binary)}]
result['asset']['extras'] = {'animationSource': 'Mesh2Motion Idle Subtle / Walk Formal / Run Female, retargeted to supplied Mixamo skeleton', 'textureSize': 2048}
payload = json.dumps(result, separators=(',', ':')).encode()
while len(payload) % 4:
    payload += b' '
while len(binary) % 4:
    binary.append(0)
blob = struct.pack('<III', 0x46546C67, 2, 28 + len(payload) + len(binary)) + struct.pack('<II', len(payload), 0x4E4F534A) + payload + struct.pack('<II', len(binary), 0x004E4942) + binary
runtime.write_bytes(blob)
print('PACKAGED_LAND', len(blob))
for animation in result['animations']:
    duration = max(result['accessors'][s['input']]['max'][0] for s in animation['samplers'])
    print('CLIP', animation['name'], duration, 'channels', len(animation['channels']))
subprocess.run([sys.executable,str(ROOT / 'scripts/calibrate_land_stride.py')],check=True)
