"""Original, browser-ready dive vessels based on assets/references/ocean-boats-v2-reference.png.

Run in a fresh background Blender process; never modifies the earlier boat sources.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import bmesh
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--stage', choices=['blockout', 'full'], default='full')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
FULL = args.stage == 'full'
for p in [ROOT/'public/models', ROOT/'assets/blender', ROOT/'output/boats-v2']:
    p.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.length_unit = 'METERS'

def mat(name, color, roughness=.3, metal=0, emission=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value = (*color, 1)
    n.inputs['Roughness'].default_value = roughness
    n.inputs['Metallic'].default_value = metal
    if emission:
        n.inputs['Emission Color'].default_value = (*color, 1)
        n.inputs['Emission Strength'].default_value = 2
    m.diffuse_color = (*color, 1)
    return m

M = {
    'white': mat('Pearl marine gelcoat', (.84,.87,.85), .22),
    'navy': mat('Deep navy antifouling', (.009,.029,.048), .3, .15),
    'slate': mat('Slate graphite hull', (.065,.105,.13), .31,.17),
    'glass': mat('Smoked reflective glazing', (.018,.052,.067), .12,.55),
    'metal': mat('Brushed stainless steel', (.48,.55,.58), .22,.86),
    'teak': mat('Warm weathered teak', (.38,.235,.115), .62),
    'seam': mat('Deck caulking', (.045,.033,.02), .8),
    'rubber': mat('Black marine rubber', (.012,.016,.018), .67),
    'orange': mat('Safety orange', (.92,.205,.032), .4),
    'seat': mat('Sand upholstery', (.66,.60,.47), .68),
    'blue': mat('Blue dive cylinder', (.014,.19,.34), .28,.28),
    'yellow': mat('Yellow dive cylinder', (.80,.59,.04), .3,.22),
    'red': mat('Port navigation light', (.75,.025,.012), .2,emission=True),
    'green': mat('Starboard navigation light', (.025,.62,.09), .2,emission=True),
    'interior': mat('Interior walnut', (.10,.067,.043), .6),
    'screen': mat('Marine instrument display', (.025,.17,.21), .25,emission=True),
    'rope': mat('Braided mooring rope', (.52,.49,.37), .85),
}

# A repeatable teak surface with individual boards, fine grain and caulking.
# It is exported as image maps, so the same material works in the browser.
def teak_maps():
    n=1024
    yy,xx=np.mgrid[0:n,0:n].astype(np.float32)/n
    rng=np.random.default_rng(42)
    board=np.floor(xx*10).astype(int)
    tones=np.array([.94,1.02,.88,1.08,.97,.90,1.04,.95,1.00,.91])[board]
    grain=np.sin(xx*1800+np.sin(yy*30)*1.8+np.sin(yy*63)*.5)*.020
    grain+=np.sin(xx*620+np.sin(yy*15)*3)*.029+rng.normal(0,.009,(n,n))
    seam=(np.mod(xx*10,1)<.025)
    endseam=np.mod(yy*2+(board%3)/3,1)<.003
    caulk=seam|endseam
    color=np.stack([(.45+grain)*tones,(.29+grain*.65)*tones,(.15+grain*.38)*tones],axis=-1)
    color[caulk]=(.065,.052,.040)
    rough=np.clip(.63-grain*2,0,1); rough[caulk]=.85
    height=grain*.07; height[caulk]=-.075
    dx=np.gradient(height,axis=1)*12; dy=np.gradient(height,axis=0)*12
    normal=np.stack([-dx,-dy,np.ones_like(dx)],axis=-1)
    normal/=np.linalg.norm(normal,axis=-1)[...,None]
    def image_map(name,rgb,linear=False):
        img=bpy.data.images.new(name,width=n,height=n)
        img.colorspace_settings.name='Non-Color' if linear else 'sRGB'
        rgba=np.concatenate([rgb,np.ones((n,n,1))],axis=-1).astype(np.float32)
        img.pixels.foreach_set(rgba.ravel()); img.update()
        img.filepath_raw=str(ROOT/'assets/references'/f'{name}.png'); img.file_format='PNG'; img.save(); img.pack()
        return img
    nodes=M['teak'].node_tree.nodes; links=M['teak'].node_tree.links
    bsdf=next(q for q in nodes if q.type=='BSDF_PRINCIPLED')
    for name,rgb,socket,linear in [('teak-color',color,'Base Color',False),('teak-roughness',np.repeat(rough[...,None],3,axis=-1),'Roughness',True)]:
        tex=nodes.new('ShaderNodeTexImage'); tex.image=image_map(name,rgb,linear)
        links.new(tex.outputs['Color'],bsdf.inputs[socket])
    tex=nodes.new('ShaderNodeTexImage'); tex.image=image_map('teak-normal',normal*.5+.5,True)
    nm=nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value=.24
    links.new(tex.outputs['Color'],nm.inputs['Color']); links.new(nm.outputs['Normal'],bsdf.inputs['Normal'])

if FULL: teak_maps()
glass_bsdf=next(n for n in M['glass'].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
glass_bsdf.inputs['Base Color'].default_value=(.08,.18,.22,1)
glass_bsdf.inputs['Metallic'].default_value=.12
glass_bsdf.inputs['Roughness'].default_value=.075
glass_bsdf.inputs['Transmission Weight'].default_value=.12
gel_bsdf=next(n for n in M['white'].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
gel_bsdf.inputs['Coat Weight'].default_value=.45
gel_bsdf.inputs['Coat Roughness'].default_value=.18

def move(obj, c):
    for old in list(obj.users_collection): old.objects.unlink(obj)
    c.objects.link(obj)
    return obj

def smooth(obj):
    if obj.type == 'MESH':
        for p in obj.data.polygons: p.use_smooth = True
    return obj

def mesh(name, verts, faces, material, c, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    bm = bmesh.new(); bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(data); bm.free()
    obj = bpy.data.objects.new(name, data); c.objects.link(obj)
    obj.data.materials.append(material)
    if material==M['teak']:
        uv=data.uv_layers.new(name='Deck plank UV')
        for poly in data.polygons:
            for li in poly.loop_indices:
                co=data.vertices[data.loops[li].vertex_index].co
                uv.data[li].uv=(co.x/2.4,co.y/5)
    if bevel:
        mod = obj.modifiers.new('Rounded fabrication edges','BEVEL')
        mod.width = bevel; mod.segments = 3
    return obj

def box(name, xyz, dims, material, c, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz)
    o = move(bpy.context.object, c); o.name = name; o.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        mod = o.modifiers.new('Soft edges','BEVEL'); mod.width=bevel; mod.segments=3
    return o

def ball(name, xyz, dims, material, c):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, location=xyz)
    o = move(bpy.context.object,c); o.name=name; o.scale=dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material); return smooth(o)

def tube(name, points, radius, material, c):
    d = bpy.data.curves.new(name, 'CURVE'); d.dimensions='3D'
    d.bevel_depth=radius; d.bevel_resolution=2; d.resolution_u=1
    sp=d.splines.new('POLY'); sp.points.add(len(points)-1)
    for v,p in zip(sp.points, points): v.co=(*p,1)
    o=bpy.data.objects.new(name,d); c.objects.link(o); o.data.materials.append(material)
    return o

def round_outline(width, length, radius=.65, y=0):
    points=[]
    for cx,cy,a in [(width/2-radius,length/2-radius,0),(-width/2+radius,length/2-radius,90),(-width/2+radius,-length/2+radius,180),(width/2-radius,-length/2+radius,270)]:
        for j in range(7):
            angle=math.radians(a+j*90/6)
            points.append((cx+radius*math.cos(angle),cy+radius*math.sin(angle)+y))
    return points

def loft(name, bottom, top, z0, z1, material, c, bevel=.05):
    n=len(bottom)
    v=[(x,y,z0) for x,y in bottom]+[(x,y,z1) for x,y in top]
    f=[tuple(reversed(range(n))),tuple(range(n,n*2))]
    for i in range(n):
        j=(i+1)%n; f.append((i,j,n+j,n+i))
    return mesh(name,v,f,material,c,bevel)

def panel(name, points, material, c):
    obj=mesh(name,points,[tuple(range(len(points)))],material,c)
    if material==M['white']:
        thick=obj.modifiers.new('Molded fiberglass thickness','SOLIDIFY'); thick.thickness=.075
        bevel=obj.modifiers.new('Molded edge radius','BEVEL'); bevel.width=.035; bevel.segments=3
    return obj

def cabin(name,w,length,cy,z0,height,c,fast=False):
    """A tapered, faceted marine cabin with open glazing apertures, not a dark band."""
    aft=cy+length*.5; front=cy-length*.5
    bottom=[(-w*.46,aft),(w*.46,aft),(w*.5,aft-length*.1),(w*.5,front+length*.16),(w*.30,front),(-w*.30,front),(-w*.5,front+length*.16),(-w*.5,aft-length*.1)]
    rake=.20 if fast else .12
    top=[(-w*.43,aft-.22),(w*.43,aft-.22),(w*.455,aft-length*.11),(w*.455,front+length*(.16+rake)),(w*.29,front+length*rake),(-w*.29,front+length*rake),(-w*.455,front+length*(.16+rake)),(-w*.455,aft-length*.11)]
    def at(i,u,v,offset=0):
        j=(i+1)%len(bottom)
        p0=Vector((*bottom[i],z0)).lerp(Vector((*bottom[j],z0)),u)
        p1=Vector((*top[i],z0+height)).lerp(Vector((*top[j],z0+height)),u)
        p=p0.lerp(p1,v)
        edge=Vector((*bottom[j],z0))-Vector((*bottom[i],z0))
        # Footprint is clockwise in the world XY plane.
        outward=Vector((-edge.y,edge.x,0)).normalized()
        return tuple(p+outward*offset)
    for i in range(8):
        divisions=(3 if fast else 4) if i in (2,6) else 2 if i in (0,4) else 1
        for j in range(divisions):
            a=j/divisions; b=(j+1)/divisions
            u0=a+.028; u1=b-.028
            v0=.07 if i==0 else .22 if i in (3,4,5) or fast else .34
            v1=.92
            # Structural shell surrounds each actual glass aperture.
            for xa,xb,ya,yb in [(a,b,0,v0),(a,b,v1,1),(a,u0,v0,v1),(u1,b,v0,v1)]:
                panel(name+' structural surround',[at(i,xa,ya),at(i,xb,ya),at(i,xb,yb),at(i,xa,yb)],M['white'],c)
            pts=[at(i,u0,v0,-.014),at(i,u1,v0,-.014),at(i,u1,v1,-.014),at(i,u0,v1,-.014)]
            panel(name+' individual glazing',pts,M['glass'],c)
            tube(name+' black glazing seal',pts+[pts[0]],.029,M['rubber'],c)
            # Stern doors have separate frames, handles and a step threshold.
            if i==0:
                frame=[at(i,u0,.04,.025),at(i,u1,.04,.025),at(i,u1,.94,.025),at(i,u0,.94,.025)]
                tube(name+' aft door frame',frame+[frame[0]],.050,M['metal'],c)
                hu=u1-.035
                tube(name+' aft door handle',[at(i,hu,.42,.08),at(i,hu,.54,.08)],.031,M['metal'],c)
            if i in (3,4,5):
                # Windshield wiper on each forward sloping pane.
                tube(name+' windscreen wiper',[at(i,(u0+u1)*.5,.25,.05),at(i,u0+.025,.66,.05)],.016,M['rubber'],c)
    panel(name+' interior floor',[(x,y,z0+.04) for x,y in bottom],M['interior'],c)
    # Raised curved roof skin, molded shoulder and discreet dark fascia.
    roof=[(x*1.075,(y-cy)*1.06+cy) for x,y in top]
    loft(name+' molded roof shoulder',roof,[(x*.985,(y-cy)*.99+cy) for x,y in roof],z0+height,z0+height+.23,M['white'],c,.10)
    if fast:
        # A shallow, curved hardtop crown and forward visor change the launch silhouette.
        forward=cy-length*.5+length*rake-.36
        crown=[]; crown_faces=[]; rows=24; columns=16
        for row in range(rows+1):
            t=row/rows; y=forward+(cy+length*.46-forward)*t
            rw=w*(.27+.16*min(1,(y-forward)/(length*.19)))
            for col in range(columns+1):
                u=col/columns*2-1
                z=z0+height+.23+.19*(1-u*u)*math.sin(math.pi*t)**.5
                crown.append((rw*u,y,z))
        for row in range(rows):
            for col in range(columns):
                i=row*(columns+1)+col; crown_faces.append((i,i+1,i+columns+2,i+columns+1))
        smooth(mesh(name+' cambered launch hardtop',crown,crown_faces,M['white'],c))
        tube(name+' hardtop forward visor',[(-w*.40,forward+length*.14,z0+height+.15),(-w*.27,forward,z0+height+.15),(w*.27,forward,z0+height+.15),(w*.40,forward+length*.14,z0+height+.15)],.07,M['white'],c)
    tube(name+' roof fascia',[(x,y,z0+height+.03) for x,y in roof]+[(roof[0][0],roof[0][1],z0+height+.03)],.033,M['slate'],c)
    # The forward helm and seating give the transparent glass real depth.
    box(name+' helm console',(0,front+length*.24,z0+.85),(w*.68,.7,1.05),M['slate'],c,.14)
    for x in [-w*.19,w*.19]:
        display=box(name+' navigation screen',(x,front+length*.24+.35,z0+1.24),(w*.23,.035,.25),M['screen'],c,.025)
        display.rotation_euler.x=math.radians(18)
        box(name+' captain chair cushion',(x,front+length*.34,z0+.82),(.62,.65,.22),M['seat'],c,.11)
        back=box(name+' captain chair back',(x,front+length*.34+.28,z0+1.15),(.62,.18,.7),M['seat'],c,.11)
        back.rotation_euler.x=math.radians(-10)
        tube(name+' chair pedestal',[(x,front+length*.34,z0+.10),(x,front+length*.34,z0+.76)],.08,M['metal'],c)
    return z0+height+.23

def boat(name, length, beam, expedition):
    c=bpy.data.collections.new(name); scene.collection.children.link(c)
    stern=length*.46; bow=-length*.54; stations=64
    port_ys=[-length*.30,-length*.16,length*.0,length*.18]
    ts=sorted(set([i/stations for i in range(stations+1)]+[(stern-(y+d))/length for y in port_ys for d in [-.75,.75]]))
    def width(t):
        taper=1 if t<.68 else max(.013,(1-((t-.68)/.32)**1.6))
        return beam*.5*(.82+.18*math.sin(math.pi*min(1,t/.75)))*taper
    def deckz(t): return 2.15+(max(0,(t-.72)/.28)**1.6)*.95
    loops=[]; verts=[]
    for t in ts:
        y=stern-length*t; w=width(t); z=deckz(t)
        keel=-2.3+(max(0,(t-.75)/.25)**2)*2.6
        ring=[(0,y,keel),(w*.34,y,keel+.23),(w*.65,y,-1.7),(w*.87,y,-.72),(w,y,.25),(w*.985,y,z-.35),(w*.955,y,z),(-w*.955,y,z),(-w*.985,y,z-.35),(-w,y,.25),(-w*.87,y,-.72),(-w*.65,y,-1.7),(-w*.34,y,keel+.23)]
        loops.append(list(range(len(verts),len(verts)+len(ring)))); verts+=ring
    f=[]
    for i in range(len(ts)-1):
        my=stern-length*(ts[i]+ts[i+1])*.5
        for j in range(13):
            if FULL and j in (4,8) and any(abs(my-y)<.749 for y in port_ys):
                # Real hull apertures; retain the shell above and below each port.
                a,b=Vector(verts[loops[i][j]]),Vector(verts[loops[i][(j+1)%13]])
                d,e=Vector(verts[loops[i+1][j]]),Vector(verts[loops[i+1][(j+1)%13]])
                for lo,hi in [(min(a.z,b.z),1.05),(1.58,max(a.z,b.z))]:
                    def byz(p,q,z): return tuple(p.lerp(q,(z-p.z)/(q.z-p.z)))
                    start=len(verts); verts += [byz(a,b,lo),byz(d,e,lo),byz(d,e,hi),byz(a,b,hi)]
                    f.append(tuple(range(start,start+4)))
            else: f.append((loops[i][j],loops[i][(j+1)%13],loops[i+1][(j+1)%13],loops[i+1][j]))
    # Leave the center of the transom and deck open for the molded dive stairwell.
    f=[face for face in f if not (face[0] in [loops[i][6] for i in range(4)])]
    f += [tuple(loops[-1])]
    hull=mesh(name+' continuous curved hull',verts,f,M['white'],c)
    hull.data.materials.append(M['navy'] if expedition else M['slate'])
    for poly in hull.data.polygons:
        poly.material_index=1 if sum(hull.data.vertices[i].co.z for i in poly.vertices)/len(poly.vertices)<.38 else 0
    smooth(hull)
    sw=width(0); sz=deckz(0); cut=1.35 if expedition else 1.05
    panel('Lower closed transom',[(verts[q]) for q in [loops[0][0],loops[0][1],loops[0][2],loops[0][3],loops[0][4]]]+[(sw*.997,stern,.65),(-sw*.997,stern,.65)]+[(verts[q]) for q in [loops[0][9],loops[0][10],loops[0][11],loops[0][12]]],M['navy'] if expedition else M['slate'],c)
    for side in [-1,1]:
        panel('Transom cheek with dive opening',[(side*sw,stern,.25),(side*sw*.985,stern,sz-.35),(side*sw*.955,stern,sz),(side*cut,stern,sz),(side*cut,stern,.65),(side*sw*.997,stern,.65)],M['white'],c)
    deck=[]
    for side, indices in [(1,range(stations+1)),(-1,range(stations,-1,-1))]:
        for i in indices:
            t=i/stations; deck.append((side*width(t)*.915,stern-length*t,deckz(t)+.035))
    deck += [(-cut,stern,sz+.035),(-cut,stern-2.1,sz+.035),(cut,stern-2.1,sz+.035),(cut,stern,sz+.035)]
    mesh(name+' fitted teak deck',deck,[tuple(range(len(deck)))],M['teak'],c)
    # Low stern platform and transom door: part of the dive workflow silhouette.
    loft('Stern swim platform',round_outline(beam*.94,2.5,.38,stern+.8),round_outline(beam*.94,2.5,.38,stern+.8),.40,.65,M['teak'],c)
    cabin_len=length*(.44 if expedition else .36); cabin_y=-length*(.075 if expedition else .14); cabin_w=beam*(.77 if expedition else .73)
    roof_z=cabin('Salon',cabin_w,cabin_len,cabin_y,2.18,3.18 if expedition else 2.32,c,fast=not expedition)
    if expedition:
        bridge_roof=cabin('Raised pilothouse',beam*.60,length*.25,-length*.12,roof_z+.05,2.35,c)
        upperdeck=round_outline(beam*.90,9.6,.8,length*.17)
        loft('Cantilever observation deck',upperdeck,upperdeck,roof_z-.12,roof_z+.04,M['white'],c,.08)
        loft('Observation teak inset',round_outline(beam*.82,9.2,.7,length*.17),round_outline(beam*.82,9.2,.7,length*.17),roof_z+.045,roof_z+.065,M['teak'],c)
        for side in [-1,1]:
            for y in [7.3,11.4]: tube('Observation deck support',[(side*beam*.37,y,2.2),(side*beam*.40,y,roof_z-.12)],.10,M['white'],c)
    if FULL:
        # Plank texture is longitudinal; margin boards follow the perimeter.
        for side in [-1,1]:
            tube('Teak curved margin seam',[(side*width(i/stations)*.87,stern-length*i/stations,deckz(i/stations)+.046) for i in range(stations+1)],.013,M['seam'],c)
        # Continuous rails follow the fitted curved hull, rather than a rectangle.
        for side in [-1,1]:
            pts=[]
            for i in range(0,stations+1,2):
                t=i/stations; x=side*width(t)*.955; y=stern-length*t; z=deckz(t)
                pts.append((x,y,z+.93))
                if i%4==0: tube('Hull rail stanchion',[(x,y,z),(x,y,z+.93)],.027,M['metal'],c)
            tube('Continuous top handrail',pts,.036,M['metal'],c)
            tube('Continuous middle guardrail',[(x,y,z-.42) for x,y,z in pts],.022,M['metal'],c)
            # Long waterline trim, cabin mullions and small marine ports.
            tube('Waterline trim',[(side*width(i/stations)*1.003,stern-length*i/stations,.52) for i in range(stations+1)],.034,M['metal'],c)
            for y in [-length*.30,-length*.16,length*.0,length*.18]:
                t=(stern-y)/length; w=width(t); x=side*w*.993
                # A shaped gasket at the local beam, with inset smoked glass.
                port=[(x,y-.75,1.05),(x,y+.60,1.05),(x,y+.75,1.17),(x,y+.75,1.47),(x,y+.60,1.58),(x,y-.75,1.58),(x,y-.82,1.47),(x,y-.82,1.17)]
                port=[(side*width((stern-py)/length)*(1-.015*(pz-.25)/(deckz((stern-py)/length)-.60))+.012*side,py,pz) for _,py,pz in port]
                tube('Hull port flush frame',port+[port[0]],.033,M['metal'],c)
                panel('Hull port recessed glass',[(px-side*.035,py,pz) for px,py,pz in port],M['glass'],c)
            for y in [-length*.32,-length*.17,length*.0,length*.16,length*.29]:
                w=width((stern-y)/length)
                x=side*(w+.23)
                tube('Vertical fender body',[(x,y,.75),(x,y,1.55)],.20,M['rubber'],c)
                for z in [.75,1.55]: ball('Rounded fender end',(x,y,z),(.20,.20,.20),M['rubber'],c)
                for z in [.94,1.34]:
                    tube('Fender molded ridge',[(x+.203*math.cos(a*math.tau/16),y+.203*math.sin(a*math.tau/16),z) for a in range(17)],.012,M['slate'],c)
                tube('Fender hanging line',[(side*w*.95,y,3.07),(x,y,1.76)],.016,M['rope'],c)
            # Bow cleat and forward navigation light.
            for y in [-length*.36,length*.37]:
                tube('Mooring cleat',[(side*beam*.30-.25,y,2.50),(side*beam*.30+.25,y,2.50)],.075,M['metal'],c)
            ball('Navigation light',(side*cabin_w*.46,cabin_y-cabin_len*.31,roof_z-.24),(.11,.17,.08),M['red' if side==-1 else 'green'],c)
        # Wraparound mast, radar, aerials and searchlight.
        mast_z=bridge_roof if expedition else roof_z
        tube('Radar mast',[(0,-2,mast_z),(0,-2,mast_z+2.8)],.12,M['white'],c)
        tube('Radar beam',[(-1.65,-2,mast_z+1.2),(1.65,-2,mast_z+1.2)],.10,M['white'],c)
        box('Rotating radar scanner',(0,-2,mast_z+2.45),(3.1,.4,.25),M['white'],c,.10)
        for x in [-1.15,1.15]:
            ball('Radar dome',(x,-2,mast_z+1.65),(.39,.39,.43),M['white'],c)
            tube('Radio antenna',[(x,-2,mast_z+1.5),(x,-2,mast_z+3.5)],.014,M['metal'],c)
        # Dive tanks with valves, rack, hoses, ladder, and safety equipment.
        rack_y=stern-3.4
        for x,col in [(-beam*.31,'blue'),(-beam*.22,'blue'),(-beam*.13,'yellow'),(beam*.20,'yellow'),(beam*.29,'blue')]:
            ball('Dive cylinder',(x,rack_y,2.93),(.20,.20,.72),M[col],c)
            tube('Cylinder valve',[(x,rack_y,3.55),(x,rack_y,3.80)],.045,M['metal'],c)
            tube('Cylinder retention band',[(x-.21,rack_y-.05,2.95),(x+.21,rack_y-.05,2.95)],.033,M['rubber'],c)
        box('Tank rack',(0,rack_y+.24,2.70),(beam*.76,.12,.15),M['metal'],c)
        for x in [-.75,.75]:
            tube('Stern ladder side',[(x,stern+1.6,1.4),(x,stern+1.9,.8),(x,stern+1.9,-.8)],.042,M['metal'],c)
        for z in [-.65,-.25,.15,.55,.95]: tube('Stern ladder rung',[(-.75,stern+1.9,z),(.75,stern+1.9,z)],.033,M['metal'],c)
        for side in [-1,1]:
            box('Stairwell molded cheek',(side*(cut+.045),stern-1.05,1.40),(.09,2.1,1.52),M['white'],c,.06)
            tube('Stairwell descending handrail',[(side*cut,stern-2.0,3.0),(side*cut,stern+.2,1.56)],.038,M['metal'],c)
            for y,z in [(stern-1.9,2.18),(stern-.2,.95)]: tube('Stairwell rail upright',[(side*cut,y,z),(side*cut,y,z+.85)],.03,M['metal'],c)
        for i in range(5):
            y=stern-1.88+i*.44; z=1.88-i*.30
            box('Molded transom stair',(0,y,z-.10),(cut*2,.48,.20),M['white'],c,.035)
            # Mesh rather than box so world XY plank UVs remain aligned.
            panel('Teak stair tread',[(-cut,y-.22,z+.015),(cut,y-.22,z+.015),(cut,y+.22,z+.015),(-cut,y+.22,z+.015)],M['teak'],c)
        box('Sample workstation',(beam*.27,stern-5.5,2.65),(1.65,2.0,.92),M['white'],c,.15)
        box('Sample worktop',(beam*.27,stern-5.5,3.14),(1.82,2.17,.12),M['metal'],c,.07)
        for y in [stern-5.0,stern-5.35,stern-5.7]:
            box('Sample tray',(beam*.27,y,3.23),(.90,.23,.06),M['rubber'],c,.025)
            for x in [beam*.27-.24,beam*.27,beam*.27+.24]:
                tube('Sample vial',[(x,y,3.24),(x,y,3.43)],.035,M['glass'],c)
        box('Safety case',(-beam*.28,stern-5.2,2.60),(1.2,1.5,.8),M['orange'],c,.12)
        for x in [-beam*.27,beam*.27]:
            box('Molded aft seat pedestal',(x,stern-8,2.35),(1.32,1.04,.34),M['white'],c,.09)
            box('Aft upholstered seat',(x,stern-8,2.67),(1.5,1.2,.34),M['seat'],c,.12)
            box('Aft seat back',(x,stern-8.48,3.12),(1.5,.22,.90),M['seat'],c,.10)
            for cx in [x-.65,x+.65]: tube('Seat stainless arm',[(cx,stern-8.5,2.35),(cx,stern-8.5,2.90),(cx,stern-7.55,2.90)],.025,M['metal'],c)
        # Foredeck anchor hardware, flush hatches, rope coils and lifebuoys.
        fy=-length*.38; fz=deckz((stern-fy)/length)+.07
        hatch=round_outline(1.30,1.70,.12,fy)
        loft('Foredeck hatch frame',hatch,hatch,fz,fz+.07,M['metal'],c,.02)
        loft('Foredeck hatch inset',round_outline(1.17,1.57,.10,fy),round_outline(1.17,1.57,.10,fy),fz+.075,fz+.09,M['glass'],c,.015)
        for x in [-.38,.38]: tube('Deck hatch hinge',[(x-.10,fy+.79,fz+.11),(x+.10,fy+.79,fz+.11)],.026,M['metal'],c)
        ay=-length*.46; az=deckz((stern-ay)/length)+.1
        tube('Anchor windlass drum',[(-.3,ay,az+.25),(.3,ay,az+.25)],.19,M['metal'],c)
        tube('Bow anchor chain',[(0,ay,az+.27),(0,-length*.535,3.22)],.040,M['slate'],c)
        tube('Anchor bow roller',[(-.25,-length*.48,2.95),(0,-length*.535,3.12),(.25,-length*.48,2.95)],.065,M['metal'],c)
        for side in [-1,1]:
            coil_y=stern-6.7; coil_x=side*beam*.34
            tube('Coiled mooring rope',[(coil_x+(.08+.32*t/100)*math.cos(t*.30),coil_y+(.08+.32*t/100)*math.sin(t*.30),2.25+.015*math.sin(t*.6)) for t in range(101)],.021,M['rope'],c)
            bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=10,location=(side*beam*.43,stern-4.4,2.95),rotation=(0,math.pi/2,0),major_radius=.39,minor_radius=.075)
            ring=move(bpy.context.object,c); ring.name='Orange lifesaving ring'; ring.data.materials.append(M['orange']); smooth(ring)
            tube('Life ring retaining line',[(side*beam*.43,stern-4.4,3.34),(side*beam*.43,stern-4.4,3.65)],.015,M['rope'],c)
        # Text is geometry, retained in export and visible on the transom.
        bpy.ops.object.text_add(location=(beam*.38,stern+.065,1.75),rotation=(math.pi/2,0,math.pi))
        label=move(bpy.context.object,c); label.data.body='AURORA 42' if expedition else 'VOYAGER X'; label.data.size=.25 if expedition else .20; label.data.extrude=.001; label.data.materials.append(M['navy']); label.name='Vessel transom name'
        bpy.context.view_layer.objects.active=label; bpy.ops.object.convert(target='MESH')
        if expedition:
            bx=beam*.38; by=stern-.8
            tube('Deck crane upright',[(bx,by,2.3),(bx,by,4.7)],.17,M['slate'],c)
            tube('Crane pedestal',[(bx,by,2.17),(bx,by,2.85)],.34,M['slate'],c)
            for z in [4.68,5.30]: tube('Crane swivel pin',[(bx-.25,by-.32,z),(bx+.25,by-.32,z)],.12,M['metal'],c)
            tube('Deck crane elbow',[(bx,by,4.7),(bx,by-.5,5.55),(bx,by-2.2,5.0)],.15,M['slate'],c)
            tube('Crane cable',[(bx,by-2.2,5.0),(bx,by-2.2,3.85)],.021,M['metal'],c)
            tube('Crane hydraulic ram',[(bx,by-.1,4.1),(bx,by-1.4,5.2)],.075,M['metal'],c)
            for side in [-1,1]:
                x=side*beam*.44
                tube('Observation rail',[(x,2.4,roof_z+1),(x,11.45,roof_z+1),(side*beam*.32,11.9,roof_z+1)],.037,M['metal'],c)
                for y in [2.4,4.6,6.8,9.0,11.45]: tube('Upper deck stanchion',[(x,y,roof_z+.05),(x,y,roof_z+1)],.027,M['metal'],c)
                for y in [5.0,7.0]:
                    x=side*beam*.27
                    box('Observation seat cushion',(x,y,roof_z+.72),(1.15,1.40,.22),M['seat'],c,.10)
                    back=box('Observation sculpted seat back',(x,y+.60,roof_z+1.07),(1.15,.20,.82),M['seat'],c,.10); back.rotation_euler.x=math.radians(-12)
                    for xoff in [-.45,.45]: tube('Observation chair frame',[(x+xoff,y-.55,roof_z+.07),(x+xoff,y-.55,roof_z+.65),(x+xoff,y+.55,roof_z+.65),(x+xoff,y+.55,roof_z+.07)],.027,M['metal'],c)
            tube('Observation table base',[(0,6,roof_z+.07),(0,6,roof_z+.9)],.08,M['metal'],c)
            tube('Observation circular table',[(0,6,roof_z+.95),(0,6,roof_z+1.02)],.65,M['white'],c)
            # Stair access rises beside the aft cabin without crossing the glazing.
            sx=-beam*.39
            for i in range(10): box('Upper deck companionway step',(sx,8.6+i*.23,2.35+i*.34),(.75,.27,.10),M['white'],c,.02)
            tube('Companionway handrail',[(sx-.40,8.45,3.2),(sx-.40,10.9,roof_z+1)],.035,M['metal'],c)
        else:
            for side in [-1,1]:
                # Research launch safety livery and larger impact fenders.
                w=width((stern+1)/length)
                o=box('Orange safety livery',(side*w*.994,-1,1.6),(.025,2.0,.35),M['orange'],c,.03)
                o.rotation_euler.x=math.radians(25)
    return c

collections=[boat('Aurora 42',42,8.6,True),boat('Voyager X',28,6.8,False)]

def export_boat(c, filename):
    # Apply fabrication bevels, convert tubing and batch by material for WebGL.
    for o in list(c.objects):
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
        if o.type=='CURVE': bpy.ops.object.convert(target='MESH')
        for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    groups={}
    for o in list(c.objects):
        if o.type=='MESH' and len(o.data.materials)==1: groups.setdefault(o.data.materials[0].name,[]).append(o)
    for objects in groups.values():
        if len(objects)<2: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
    bpy.ops.object.select_all(action='DESELECT')
    for o in c.objects: o.select_set(True)
    export_props=bpy.ops.export_scene.gltf.get_rna_type().properties
    format_values=[i.identifier for i in export_props['export_format'].enum_items]
    # Dynamic exporter enums may be absent in RNA's static enum_items list.
    if not format_values:
        import io_scene_gltf2
        format_values = [i[0] for i in io_scene_gltf2.get_format_items(None, bpy.context)]
    selected_format = next(i for i in format_values if i == 'GLB')
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models'/filename),export_format=selected_format,use_selection=True,export_animations=False,export_cameras=False,export_lights=False)

if FULL:
    export_boat(collections[0],'aurora_explorer_yacht_v2.glb')
    export_boat(collections[1],'voyager_research_launch_v2.glb')

# Render each boat from a rear quarter and side by side, after export.
preview=bpy.data.collections.new('Studio preview only'); scene.collection.children.link(preview)
floor=box('Studio floor',(0,0,-3.0),(140,140,.12),mat('Studio ground',(.10,.14,.18),.8),preview,.0)
for c,offset in zip(collections,[-8.8,9.0]):
    for o in c.objects: o.location.x+=offset
world=bpy.data.worlds.new('Marine studio world'); world.use_nodes=True
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND'); bg.inputs['Color'].default_value=(.32,.39,.48,1); bg.inputs['Strength'].default_value=.55; scene.world=world
for xyz,power,size in [((25,8,33),15000,20),((-22,-18,24),10000,16),((0,28,21),12000,14)]:
    bpy.ops.object.light_add(type='AREA',location=xyz)
    l=move(bpy.context.object,preview); l.data.energy=power; l.data.shape='DISK'; l.data.size=size
    l.rotation_euler=(Vector((0,0,2))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(65,74,47))
camera=move(bpy.context.object,preview); camera.data.lens=57
camera.rotation_euler=(Vector((0,0,3))-camera.location).to_track_quat('-Z','Y').to_euler(); scene.camera=camera
try: scene.render.engine='BLENDER_EEVEE'
except TypeError: pass
scene.render.resolution_x=1440; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
formats=[i.identifier for i in scene.render.image_settings.bl_rna.properties['file_format'].enum_items]
scene.render.image_settings.file_format=next(i for i in formats if i=='PNG')
scene.render.filepath=str(ROOT/'output/boats-v2'/f'boats-{args.stage}.png')
scene.render.film_transparent=False
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender'/f'ocean_boats_v2_{args.stage}.blend'))
bpy.ops.render.render(write_still=True)
stats={c.name:{'meshes':sum(o.type=='MESH' for o in c.objects),'vertices':sum(len(o.data.vertices) for o in c.objects if o.type=='MESH')} for c in collections}
(ROOT/'output/boats-v2'/f'stats-{args.stage}.json').write_text(json.dumps(stats,indent=2))
print(json.dumps(stats))
