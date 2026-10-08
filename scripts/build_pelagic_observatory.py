"""Author the flooded Pelagic monitoring hall and its open ROV service entrance."""
from pathlib import Path
import math
import bpy
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
collection=bpy.data.collections.new('Pelagic Observatory');bpy.context.scene.collection.children.link(collection)
def material(name,rgb,metal=0,rough=.7,alpha=1,glow=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*rgb,alpha)
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Alpha'].default_value=alpha
    if alpha<1:m.surface_render_method='DITHERED'
    if glow:p.inputs['Emission Color'].default_value=(*rgb,1);p.inputs['Emission Strength'].default_value=glow
    return m
paint=material('Observatory enamel',(.68,.76,.76),.15)
metal=material('Observatory frame',(.21,.31,.32),.65,.48)
glass=material('Observatory dome glazing',(.08,.34,.39),.15,.3,.35)
black=material('Observatory seals',(.025,.035,.035),0,.8)
yellow=material('Observatory safety rail',(.82,.62,.17),.15,.5)
lamps=[material('Observatory port %d'%i,(.82,.25,.05),.05,.4,1.5) for i in range(3)]
def link(o,name,m):
    o.name=name
    for c in list(o.users_collection):c.objects.unlink(o)
    collection.objects.link(o);o.data.materials.append(m);return o
def box(name,pos,size,m,bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=link(bpy.context.object,name,m);o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:b=o.modifiers.new('Plate chamfer','BEVEL');b.width=bevel;b.segments=1
    return o
def pipe(name,points,radius,m):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=0;s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,v in zip(s.points,points):p.co=(*v,1)
    o=bpy.data.objects.new(name,c);collection.objects.link(o);c.materials.append(m);return o
def panel(name,verts,faces,m):
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);collection.objects.link(o);d.materials.append(m);return o
# A raised round chamber; the front arc is absent, not a painted doorway.
for i in range(16):
    a=math.tau*i/16;b=math.tau*(i+1)/16;mid=(a+b)/2
    if math.sin(mid)<-.80:continue
    o=panel('Hull plate',[(6*math.cos(t),6*math.sin(t),z) for z in [1.2,4.85] for t in [a,b]],[(0,1,3,2)],paint)
    pipe('Hull plate seam',[(6.02*math.cos(a),6.02*math.sin(a),1.2),(6.02*math.cos(a),6.02*math.sin(a),4.85)],.035,metal)
    for z in [1.5,4.6]:pipe('Hull band',[(6.04*math.cos(t),6.04*math.sin(t),z) for t in [a,mid,b]],.04,metal)
    for z in [1.4,4.5]:box('Plate fastener',(6*math.cos(a),6*math.sin(a),z),(.075,.075,.075),metal,0)
    proxy=box('Collision wall',(5.93*math.cos(mid),5.93*math.sin(mid),3.0),(.22,2.36,3.6),black,0);proxy.rotation_euler.z=mid;proxy['physicsCollider']=True
floor_verts=[(0,0,1.2)]+[(6*math.cos(i*math.tau/32),6*math.sin(i*math.tau/32),1.2) for i in range(32)]
panel('Monitoring floor',floor_verts,[(0,i+1,(i+1)%32+1) for i in range(32)],metal)
panel('Pressure ceiling',[(x,y,4.85) for x,y,z in floor_verts],[(0,(i+1)%32+1,i+1) for i in range(32)],metal)
for x in [-4,-2,0,2,4]:pipe('Floor service strip',[(x,-4.3,1.24),(x,4.3,1.24)],.018,black)
for ring in range(4):
    low=ring*math.pi/8;high=(ring+1)*math.pi/8
    for i in range(16):
        a=math.tau*i/16;b=math.tau*(i+1)/16
        panel('Dome glazing',[(6*math.cos(p)*math.cos(t),6*math.cos(p)*math.sin(t),4.85+3*math.sin(p)) for p in [low,high] for t in [a,b]],[(0,1,3,2)],glass)
for i in range(16):
    a=i*math.tau/16;pipe('Dome meridian',[(6*math.cos(p)*math.cos(a),6*math.cos(p)*math.sin(a),4.85+3*math.sin(p)) for p in [j*math.pi/16 for j in range(9)]],.045,metal)
