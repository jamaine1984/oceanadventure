"""Author the compact Sentry research ROV from the approved vehicle reference."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
collection=bpy.data.collections.new('Sentry research ROV')
bpy.context.scene.collection.children.link(collection)

def material(name,color,metal=0,rough=.5,glow=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if glow:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=glow
    return m
metal=material('Sentry brushed titanium',(.45,.50,.50),.75,.34)
yellow=material('Sentry flotation enamel',(.95,.63,.06),.1,.39)
black=material('Sentry elastomer',(.024,.031,.032),.1,.8)
teal=material('Sentry thruster anodizing',(.06,.31,.29),.65,.36)
glass=material('Sentry optical glass',(.025,.07,.095),.5,.12)
light=material('Sentry survey lamps',(.94,.92,.76),.05,.2,3)

def link(obj,name,mat):
    obj.name=name
    for c in list(obj.users_collection):c.objects.unlink(obj)
    collection.objects.link(obj);obj.data.materials.append(mat);return obj
def box(name,pos,size,mat,bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=link(bpy.context.object,name,mat);o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=o.modifiers.new('Machined edge','BEVEL');b.width=bevel;b.segments=1
    return o
def cylinder(name,pos,radius,depth,mat,horizontal=False,segments=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments,radius=radius,depth=depth,location=pos)
    o=link(bpy.context.object,name,mat)
    if horizontal:o.rotation_euler.x=math.pi/2
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    return o
def ring(name,pos,radius,tube,mat,horizontal=False):
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,major_radius=radius,minor_radius=tube,location=pos)
    o=link(bpy.context.object,name,mat)
    if horizontal:o.rotation_euler.x=math.pi/2
    for p in o.data.polygons:p.use_smooth=True
    return o
def pipe(name,points,radius,mat):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=1
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,c);collection.objects.link(o);c.materials.append(mat);return o

for x in [-.47,.47]:
    for y in [-.53,.53]:
        box('Corner frame',(x,y,0),(.065,.065,.71),metal)
        box('Landing bumper',(x,y,-.38),(.14,.20,.095),black)
        for z in [-.25,.25]:cylinder('Frame fastener',(x,y,z),.025,.076,metal,True,12)
    for z in [-.30,.33]:box('Longitudinal rail',(x,0,z),(.07,1.13,.065),metal)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=(x*.65,0,.21))
    o=link(bpy.context.object,'Sealed flotation pod',yellow);o.scale=(.195,.56,.20)
    for p in o.data.polygons:p.use_smooth=True
    for y in [-.32,.32]:
        pipe('Flotation retaining strap',[(x*.65-.18,y,.13),(x*.65-.15,y,.34),(x*.65+.15,y,.34),(x*.65+.18,y,.13)],.018,metal)
for y in [-.53,.53]:
    for z in [-.30,.33]:box('Cross rail',(0,y,z),(.98,.065,.065),metal)
box('Pressure electronics enclosure',(0,-.12,-.08),(.38,.68,.32),black,.06)
for x in [-.25,.25]:pipe('Electronics loom',[(x,-.45,.02),(x,-.45,.37),(x,.4,.37)],.017,black)
cylinder('Tether strain relief',(0,-.64,.12),.06,.19,black,True)
for y in [-.59,-.62,-.65,-.68]:ring('Tether coupling rib',(0,y,.12),.062,.008,metal,True)

# Each rotor retains its own mesh/pivot; fixed housings batch by material.
rotors=[]
for index,(x,y,z,vertical) in enumerate([(-.64,-.28,-.04,False),(.64,-.28,-.04,False),(-.64,.28,-.04,False),(.64,.28,-.04,False),(-.25,0,.45,True),(.25,0,.45,True)]):
    center=Vector((x,y,z))
    ring('Thruster duct',center,.15,.025,black,not vertical)
    cylinder('Thruster hub',center,.038,.10,teal,not vertical)
    for d in [-.04,.04]:
        ring('Duct lip',center+Vector((0,0,d) if vertical else (0,d,0)),.15,.010,metal,not vertical)
    vertices=[];faces=[]
    for blade in range(4):
        angle=blade*math.tau/4
        for radius,offset,height in [(.035,-.16,-.008),(.13,-.12,.016),(.13,.18,.016),(.035,.30,-.008)]:
            vertices.append((radius*math.cos(angle+offset),radius*math.sin(angle+offset),height))
        a=blade*4;faces.append((a,a+1,a+2,a+3))
    data=bpy.data.meshes.new('Sentry rotor geometry');data.from_pydata(vertices,[],faces);data.update()
    o=bpy.data.objects.new('Sentry rotor %d'%index,data);collection.objects.link(o);data.materials.append(teal)
    o.location=center
    if not vertical:o.rotation_euler.x=math.pi/2
    o['rovRotor']=True;rotors.append(o)
    box('Thruster support',(x*.82,y,z-.08),(.12,.10,.10),metal)

cylinder('Optical pressure barrel',(0,.54,.02),.16,.30,black,True)
ring('Camera bezel',(0,.705,.02),.16,.018,metal,True)
cylinder('Camera optical window',(0,.715,.02),.137,.012,glass,True)
ring('Inner optical ring',(0,.724,.02),.080,.012,black,True)
cylinder('Lens pupil',(0,.733,.02),.048,.013,glass,True)
for x in [-.29,.29]:
    cylinder('Survey lamp barrel',(x,.54,-.14),.07,.17,black,True)
    ring('Survey lamp bezel',(x,.63,-.14),.073,.012,metal,True)
    cylinder('Survey lamp lens',(x,.641,-.14),.059,.009,light,True)
pipe('Manipulator arm',[(0,.35,-.21),(0,.57,-.29),(0,.81,-.32)],.033,metal)
for x in [-.075,.075]:
    pipe('Manipulator finger',[(0,.80,-.32),(x,.86,-.32),(x,.97,-.32),(x*.4,1.01,-.32)],.022,black)
cylinder('Manipulator pivot',(0,.77,-.32),.044,.15,teal)

bpy.ops.object.select_all(action='DESELECT')
for o in collection.objects:o.select_set(True)
bpy.context.view_layer.objects.active=next(iter(collection.objects));bpy.ops.object.convert(target='MESH')
for o in collection.objects:
    bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
groups={}
for o in collection.objects:
    if not o.get('rovRotor'):groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,parts in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1:bpy.ops.object.join()
    parts[0].name=name
for name,pos in [('camera',(0,.82,.02)),('tether',(0,-.74,.12))]:
    o=bpy.data.objects.new('Sentry anchor '+name,None);collection.objects.link(o);o.location=pos
bpy.ops.object.select_all(action='DESELECT')
for o in collection.objects:o.select_set(True)
target=ROOT/'public/models/sentry_research_rov.glb'
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_apply=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('ROV review');scene.world.use_nodes=True
next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.32,.38,.40,1)
for pos,power in [((3,4,5),500),((-2,1,2),200)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=4
    o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.0,2.8,1.65));scene.camera=bpy.context.object
scene.camera.rotation_euler=(-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=2.3
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/sentry_research_rov.blend'))
scene.render.filepath=str(ROOT/'output/playwright/sentry-rov-blender.png');bpy.ops.render.render(write_still=True)
scene.render.resolution_x=480;scene.render.resolution_y=320
scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=75
scene.render.filepath=str(ROOT/'public/textures/inventory/rov.jpg');bpy.ops.render.render(write_still=True)
print('SENTRY_ROV_ASSET',target.stat().st_size)
