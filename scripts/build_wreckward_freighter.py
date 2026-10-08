"""Author the breached Wreckward freighter, its traversal anchors and collision proxies."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
collection = bpy.data.collections.new('Wreckward research freighter')
bpy.context.scene.collection.children.link(collection)

def material(name, color, metal=0, rough=.7, wear=False, glow=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color,1)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color,1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if wear:
        v = m.node_tree.nodes.new('ShaderNodeVertexColor')
        v.layer_name = 'Corrosion'
        geometry=m.node_tree.nodes.new('ShaderNodeNewGeometry')
        grain=m.node_tree.nodes.new('ShaderNodeTexNoise')
        grain.inputs['Scale'].default_value=28
        m.node_tree.links.new(geometry.outputs['Position'],grain.inputs['Vector'])
        multiply=m.node_tree.nodes.new('ShaderNodeMixRGB')
        multiply.blend_type='MULTIPLY'
        multiply.inputs[0].default_value=.32
        m.node_tree.links.new(v.outputs['Color'],multiply.inputs[1])
        m.node_tree.links.new(grain.outputs['Fac'],multiply.inputs[2])
        m.node_tree.links.new(multiply.outputs[0],p.inputs['Base Color'])
    if glow:
        p.inputs['Emission Color'].default_value = (*color,1)
        p.inputs['Emission Strength'].default_value = glow
    return m

paint = material('Oxidized hull coating',(.22,.32,.34),.25,.84,True)
steel = material('Corroded structural steel',(.2,.24,.23),.45,.77,True)
white = material('Weathered bridge enamel',(.67,.71,.65),.1,.82,True)
rubber = material('Sealed equipment rubber',(.022,.027,.025),0,.92)
glass = material('Clouded bridge glazing',(.065,.16,.17),.4,.33)
brass = material('Recorder hardware',(.44,.32,.12),.55,.52)
amber = material('Recorder standby phosphor',(.85,.24,.025),.1,.4,1.6)
marking = material('Instrument markings',(.78,.82,.72),.05,.65)
stone = material('Encrusted seabed stones',(.31,.35,.29),0,.94,True)

def link(obj,name,mat):
    obj.name = name
    for c in list(obj.users_collection): c.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj

def box(name,pos,size,mat,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o = link(bpy.context.object,name,mat)
    o.scale = size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b = o.modifiers.new('Worn machined edge','BEVEL')
    b.width,b.segments = bevel,2
    return o

def pipe(name,points,radius,mat):
    c = bpy.data.curves.new(name,'CURVE')
    c.dimensions = '3D'
    c.bevel_depth,c.bevel_resolution = radius,2
    s = c.splines.new('POLY')
    s.points.add(len(points)-1)
    for point,position in zip(s.points,points): point.co = (*position,1)
    o = bpy.data.objects.new(name,c)
    collection.objects.link(o)
    c.materials.append(mat)
    return o

def mesh(name,vertices,faces,mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces)
    data.update()
    o = bpy.data.objects.new(name,data)
    collection.objects.link(o)
    data.materials.append(mat)
    return o

def text(body,pos,size,rotation=(math.pi/2,0,0)):
    c = bpy.data.curves.new(body,'FONT')
    c.body,c.size,c.extrude = body,size,.001
    o = bpy.data.objects.new(body,c)
    collection.objects.link(o)
    c.materials.append(marking)
    o.location,o.rotation_euler = pos,rotation

def halfbeam(y):
    return 4.1 * min(1,max(.18,(20-abs(y))/5))

# Curved plating is tessellated for spatially varied corrosion without runtime textures.
for side in [-1,1]:
    rows,levels = 100,14
    verts,faces = [],[]
    for row in range(rows+1):
        y = -18+row*36/rows
        for level in range(levels+1):
            z = .2+level*4.65/levels
            x = side*halfbeam(y)*(.62+.38*math.sin(min(1,z/2)*math.pi/2))
            verts.append((x,y,z))
    for row in range(rows):
        y = -18+(row+.5)*36/rows
        for level in range(levels):
            z = .2+(level+.5)*4.65/levels
            # Starboard breach exports to +X/+Z; port escape exports to -X/-Z.
            gap = (-7<y<-1 if side==1 else 1<y<7)
            lower = 1.1+.10*math.sin(row*2.3)
            upper = 4.4+.08*math.sin(row*1.7)
            if gap and lower<z<upper: continue
            a = row*(levels+1)+level
            quad = (a,a+1,a+levels+2,a+levels+1)
            faces.append(quad if side==1 else tuple(reversed(quad)))
    o = mesh('Breached curved hull',verts,faces,paint)
    for polygon in o.data.polygons: polygon.use_smooth=True
    s = o.modifiers.new('Hull plate thickness','SOLIDIFY')
    s.thickness = .12

for z in [1.0,4.85]:
    verts,faces = [],[]
    for row in range(73):
        y = -18+row*.5
        for col in range(13): verts.append((halfbeam(y)*(-1+col/6),y,z))
    for row in range(72):
        for col in range(12):
            a=row*13+col
            faces.append((a,a+1,a+14,a+13))
    mesh('Cargo sole' if z<2 else 'Weather deck',verts,faces,steel)
for y in [-18,18]:
    box('End bulkhead',(0,y,2.7),(halfbeam(y)*2,.2,4.4),paint)

for side in [-1,1]:
    for y in range(-16,18,2):
        if (-7<y<-1 if side==1 else 1<y<7): continue
        pipe('Interior frame',[(side*3.6,y,1.0),(side*3.95,y,2.1),(side*3.95,y,4.6)],.065,steel)
    pipe('Deck rail',[(side*halfbeam(y),y,5.75) for y in range(-17,18)],.035,steel)
    for y in range(-16,18,2):
        pipe('Rail stanchion',[(side*halfbeam(y),y,4.85),(side*halfbeam(y),y,5.75)],.028,steel)
    for y in [-7,-1] if side==1 else [1,7]:
        pipe('Torn breach edge',[(side*(4.05+.06*math.sin(i*2)),y+.10*math.sin(i*1.4),1.05+i*.28) for i in range(13)],.072,steel)
    for y in range(-16,18,4):
        if (-7<y<-1 if side==1 else 1<y<7): continue
        pipe('Welded plate seam',[(side*halfbeam(y)*(.62+.38*math.sin(min(1,z/2)*math.pi/2)),y,z) for z in [.4,1,2,3,4.3]],.018,steel)
        for z in [1.3,2.2,3.1,4]:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=6,radius=.045,location=(side*(halfbeam(y)+.02),y+.15,z))
            link(bpy.context.object,'Hull rivet',steel).scale=(.38,1,1)
for y in range(-16,18,3):
    box('Overhead transverse beam',(0,y,4.55),(7.6,.10,.18),steel)
for x in [-3.2,3.2]:
    pipe('Cargo service conduit',[(x,-15,4.24),(x,0,4.24),(x,15,4.24)],.045,rubber)

# The cargo corridor remains clear between the two torn side entrances.
for x,y in [(2.65,5),(2.5,-7),(-2.55,-10),(-2.6,10)]:
    box('Sealed cargo case',(x,y,1.6),(1.45,1.7,1.1),steel,.06)
    for z in [1.18,2.02]: box('Case binding',(x,y,z),(1.48,1.74,.04),brass,.008)
    box('Case identification plate',(x,y-.86,1.62),(.55,.025,.18),marking,.004)
box('Recorder pedestal',(0,0,1.35),(.72,.72,.65),steel)
box('Recovery cassette',(0,0,1.95),(.6,.45,.5),brass,.06)
box('Recorder window',(0,-.245,1.98),(.35,.018,.16),rubber,.008)
box('Recorder status lamp',(0,-.26,2.14),(.12,.025,.045),amber,.007)
for side in [-1,1]: box('Sealed latch',(side*.32,-.22,1.95),(.07,.09,.18),steel,.008)
text('ARCHIVE / 05',(-.22,-.27,1.82),.052)

for y in [-15,-8,8,15]:
    box('Deck service hatch',(0,y,4.97),(1.25,1.65,.18),paint,.04)
    for x in [-.5,.5]: box('Hatch dog',(x,y,5.1),(.10,.3,.06),brass,.02)
for side in [-1,1]:
    pipe('Mooring rope',[(side*2.5,-15,5),(side*4,-17,4.8),(side*5,-19,.3)],.04,rubber)
    box('Deck bollard',(side*2.4,14,5.1),(.22,.7,.55),steel)

# Bridge, inspection windows and a functional-looking crane rather than a solid box silhouette.
box('Bridge cabin',(0,-12,6.3),(6.2,7,2.8),white,.07)
box('Bridge roof',(0,-12,7.78),(6.55,7.3,.16),steel)
box('Bridge access door',(-2,-15.56,6.05),(1.0,.08,2.0),steel,.045)
box('Door latch',(-1.63,-15.63,6.02),(.08,.07,.18),brass,.015)
for side in [-1,1]:
    for y in [-14.5,-13,-11.5,-10]:
        box('Window lower seal',(side*3.17,y,6.44),(.07,1.08,.055),rubber,.006)
for y in [-13,-11]:
    for z in [5.2,5.4,5.6]:box('Bridge ventilation louvre',(3.17,y,z),(.07,.72,.045),steel,.006)
pipe('Bridge access ladder',[(-3.4,-14,4.9),(-3.4,-14,7.8)],.035,steel)
pipe('Bridge access ladder',[(-3.4,-13.6,4.9),(-3.4,-13.6,7.8)],.035,steel)
for z in [5,5.3,5.6,5.9,6.2,6.5,6.8,7.1,7.4]:pipe('Ladder rung',[(-3.4,-14,z),(-3.4,-13.6,z)],.025,steel)
for x in [-2.4,-1.2,0,1.2,2.4]:
    box('Forward bridge glazing',(x,-8.48,6.8),(.94,.06,.65),glass,.025)
for side in [-1,1]:
    for y in [-14.5,-13,-11.5,-10]: box('Side bridge glazing',(side*3.13,y,6.8),(.05,1,.65),glass,.025)
    pipe('Bridge guardrail',[(side*3.5,-16,8.5),(side*3.5,-8,8.5)],.03,steel)
pipe('Radio mast',[(0,-12,7.8),(0,-12,11.4)],.07,steel)
for z,width in [(9,2.1),(10,1.6),(11,.8)]: pipe('Antenna spreader',[(-width,-12,z),(width,-12,z)],.022,steel)
pipe('Cargo crane pedestal',[(2,9,4.85),(2,9,8.1)],.17,steel)
pipe('Cargo crane boom',[(2,9,8.1),(0,2,7.2)],.13,steel)
pipe('Crane hoist',[(0,2,7.2),(0,2,5.2)],.026,rubber)
pipe('Crane bracing',[(2,9,8.1),(2,9,9),(0,2,7.2)],.025,steel)
text('PELAGIC / 05',(-2.2,-15.54,6.15),.45)

for i,(x,y,s) in enumerate([(9,11,1.6),(-10,-12,2.2),(10,-11,1.8),(-12,7,2.0)]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,.25))
    rock=link(bpy.context.object,'Encrusted outcrop',stone)
    rock.scale=(s,s*1.1,s*.65)
    for vertex in rock.data.vertices: vertex.co*=1+.13*math.sin(vertex.index*7.3+i)

bpy.ops.object.select_all(action='DESELECT')
for o in collection.objects: o.select_set(True)
bpy.context.view_layer.objects.active=next(iter(collection.objects))
bpy.ops.object.convert(target='MESH')
for o in collection.objects:
    bpy.context.view_layer.objects.active=o
    for modifier in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=modifier.name)
    o.data.color_attributes.new(name='Corrosion',type='FLOAT_COLOR',domain='POINT')
    for vertex,color in zip(o.data.vertices,o.data.color_attributes['Corrosion'].data):
        p=o.matrix_world@vertex.co
        grain=(math.sin(p.x*8.1+p.y*3.4+p.z*5.2)+math.sin(p.y*19+p.z*7.1))*.16
        patch=math.sin(p.x*2.4+p.y*.83)+math.cos(p.y*1.77+p.z*2.6)+grain
        base=o.data.materials[0].diffuse_color[:3]
        rust=(.22,.12,.065)
        blend=max(0,min(.85,(patch-.12)*.5))
        color.color=tuple(base[c]*(1-blend)+rust[c]*blend for c in range(3))+(1,)
groups={}
for o in collection.objects: groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,parts in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1: bpy.ops.object.join()
    parts[0].name='Freighter finish '+name

# Bake surface wear into compact, inspectable GLB textures; procedural shader nodes are not exported.
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=4
texture_dir=ROOT/'assets/blender/textures/wreckward'
texture_dir.mkdir(parents=True,exist_ok=True)
for obj in list(collection.objects):
    mat=obj.data.materials[0]
    if mat not in [paint,steel,white,stone]:
        for attribute in list(obj.data.color_attributes):obj.data.color_attributes.remove(attribute)
        continue
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=.8,island_margin=.012)
    bpy.ops.object.mode_set(mode='OBJECT')
    image=bpy.data.images.new(mat.name+' wear',width=512,height=512,alpha=False)
    nodes=mat.node_tree.nodes
    shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
    source=shader.inputs['Base Color'].links[0].from_socket
    emission=nodes.new('ShaderNodeEmission')
    mat.node_tree.links.new(source,emission.inputs['Color'])
    mat.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
    texture=nodes.new('ShaderNodeTexImage')
    texture.image=image
    nodes.active=texture
    bpy.ops.object.bake(type='EMIT',use_clear=True)
    path=texture_dir/(mat.name.replace(' ','-')+'.jpg')
    image.filepath_raw=str(path)
    image.file_format='JPEG'
    image.save()
    baked=bpy.data.images.load(str(path),check_existing=False)
    baked.pack()
    texture.image=baked
    mat.node_tree.links.new(shader.outputs['BSDF'],output.inputs['Surface'])
    mat.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color'])
    for attribute in list(obj.data.color_attributes):obj.data.color_attributes.remove(attribute)

# Deliberately simple physics proxies retain the two wide, separate swim-through openings.
def collider(name,pos,size):
    o=box('Collision '+name,pos,size,rubber,0)
    o['physicsCollider']=True
    for modifier in list(o.modifiers): o.modifiers.remove(modifier)
collider('cargo sole',(0,0,.95),(8.2,36,.2))
collider('cargo overhead',(0,0,4.87),(8.2,36,.2))
for side,spans in [(1,[(-18,-7),(-1,18)]),(-1,[(-18,1),(7,18)])]:
    for low,high in spans: collider('hull wall',(side*4.04,(low+high)/2,2.95),(.24,high-low,3.8))
for y in [-18,18]: collider('end bulkhead',(0,y,2.95),(4,.3,3.8))
collider('bridge',(0,-12,6.5),(6.2,7,3.2))
for x,y in [(2.65,5),(2.5,-7),(-2.55,-10),(-2.6,10)]: collider('cargo case',(x,y,1.6),(1.45,1.7,1.1))
for name,pos in [('entry',(2.4,-4,2.7)),('latch',(0,0,2.7)),('recorder',(0,0,2.7)),('exit',(-6,4,2.7))]:
    o=bpy.data.objects.new('Freighter anchor '+name,None)
    collection.objects.link(o)
    o.location=pos
bpy.ops.object.select_all(action='DESELECT')
for o in collection.objects: o.select_set(True)
target=ROOT/'public/models/wreckward_freighter.glb'
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True)

scene=bpy.context.scene
for o in collection.objects:
    if o.get('physicsCollider'): o.hide_render=True
scene.render.engine='CYCLES'
scene.cycles.samples=16
scene.render.resolution_x,scene.render.resolution_y=1200,780
scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Marine asset review')
scene.world.use_nodes=True
next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.075,.18,.23,1)
for pos,power in [((12,-6,30),5000),((-10,4,14),2500)]:
    bpy.ops.object.light_add(type='AREA',location=pos)
    o=bpy.context.object
    o.data.energy,o.data.size=power,20
    o.rotation_euler=(Vector((0,0,3))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(33,29,18))
scene.camera=bpy.context.object
scene.camera.rotation_euler=(Vector((0,0,3))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.type,scene.camera.data.ortho_scale='ORTHO',45
blend=ROOT/'assets/blender/wreckward_freighter.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
scene.render.filepath=str(ROOT/'output/playwright/wreckward-blender-review.png')
bpy.ops.render.render(write_still=True)
print('WRECKWARD_ASSET',target,target.stat().st_size)