pipe('Dome equator',[(6*math.cos(i*math.tau/32),6*math.sin(i*math.tau/32),4.85) for i in range(33)],.065,metal)
box('Service platform',(0,-6.6,1.18),(5.3,3.2,.18),metal)
for side in [-1,1]:
    pipe('Entrance jamb',[(side*2.65,-5.85,1.2),(side*2.65,-5.85,4.9)],.13,metal)
    pipe('Platform handrail',[(side*2.6,-8,1.3),(side*2.6,-8,2.15),(side*2.6,-6,2.15)],.035,yellow)
    pipe('Platform leg',[(side*2.45,-7.2,0),(side*2.45,-7.2,1.2)],.14,metal)
pipe('Service lintel',[(-2.65,-5.85,4.9),(2.65,-5.85,4.9)],.13,metal)
# Hardware is pushed to the perimeter; the route between terminals stays clear.
for i,(x,y,angle) in enumerate([(0,-2.0,0),(-4.5,0,math.pi/2),(4.5,2.2,-math.pi/2)]):
    before=set(collection.objects)
    box('Monitoring console',(0,0,2.15),(1.3,.42,1.7),paint)
    box('Instrument display',(0,-.24,2.7),(.82,.035,.4),black,.01)
    box('Port indicator',(0,-.28,2.85),(.18,.04,.18),lamps[i],.012)
    for dx in [-.4,0,.4]:box('Panel control',(dx,-.26,2.25),(.10,.05,.10),yellow,0)
    pipe('Instrument feed',[(0,0,.15),(0,0,1.3)],.025,black)
    transform=Matrix.Translation(Vector((x,y,0)))@Matrix.Rotation(angle,4,'Z')
    bpy.context.view_layer.update()
    for obj in set(collection.objects)-before:obj.matrix_world=transform@obj.matrix_world
for x,y in [(-4,4),(4,4),(-4,-3),(4,-3)]:
    pipe('Foundation strut',[(x*.85,y*.85,.15),(x,y,1.2)],.12,metal)
for x,y in [(-10,-7),(11,-3),(0,11)]:
    box('Array foundation',(x,y,.3),(1.5,1.5,.6),metal)
    pipe('Array tower',[(x,y,.6),(x,y,8)],.08,metal)
    for z in [3,5.5,7]:box('Acoustic receiver',(x,y,z),(.42,.42,.7),paint,.04)
    pipe('Array cable',[(x,y,.4),(x*.7,y*.7,.15),(0,0,.15)],.045,black)
for name,pos in [('entry',(0,-9,3)),('clock',(0,-3.8,3)),('habitat',(-2.6,0,3)),('archive',(2.6,2.2,3))]:
    o=bpy.data.objects.new('Pelagic anchor '+name,None);collection.objects.link(o);o.location=pos
bpy.ops.object.select_all(action='DESELECT')
for o in collection.objects:
    if o.type!='EMPTY':o.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in collection.objects if o.type!='EMPTY');bpy.ops.object.convert(target='MESH')
groups={}
for o in list(collection.objects):
    if o.type!='MESH':continue
    bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    if not o.get('physicsCollider'):groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,parts in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1:bpy.ops.object.join()
    parts[0].name=name
    if parts[0].data.materials[0]==paint:
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.01);bpy.ops.object.mode_set(mode='OBJECT')
for name,z in [('floor',1.1),('ceiling',4.95)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=6,depth=.2,location=(0,0,z));o=link(bpy.context.object,'Collision '+name,black);o['physicsCollider']=True;o['cylinderCollider']=True
bpy.ops.object.select_all(action='DESELECT')
for o in collection.objects:o.select_set(True)
target=ROOT/'public/models/pelagic_observatory.glb';bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_apply=True)
for o in collection.objects:
    if o.get('physicsCollider'):o.hide_render=True
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=1100;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Pelagic review');scene.world.use_nodes=True;next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.16,.3,.34,1)
for pos,power in [((5,-12,18),2000),((-8,-6,8),1000)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=12;o.rotation_euler=(Vector((0,0,3))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(18,-27,14));scene.camera=bpy.context.object;scene.camera.rotation_euler=(Vector((0,0,3))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=31
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/pelagic_observatory.blend'));scene.render.filepath=str(ROOT/'output/playwright/pelagic-blender.png');bpy.ops.render.render(write_still=True)
print('PELAGIC_ASSET',target.stat().st_size)
