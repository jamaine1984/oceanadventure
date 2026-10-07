"""Author an isolated marine array service station from the approved reference."""
import math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
asset = bpy.data.collections.new('Array service station')
bpy.context.scene.collection.children.link(asset)

def material(name, rgb, metal=0, rough=.5, glow=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if glow:
        p.inputs['Emission Color'].default_value = (*rgb, 1)
        p.inputs['Emission Strength'].default_value = glow
    return m

steel = material('Marine stainless', (.36,.43,.44), .8,.35)
paint = material('Weathered white housing', (.65,.72,.70), .3,.64)
dark = material('Sealed rubber', (.025,.035,.032), 0,.85)
blue = material('Blue connector circuit', (.025,.30,.52), .3,.42)
yellow = material('Yellow connector circuit', (.76,.55,.065), .3,.5)
white = material('White connector circuit', (.86,.88,.78), .2,.4)
amber = material('Array standby lamp', (.87,.22,.03), .1,.3, 1.5)
label = material('Engraved instrument labels', (.84,.87,.77), .1,.65)

def finish(obj, name, mat):
    obj.name = name
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    asset.objects.link(obj)
    obj.data.materials.append(mat)
    return obj

def box(name, pos, size, mat, bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = finish(bpy.context.object, name, mat)
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    b = o.modifiers.new('Machined edge', 'BEVEL')
    b.width, b.segments = bevel, 2
    o.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    return o

def tube(name, points, radius, mat):
    c = bpy.data.curves.new(name, 'CURVE')
    c.dimensions = '3D'
    c.bevel_depth, c.bevel_resolution = radius, 2
    p = c.splines.new('BEZIER')
    p.bezier_points.add(len(points)-1)
    for b, v in zip(p.bezier_points, points):
        b.co = v
        b.handle_left_type = b.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, c)
    asset.objects.link(o)
    c.materials.append(mat)
    return o

def cylinder(name, pos, radius, depth, mat, rotation=(math.pi/2,0,0), vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=pos, rotation=rotation)
    return finish(bpy.context.object, name, mat)

def text(body, pos, size=.07):
    c = bpy.data.curves.new(body, 'FONT')
    c.body, c.size, c.extrude = body, size, .0005
    o = bpy.data.objects.new(body, c)
    asset.objects.link(o)
    c.materials.append(label)
    o.location = pos
    o.rotation_euler = (math.pi/2,0,0)

# Feet and open-grid service platform physically support the cabinet.
for x in [-1,1]:
    for y in [-.55,.55]:
        box('Foundation foot', (x,y,.06), (.38,.38,.12), steel)
        box('Anchored support leg', (x,y,.38), (.11,.11,.65), steel)
        for dx in [-.12,.12]:
            cylinder('Anchor bolt', (x+dx,y,.13), .022,.04,steel,(0,0,0),8)
for y in [-.62,.62]:
    box('Platform frame', (0,y,.72), (2.35,.10,.12), steel)
for x in [-1.13,1.13]:
    box('Platform frame', (x,0,.72), (.10,1.25,.12), steel)
for i in range(20):
    box('Service grating', (-1.05+i*.11,0,.76), (.026,1.13,.045), steel, .003)
for x in [-.68,.68]:
    box('Cabinet pedestal', (x,.22,1.1), (.13,.13,.65), steel)
box('Sealed cabinet', (0,.25,1.8), (1.85,.5,1.3), paint,.045)
box('Face gasket', (0,-.018,1.8), (1.76,.026,1.22), dark,.015)
box('Service face', (0,-.046,1.8), (1.7,.03,1.17), steel,.012)
for x in [-.78,.78]:
    for z in [1.31,2.29]:
        cylinder('Panel fastener', (x,-.071,z), .023,.014,steel,vertices=8)
text('ARRAY / SERVICE 04', (-.65,-.079,2.18), .085)
for i,(name,mat) in enumerate([('WEST / 46',blue),('CENTER / 18',white),('NORTH / 32',yellow)]):
    x = -.53+i*.53
    box('Circuit recess', (x,-.07,1.76), (.43,.025,.61), dark,.012)
    cylinder('Pressure connector shell', (x,-.13,1.75), .085,.1,steel)
    cylinder('Connector insert', (x,-.191,1.75), .057,.025,mat)
    for a in [0,2.1,4.2]:
        cylinder('Connector pin', (x+math.cos(a)*.026,-.21,1.75+math.sin(a)*.026), .009,.028,steel,vertices=8)
    box('Circuit identity strip', (x,-.096,1.98), (.3,.018,.03), mat,.003)
    cylinder('Isolation switch ring', (x,-.13,1.5), .04,.07,steel)
    box('Isolation switch', (x,-.176,1.5), (.019,.036,.09), mat,.006)
    text(name, (x-.18,-.098,2.04), .037)
    text('REV' if i!=1 else 'NORM', (x-.1,-.098,1.34), .041)
    tube('Disconnected service cable', [(x,.27,1.15),(x,.4,.87),(x+.1,-.3,.83),(x-.08,-.6,.84)], .026,mat)
    cylinder('Cable strain relief', (x-.08,-.6,.86), .044,.11,dark,(0,0,0))
for x in [-.76,.76]:
    tube('Panel grab handle', [(x,-.10,1.7),(x,-.23,1.73),(x,-.23,1.93),(x,-.10,1.96)], .023,steel)
cylinder('Standby beacon', (0,.25,2.51), .075,.2,amber,(0,0,0))
tube('Array feed', [(0,.5,1.45),(0,.72,1.0),(.3,.9,.27),(.8,1.3,.12)], .052,dark)

# Convert and batch static surfaces, keeping the emissive lamp independently addressable.
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects:
    o.select_set(True)
bpy.context.view_layer.objects.active = next(iter(asset.objects))
bpy.ops.object.convert(target='MESH')
groups = {}
for o in asset.objects:
    groups.setdefault(o.data.materials[0].name, []).append(o)
for name, parts in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts)>1:
        bpy.ops.object.join()
    parts[0].name = 'Array finish ' + name
anchor = bpy.data.objects.new('Array interaction anchor', None)
asset.objects.link(anchor)
anchor.location = (0,-1.65,1.8)
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects:
    o.select_set(True)
target = ROOT/'public/models/array_service_station.glb'
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True, export_apply=True, export_yup=True)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.render.resolution_x, scene.render.resolution_y = 960,720
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Studio background')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.08,.13,.14,1)
for pos,power in [((1,-3,5),450),((-3,1,3),300)]:
    bpy.ops.object.light_add(type='AREA', location=pos)
    o = bpy.context.object
    o.data.energy, o.data.size = power,4
    o.rotation_euler = (Vector((0,0,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3.4,-5.0,3.3))
scene.camera = bpy.context.object
scene.camera.rotation_euler = (Vector((0,0,1.3))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.type, scene.camera.data.ortho_scale = 'ORTHO',3.9
blend = ROOT/'assets/blender/array_service_station.blend'
blend.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
scene.render.filepath = str(ROOT/'output/playwright/array-blender-review.png')
bpy.ops.render.render(write_still=True)
print('ARRAY_SERVICE_ASSET',target,target.stat().st_size)
