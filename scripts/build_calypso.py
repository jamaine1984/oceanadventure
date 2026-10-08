"""Author Calypso's service pod and distinct reclaimed-supply cases from the image-first reference."""
from pathlib import Path
import math
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name,color,metal=0,rough=.6,glow=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if glow:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=glow
    return m
paint=mat('Calypso enamel',(.78,.82,.80),.2);steel=mat('Calypso structural steel',(.12,.19,.20),.7,.4);seal=mat('Calypso rubber',(.02,.035,.04),0,.85);yellow=mat('Calypso safety fittings',(.90,.64,.08),.25);copper=mat('Supply insulated winding',(.60,.25,.12),.55);lamp=mat('Calypso status',(.12,.75,.44),.05,.3,2);supplylamp=mat('Supply case marker',(.94,.42,.06),.1,.4,1)
groups=[];parts=[]
def group(name):
    global parts
    o=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(o);groups.append(o);parts=[];return o
def link(o,name,m):o.name=name;o.data.materials.append(m);parts.append(o);return o
def box(name,p,size,m,b=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=link(bpy.context.object,name,m);o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if b:q=o.modifiers.new('Machined edge','BEVEL');q.width=b;q.segments=2
    return o
def tube(name,p,r,length,m,axis='Z',verts=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=length,location=p);o=link(bpy.context.object,name,m)
    if axis=='X':o.rotation_euler.y=math.pi/2
    if axis=='Y':o.rotation_euler.x=math.pi/2
    for f in o.data.polygons:f.use_smooth=True
    return o
def pipe(name,points,r,m):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=r;d.bevel_resolution=1;s=d.splines.new('POLY');s.points.add(len(points)-1)
    for p,v in zip(s.points,points):p.co=(*v,1)
    o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o);d.materials.append(m);parts.append(o);return o
def finish(parent):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.convert(target='MESH');batches={}
    for o in parts:
        bpy.context.view_layer.objects.active=o
        for m in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=m.name)
        batches.setdefault(o.data.materials[0].name,[]).append(o)
    for name,items in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in items:o.select_set(True)
        bpy.context.view_layer.objects.active=items[0]
        if len(items)>1:bpy.ops.object.join()
        o=items[0];o.name=parent.name+' '+name;o.parent=parent
        if o.data.materials[0]==paint:
            bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
pod=group('Calypso pod')
box('Sealed cabinet',(0,0,1.05),(3.0,1.45,1.45),paint,.12)
for x in [-1.4,1.4]:
    box('Corner frame',(x,0,1.08),(.15,1.54,1.58),steel,.05)
    for y in [-.62,.62]:
        box('Ground shoe',(x,y,.13),(.62,.56,.14),steel,.04)
        pipe('Angled foot brace',[(x,y,.19),(x*.93,y*.83,.62)],.095,steel)
        for dx in [-.18,.18]:tube('Anchor fastener',(x+dx,y,.21),.04,.07,steel)
for y in [-.76,.76]:
    box('Cabinet rail',(0,y,.42),(2.8,.09,.12),steel)
    box('Top seal',(0,y,1.72),(2.8,.055,.05),seal,.005)
box('Front connector plate',(-.8,-.747,1.1),(.8,.045,.95),steel)
box('Access hatch',(.65,-.749,1.08),(1.55,.06,1.1),paint,.06)
for x in [.06,1.25]:
    for z in [.65,1.51]:box('Hatch hinge',(x,-.79,z),(.1,.065,.13),steel,.015)
for x in [-1.05,-.55]:
    for z in [.82,1.1]:tube('Service socket',(x,-.81,z),.072,.075,steel,'Y')
pipe('Flexible service loop',[(x,-.84,z) for x,z in [(-1.05,1.1),(-1.10,.80),(-1.0,.60),(-.75,.55),(-.52,.65),(-.55,1.1)]],.035,seal)
tube('Pressure gauge',(-1.05,-.86,1.4),.10,.06,steel,'Y');tube('Gauge face',(-1.05,-.90,1.4),.084,.012,paint,'Y');pipe('Gauge needle',[(-1.05,-.916,1.4),(-1.02,-.916,1.46)],.006,seal)
box('Service status window',(-.52,-.83,1.43),(.16,.06,.21),seal);box('Service status lamp',(-.52,-.87,1.43),(.09,.015,.14),lamp)
for y in [-.38,.25]:
    tube('Pressure reservoir',(-1.66,y,.96),.16,.98,paint)
    for z in [.52,1.41]:tube('Reservoir end',(-1.66,y,z),.13,.08,steel)
    tube('Tank valve',(-1.66,y,1.49),.055,.13,steel)
    for z in [.63,1.22]:tube('Tank strap',(-1.66,y,z),.171,.055,seal)
