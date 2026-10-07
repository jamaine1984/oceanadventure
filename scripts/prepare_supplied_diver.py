"""Package the user's diver with Mesh2Motion clips without changing bind axes.

Run with Blender in an isolated background process. Only the embedded texture
is resized; original geometry, rig and inverse-bind matrices remain byte exact.
The original and Mesh2Motion download are preserved under assets/characters.
"""
from pathlib import Path
import bpy, json, struct, copy, math
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/character-review';OUT.mkdir(parents=True,exist_ok=True)
def read_glb(path):
    blob=path.read_bytes();n=struct.unpack_from('<I',blob,12)[0]
    return json.loads(blob[20:20+n]),blob[28+n:]
source,source_bin=read_glb(ROOT/'assets/characters/ocean-diver-source.glb')
motion,motion_bin=read_glb(ROOT/'assets/characters/ocean-diver-mesh2motion.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/characters/ocean-diver-source.glb'))
image=next(i for i in bpy.data.images if i.size[0]>1000)
print('DIVER_SOURCE_TEXTURE',list(image.size));image.scale(2048,2048)
image.file_format='JPEG';image.filepath_raw=str(OUT/'supplied-diver-runtime-texture.jpg');image.save()
texture=Path(image.filepath_raw).read_bytes()

result=copy.deepcopy(source);binary=bytearray()
def append(data):
    while len(binary)%4:binary.append(0)
    offset=len(binary);binary.extend(data);return offset
image_view=result['images'][0]['bufferView'];result['images'][0]['mimeType']='image/jpeg'
for index,view in enumerate(result['bufferViews']):
    original=source['bufferViews'][index];start=original.get('byteOffset',0)
    payload=texture if index==image_view else source_bin[start:start+original['byteLength']]
    view['byteOffset']=append(payload);view['byteLength']=len(payload);view['buffer']=0

normalize=lambda name:''.join(c for c in name.lower() if c.isalnum())
nodes={normalize(node.get('name','')):i for i,node in enumerate(result['nodes'])}
accessors={}
def copy_accessor(index):
    if index in accessors:return accessors[index]
    accessor=copy.deepcopy(motion['accessors'][index]);view=motion['bufferViews'][accessor['bufferView']]
    start=view.get('byteOffset',0);data=motion_bin[start:start+view['byteLength']]
    new_view=copy.deepcopy(view);new_view['byteOffset']=append(data);new_view['buffer']=0
    accessor['bufferView']=len(result['bufferViews']);result['bufferViews'].append(new_view)
    new_index=len(result['accessors']);result['accessors'].append(accessor);accessors[index]=new_index;return new_index

result['animations']=[]
for animation in motion['animations']:
    new=copy.deepcopy(animation);new['name']='SwimIdle' if 'Idle' in animation['name'] else 'Swim'
    for sampler in new['samplers']:
        sampler['input']=copy_accessor(sampler['input']);sampler['output']=copy_accessor(sampler['output'])
    for channel in new['channels']:
        name=motion['nodes'][channel['target']['node']]['name'];channel['target']['node']=nodes[normalize(name)]
        if channel['target']['path']=='translation':
            # Root travel belongs to the game's collision controller. Keep only
            # vertical buoyancy/breathing movement from the animation library.
            accessor=result['accessors'][new['samplers'][channel['sampler']]['output']]
            view=result['bufferViews'][accessor['bufferView']];offset=view['byteOffset']+accessor.get('byteOffset',0)
            stride=view.get('byteStride',12);first=struct.unpack_from('<fff',binary,offset)
            for i in range(accessor['count']):
                value=struct.unpack_from('<fff',binary,offset+i*stride)
                struct.pack_into('<fff',binary,offset+i*stride,first[0],value[1],first[2])
            accessor['min']=[first[0],accessor.get('min',[0,0,0])[1],first[2]]
            accessor['max']=[first[0],accessor.get('max',[0,0,0])[1],first[2]]
    result['animations'].append(new)
result['buffers']=[{'byteLength':len(binary)}]
result['asset']['extras']={'animationSource':'Mesh2Motion human Swim Fwd / Swim Idle, retargeted using existing Mixamo skeleton','textureSize':2048}
json_bytes=json.dumps(result,separators=(',',':')).encode()
while len(json_bytes)%4:json_bytes+=b' '
while len(binary)%4:binary.append(0)
blob=struct.pack('<III',0x46546c67,2,28+len(json_bytes)+len(binary))+struct.pack('<II',len(json_bytes),0x4e4f534a)+json_bytes+struct.pack('<II',len(binary),0x004e4942)+binary
runtime=ROOT/'assets/characters/ocean-player-diver-legacy-runtime.glb';runtime.write_bytes(blob)
print('PACKAGED_DIVER',len(blob),[a['name'] for a in result['animations']])

# Editable scene and a separate single-view inspection render.
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(runtime))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
body=next(o for o in bpy.data.objects if o.type=='MESH' and len(o.vertex_groups)>50)
scene=bpy.context.scene;scene.render.fps=30
print('DIVER_ACTIONS',list(bpy.data.actions.keys()))
for action in bpy.data.actions:
    rig.animation_data.action=action
    for frame in [1,15,30]:
        scene.frame_set(frame);mesh=body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        corners=[mesh.matrix_world@Vector(v) for v in mesh.bound_box]
        print('DIVER_POSE',action.name,frame,[min(v[k] for v in corners) for k in range(3)],[max(v[k] for v in corners) for k in range(3)])
rig.animation_data.action=next(a for a in bpy.data.actions if 'SwimIdle' in a.name);scene.frame_set(1)
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=scene.render.resolution_y=1000;scene.render.resolution_percentage=100
world=bpy.data.worlds.new('Diver inspection studio');world.use_nodes=True;scene.world=world
background=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');background.inputs['Color'].default_value=(.16,.20,.24,1);background.inputs['Strength'].default_value=.6
target=Vector((0,0,.46))
for name,loc,power,size in [('Key',(-1.5,-2,2.5),160,2),('Fill',(2,-1,1.2),80,2),('Rim',(0,1.5,2),180,1.5)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    lamp=bpy.data.objects.new(name,data);scene.collection.objects.link(lamp);lamp.location=loc;lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('Diver inspection');camera=bpy.data.objects.new('Diver inspection',camera_data);scene.collection.objects.link(camera);scene.camera=camera
camera.location=(1,-2.5,1.3);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=1.35
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/ocean_supplied_diver.blend'))
scene.render.filepath=str(OUT/'supplied-diver-idle.png');bpy.ops.render.render(write_still=True)
