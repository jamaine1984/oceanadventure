"""Author the Manta dive propulsion vehicle; export only its asset collection."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
collection = bpy.data.collections.new('Manta Dive Drive')
bpy.context.scene.collection.children.link(collection)

def material(name, color, metallic=0, roughness=.4):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    return mat

shell = material('Ceramic graphite', (.095, .125, .145), .55, .28)
red = material('Rescue vermilion', (.62, .055, .033), .35, .31)
rubber = material('Molded grip elastomer', (.018, .023, .025), 0, .74)
steel = material('Marine titanium', (.43, .49, .51), .85, .25)
white = material('Instrument markings', (.79, .86, .84), .15, .42)
glass = material('Sealed display', (.014, .05, .055), .5, .17)
light = material('Status phosphor', (.11, .85, .55), .1, .3)
light.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value = (.1, .7, .4, 1)
light.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value = .5

def finish(obj, name, mat):
    obj.name = name
    for parent in list(obj.users_collection):
        parent.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    if hasattr(obj.data, 'polygons'):
        for face in obj.data.polygons:
            face.use_smooth = True
    return obj

def loft(name, stations, mat, segments=48):
    vertices = [(radius*math.cos(i/segments*math.tau), y, radius*math.sin(i/segments*math.tau)*.94)
                for y, radius in stations for i in range(segments)]
    faces = []
    for row in range(len(stations)-1):
        for i in range(segments):
            a = row*segments+i
            b = row*segments+(i+1)%segments
            faces.append((a, b, b+segments, a+segments))
    faces += [tuple(reversed(range(segments))), tuple(range((len(stations)-1)*segments, len(stations)*segments))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    for face in mesh.polygons:
        face.use_smooth = True
    return obj

def tube(name, points, radius, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 12
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for point, position in zip(spline.bezier_points, points):
        point.co = position
        point.handle_left_type = point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    curve.materials.append(mat)
    return obj

def box(name, position, scale, mat, bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = finish(bpy.context.object, name, mat)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new('Machined fillets', 'BEVEL')
    modifier.width = bevel
    modifier.segments = 3
    obj.modifiers.new('Surface normals', 'WEIGHTED_NORMAL')
    return obj

loft('Pressure housing', [(-.37,.105),(-.30,.155),(-.08,.19),(.25,.18),(.40,.145),(.49,.082),(.53,.025)], shell)
loft('Nose fairing', [(.28,.183),(.40,.15),(.50,.085),(.54,.024)], red)
for y in [-.26,.15]:
    loft('Pressure seal collar', [(y-.012,.17 if y<0 else .187),(y+.012,.17 if y<0 else .187)], steel)
loft('Motor hub', [(-.56,.033),(-.52,.06),(-.35,.075)], steel, 32)
bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=12, location=(0,-.47,0), rotation=(math.pi/2,0,0), major_radius=.21, minor_radius=.034)
finish(bpy.context.object, 'Shrouded propeller guard', red)
for angle in [0,math.pi/2,math.pi,math.pi*1.5]:
    c, s = math.cos(angle), math.sin(angle)
    tube('Guard structural rib', [(c*.075,-.38,s*.075),(c*.19,-.44,s*.19)], .012, steel)
    blade = [(0.045,-.491,0),(.10,-.508,-.036),(.193,-.484,-.05),(.19,-.463,.014),(.08,-.477,.025)]
    verts = [(x*c-z*s,y,x*s+z*c) for x,y,z in blade]
    mesh = bpy.data.meshes.new('Hydrodynamic rotor foil')
    mesh.from_pydata(verts, [], [tuple(range(len(verts)))])
    obj = bpy.data.objects.new('Hydrodynamic rotor foil',mesh)
    collection.objects.link(obj)
    mesh.materials.append(shell)
    thickness = obj.modifiers.new('Rotor thickness','SOLIDIFY')
    thickness.thickness = .012
    bevel = obj.modifiers.new('Rotor edge','BEVEL')
    bevel.width = .005
    bevel.segments = 2
for side in [-1,1]:
    tube('Sweepback handle arm', [(side*.15,-.1,.03),(side*.27,-.23,.09),(side*.33,-.33,.19)], .018, steel)
    tube('Contoured control grip', [(side*.33,-.42,.19),(side*.33,-.32,.21),(side*.33,-.23,.19)], .025, rubber)
    for y in [-.39,-.37,-.35,-.33,-.31,-.29,-.27]:
        box('Grip traction rib', (side*.33,y,.211), (.052,.005,.013), shell, .002)
    box('Safety trigger', (side*.30,-.34,.245), (.025,.06,.024), red, .007)
    box('Service access fastener', (side*.11,.0,.158), (.018,.018,.008), steel, .003)
box('Sealed telemetry console', (0,-.16,.18), (.15,.17,.036), rubber, .014)
box('Telemetry glazing', (0,-.15,.204), (.11,.11,.008), glass, .005)
for x in [-.033,-.011,.011,.033]:
    box('Charge cell indicator', (x,-.15,.21), (.012,.035,.004), light, .002)
tube('Safety lanyard', [(.32,-.42,.17),(.40,-.5,.0),(.38,-.35,-.1),(.32,-.34,.13)], .004, rubber)
label = bpy.data.curves.new('Manta marking', 'FONT')
label.body = 'MANTA / 01'
label.size = .033
label.extrude = .0002
obj = bpy.data.objects.new('Manta marking', label)
collection.objects.link(obj)
obj.location = (-.094,.03,.18)
label.materials.append(white)

# Curves are converted once in the authored asset, not rebuilt in the browser.
bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = next(iter(collection.objects))
bpy.ops.object.convert(target='MESH')
# Batch the authored static parts by finish, keeping only the motor animated.
rotor_parts = [obj for obj in collection.objects if obj.name.startswith(('Hydrodynamic rotor foil', 'Motor hub'))]
rotor = bpy.data.objects.new('Manta rotor', None)
collection.objects.link(rotor)
rotor.location = (0,-.47,0)
for obj in rotor_parts:
    world = obj.matrix_world.copy()
    obj.parent = rotor
    obj.matrix_world = world
groups = {}
for obj in collection.objects:
    if obj.type == 'MESH':
        groups.setdefault((obj.parent == rotor, obj.data.materials[0].name), []).append(obj)
for (moving, finish_name), parts in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts)>1:
        bpy.ops.object.join()
    parts[0].name = ('Rotor ' if moving else 'Manta finish ') + finish_name
for side, sign in [('left',-1),('right',1)]:
    anchor = bpy.data.objects.new('Manta grip '+side, None)
    collection.objects.link(anchor)
    anchor.location = (sign*.33,-.33,.21)
bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects:
    obj.select_set(True)
blend = ROOT/'assets/blender/manta_dive_drive.blend'
blend.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
asset = ROOT/'public/models/manta_dive_drive.glb'
bpy.ops.export_scene.gltf(filepath=str(asset), export_format='GLB', use_selection=True, export_apply=True, export_yup=True)

# Review lighting and camera live only in the Blender source, not the GLB.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 1100
scene.render.resolution_y = 820
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Review background')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.045,.075,.09,1)
for position, energy, size in [((1,-2,3),350,3),((-2,1,1),180,2)]:
    bpy.ops.object.light_add(type='AREA', location=position)
    lamp = bpy.context.object
    lamp.data.energy, lamp.data.shape, lamp.data.size = energy, 'DISK', size
    lamp.rotation_euler = (Vector((0,0,0))-lamp.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(1.3,-1.6,1.1))
scene.camera = bpy.context.object
scene.camera.rotation_euler = (Vector((0,-.04,0))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.type = 'ORTHO'
scene.camera.data.ortho_scale = 1.6
review = ROOT/'output/playwright/manta-blender-review.png'
review.parent.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(review)
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.render.render(write_still=True)
print('MANTA_ASSET', asset, asset.stat().st_size)