pipe('Cylinder guard',[(-1.89,-.62,.42),(-1.89,-.62,1.58),(-1.89,.5,1.58),(-1.89,.5,.42)],.055,steel)
box('Power module',(-.55,.1,1.92),(1.1,.75,.3),steel,.05)
for i in range(9):box('Heat sink fin',(-1+i*.11,.1,2.1),(.025,.67,.18),steel,.005)
for x in [-1.15,1.15]:pipe('Lifting handle',[(x,-.36,1.79),(x,-.36,2.00),(x,.2,2.00),(x,.2,1.79)],.043,yellow)
tube('Recovery winch',(.75,.12,1.99),.23,.38,yellow,'X')
for x in [.53,.97]:tube('Winch cheek',(x,.12,1.99),.27,.035,steel,'X')
for i in range(7):pipe('Winch winding',[(.58+i*.047,.12+.235*math.cos(t),1.99+.235*math.sin(t)) for t in [j*math.tau/20 for j in range(21)]],.013,yellow)
for x in [-1.15,0,1.15]:
    for y in [-.55,.55]:tube('Cabinet screw',(x,y,1.795),.025,.022,steel)
finish(pod)
for kind in ['alloy','copper','cell']:
    parent=group('Supply '+kind)
    if kind=='copper':
        tube('Winding spool',(0,0,.52),.35,.48,copper,'X')
        for x in [-.3,.3]:tube('Spool cheek',(x,0,.52),.40,.08,steel,'X')
        for i in range(12):pipe('Insulated cable',[(x, .36*math.cos(t),.52+.36*math.sin(t)) for x,t in [(-.24+i*.042,j*math.tau/18) for j in range(19)]],.014,copper)
        for x in [-.46,.46]:pipe('Reel frame',[(x,-.44,.1),(x,-.44,1.0),(x,.44,1.0),(x,.44,.1)],.045,steel)
        box('Spool ground pad',(0,0,.08),(1.05,1.0,.12),steel)
        pipe('Reel carry grip',[(-.30,-.2,1.03),(-.30,-.2,1.16),(.30,-.2,1.16),(.30,-.2,1.03)],.025,yellow)
    else:
        width=1.55 if kind=='alloy' else 1.2
        box('Sealed case',(0,0,.42),(width,.84,.68),paint,.07)
        for x in [-width*.37,width*.37]:
            box('Retention strap',(x,0,.43),(.09,.9,.76),steel,.025)
            box('Strap release',(x,-.47,.44),(.14,.035,.14),yellow,.015)
        for x in [-width*.48,width*.48]:
            for y in [-.37,.37]:box('Corner protector',(x,y,.43),(.14,.16,.72),steel,.025)
        pipe('Case handle',[(-.2,-.45,.56),(-.2,-.53,.62),(.2,-.53,.62),(.2,-.45,.56)],.025,steel)
        if kind=='alloy':
            for i in range(4):box('Plate stack edge',(0,.446,.26+i*.1),(1.0,.015,.025),steel,.003)
        else:
            for x in [-.3,0,.3]:tube('Pressure vessel guard',(x,0,.81),.10,.48,steel,'Y')
    box('Supply identification lamp',(.15,-.45,.8 if kind!='copper' else 1.0),(.12,.04,.045),supplylamp,.005);finish(parent)
buoy=group('Calypso buoy');tube('Marker float',(0,0,0),.3,.48,yellow);tube('Marker mast',(0,0,.42),.035,.55,steel);tube('Buoy indicator',(0,0,.72),.07,.08,lamp);finish(buoy)
bpy.ops.object.select_all(action='SELECT');target=ROOT/'public/models/calypso_field_kit.glb';bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_yup=True,export_extras=True,export_apply=True)
for o,pos in zip(groups,[(0,0,0),(3.1,-2,0),(1.5,-2.7,0),(3.3,-3.3,0),(-2.7,.7,1)]):o.location=pos
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.render.resolution_x=1100;scene.render.resolution_y=760;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Calypso review');scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.20,.31,.32,1)
for pos,energy in [((2,-5,8),1100),((-5,-2,4),800)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=energy;o.data.size=6;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(7,-10,6));scene.camera=bpy.context.object;scene.camera.rotation_euler=(Vector((.7,-.8,.9))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=7.2
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/calypso_field_kit.blend'));scene.render.filepath=str(ROOT/'output/playwright/calypso-blender.png');bpy.ops.render.render(write_still=True)
print('CALYPSO_ASSET',target.stat().st_size)
