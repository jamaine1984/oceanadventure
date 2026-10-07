"""Use evaluated sole geometry to remove foot penetration after jog calibration.

Run with Blender --background --factory-startup --python scripts/ground_land_jog.py
after package_land_motion.py. Appends a hip animation track; original geometry,
skin, rest joints and user files remain unchanged.
"""
from pathlib import Path
import bpy, json, math, struct
from mathutils import Vector

root=Path(__file__).resolve().parents[1]
path=root/'public/models/ocean-player-character.glb'
blob=path.read_bytes();length=struct.unpack_from('<I',blob,12)[0]
doc=json.loads(blob[20:20+length]);binary=bytearray(blob[28+length:])
extras=doc['asset'].setdefault('extras',{})
if extras.get('jogSoleGrounded'):raise ValueError('Already grounded; package the source clips first')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(path))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
body=next(o for o in bpy.data.objects if o.type=='MESH' and len(o.vertex_groups)>50)
rig.animation_data.action=next(a for a in bpy.data.actions if a.name=='Run')
bpy.context.scene.render.fps=30
clip=next(a for a in doc['animations'] if a['name']=='Run')
channel=next(c for c in clip['channels'] if c['target']['path']=='translation')
sampler=clip['samplers'][channel['sampler']]

def values(index,n):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    offset=v.get('byteOffset',0)+a.get('byteOffset',0)
    return [struct.unpack_from('<'+'f'*n,binary,offset+i*v.get('byteStride',n*4)) for i in range(a['count'])]

times=values(sampler['input'],1);positions=values(sampler['output'],3)
adjusted=[];corrections=[]
for (t,),position in zip(times,positions):
    frame=t*30
    bpy.context.scene.frame_set(math.floor(frame),subframe=frame%1)
    evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    sole=min((evaluated.matrix_world@Vector(v)).z for v in evaluated.bound_box)
    correction=max(0,.001-sole)
    # glTF Y is Blender Z; the supplied rig's parent has unit scale/rotation.
    adjusted.append((position[0],position[1]+correction,position[2]))
    corrections.append(correction)
while len(binary)%4:binary.append(0)
offset=len(binary)
for position in adjusted:binary.extend(struct.pack('<fff',*position))
view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(adjusted)*12})
accessor=len(doc['accessors']);doc['accessors'].append({'bufferView':view,'componentType':5126,'count':len(adjusted),'type':'VEC3','min':[min(v[i] for v in adjusted) for i in range(3)],'max':[max(v[i] for v in adjusted) for i in range(3)]})
sampler['output']=accessor
extras['jogSoleGrounded']={'maximumHipCorrectionM':max(corrections)}
doc['buffers']=[{'byteLength':len(binary)}]
payload=json.dumps(doc,separators=(',',':')).encode()
while len(payload)%4:payload+=b' '
while len(binary)%4:binary.append(0)
path.write_bytes(struct.pack('<III',0x46546C67,2,28+len(payload)+len(binary))+struct.pack('<II',len(payload),0x4E4F534A)+payload+struct.pack('<II',len(binary),0x004E4942)+binary)
print('JOG_SOLE_GROUNDED',max(corrections),len(adjusted))
