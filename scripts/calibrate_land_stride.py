"""Narrow foot lanes and shorten the run into a low, compact jog.

Changes animation rotations and hip height only. Mesh, skin and source files are
untouched. Re-run package_land_motion.py before changing calibration amounts.
"""
from pathlib import Path
import bisect, json, math, struct

path=Path(__file__).resolve().parents[1]/'public/models/ocean-player-character.glb'
blob=path.read_bytes();length=struct.unpack_from('<I',blob,12)[0]
doc=json.loads(blob[20:20+length]);binary=bytearray(blob[28+length:])
extras=doc['asset'].setdefault('extras',{})
if extras.get('strideCalibrationDegrees'):
    raise ValueError('Already calibrated; package the source clips first')
def unit(q):
    d=math.sqrt(sum(v*v for v in q));return tuple(v/d for v in q)
def mul(a,b):
    x,y,z,w=a;X,Y,Z,W=b
    return (w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z)
def inv(q):return (-q[0],-q[1],-q[2],q[3])
def slerp(a,b,t):
    dot=sum(x*y for x,y in zip(a,b))
    if dot<0:b=tuple(-v for v in b);dot=-dot
    if dot>.9995:return unit(tuple(x+(y-x)*t for x,y in zip(a,b)))
    angle=math.acos(max(-1,min(1,dot)));s=math.sin(angle)
    return tuple((x*math.sin((1-t)*angle)+y*math.sin(t*angle))/s for x,y in zip(a,b))
def values(index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    n={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];stride=v.get('byteStride',n*4)
    offset=v.get('byteOffset',0)+a.get('byteOffset',0)
    return [struct.unpack_from('<'+'f'*n,binary,offset+i*stride) for i in range(a['count'])]
parents={child:i for i,node in enumerate(doc['nodes']) for child in node.get('children',[])}
names={''.join(c for c in node.get('name','').lower() if c.isalnum()):i for i,node in enumerate(doc['nodes'])}
amounts={'Idle':5.5,'Walk':4.5,'Run':3.0}
def rotate(q,v):return mul(mul(q,(*v,0)),inv(q))[:3]
def append_track(vs,kind):
    while len(binary)%4:binary.append(0)
    offset=len(binary);n=len(vs[0])
    for value in vs:binary.extend(struct.pack('<'+'f'*n,*value))
    view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(vs)*n*4})
    accessor=len(doc['accessors']);doc['accessors'].append({'bufferView':view,'componentType':5126,'count':len(vs),'type':kind})
    return accessor
for clip in doc['animations']:
    tracks={};samplers={};positions={};position_samplers={}
    for c in clip['channels']:
        if c['target']['path']=='translation':
            sampler=clip['samplers'][c['sampler']]
            positions[c['target']['node']]=([t[0] for t in values(sampler['input'])],values(sampler['output']))
            position_samplers[c['target']['node']]=c['sampler']
        if c['target']['path']=='rotation':
            sampler=clip['samplers'][c['sampler']]
            if sampler.get('interpolation','LINEAR')!='LINEAR':raise ValueError('Expected linear rotations')
            tracks[c['target']['node']]=([t[0] for t in values(sampler['input'])],values(sampler['output']))
            samplers[c['target']['node']]=c['sampler']
    def sample(track,t,quaternion=False):
        times,qs=track;i=bisect.bisect_right(times,t)-1
        if i<0:return qs[0]
        if i>=len(times)-1:return qs[-1]
        blend=(t-times[i])/(times[i+1]-times[i])
        return slerp(qs[i],qs[i+1],blend) if quaternion else tuple(a+(b-a)*blend for a,b in zip(qs[i],qs[i+1]))
    def local(node,t):
        return sample(tracks[node],t,True) if node in tracks else tuple(doc['nodes'][node].get('rotation',[0,0,0,1]))
    def world(node,t,override):
        if node is None:return (0,0,0,1)
        return mul(world(parents.get(node),t,override),override.get(node,local(node,t)))
    corrected={};altered={}
    # Keep the source's alternating rhythm but reduce thigh reach and heel kick.
    if clip['name']=='Run':
        for side in ['left','right']:
            for bone,factor in [('upleg',.55),('leg',.58)]:
                node=names['mixamorig'+side+bone]
                rest=unit(doc['nodes'][node].get('rotation',[0,0,0,1]))
                altered[node]=(tracks[node][0],[slerp(rest,q,factor) for q in tracks[node][1]])
    def shortened_at(t):return {node:sample(track,t,True) for node,track in altered.items()}
    for side,sign in [('left',-1),('right',1)]:
        thigh=names['mixamorig'+side+'upleg'];foot=names['mixamorig'+side+'foot']
        angle=math.radians(amounts[clip['name']])*sign
        delta=(0,0,math.sin(angle/2),math.cos(angle/2))
        def thigh_at(t):
            overrides=shortened_at(t)
            parent=world(parents.get(thigh),t,{})
            return unit(mul(inv(parent),mul(delta,world(thigh,t,overrides))))
        corrected[thigh]=[thigh_at(t) for t in tracks[thigh][0]]
        corrected[foot]=[unit(mul(inv(world(parents.get(foot),t,{**shortened_at(t),thigh:thigh_at(t)})),world(foot,t,{}))) for t in tracks[foot][0]]
    for node,track in altered.items():
        if node not in corrected:corrected[node]=track[1]
    if clip['name']=='Run':
        def world_trs(node,t,override):
            if node is None:return ((0,0,0),(0,0,0,1),(1,1,1))
            p,q,s=world_trs(parents.get(node),t,override)
            nd=doc['nodes'][node]
            translation=sample(positions[node],t) if node in positions else nd.get('translation',[0,0,0])
            offset=rotate(q,tuple(a*b for a,b in zip(translation,s)))
            return (tuple(a+b for a,b in zip(p,offset)),mul(q,override.get(node,local(node,t))),tuple(a*b for a,b in zip(s,nd.get('scale',[1,1,1]))))
        feet=[node for name,node in names.items() if name.endswith(('leftfoot','rightfoot','lefttoebase','righttoebase','lefttoeend','righttoeend'))]
        hips=names['mixamorighips'];times=positions[hips][0]
        lowest=lambda t,o:min(world_trs(node,t,o)[0][1] for node in feet)
        ground=min(lowest(t,{}) for t in times)
        heights=[]
        for t,translation in zip(times,positions[hips][1]):
            overrides={node:sample((tracks[node][0],qs),t,True) for node,qs in corrected.items()}
            # Reduced leg flex extends the leg. Lift the hip just enough to keep
            # the original floor clearance, with only 30% of the source flight.
            desired=ground+.30*(lowest(t,{})-ground)
            _,parent_q,parent_s=world_trs(parents.get(hips),t,{})
            local_offset=rotate(inv(parent_q),(0,desired-lowest(t,overrides),0))
            heights.append(tuple(v+offset/scale for v,offset,scale in zip(translation,local_offset,parent_s)))
        clip['samplers'][position_samplers[hips]]['output']=append_track(heights,'VEC3')
    for node,qs in corrected.items():
        # Keep quaternion signs continuous for interpolation across each loop.
        for i in range(1,len(qs)):
            if sum(x*y for x,y in zip(qs[i-1],qs[i]))<0:qs[i]=tuple(-v for v in qs[i])
        clip['samplers'][samplers[node]]['output']=append_track(qs,'VEC4')
extras['strideCalibrationDegrees']=amounts
extras['compactJog']={'thighMotion':.55,'kneeMotion':.58,'flightHeight':.30}
doc['buffers']=[{'byteLength':len(binary)}]
payload=json.dumps(doc,separators=(',',':')).encode()
while len(payload)%4:payload+=b' '
while len(binary)%4:binary.append(0)
path.write_bytes(struct.pack('<III',0x46546C67,2,28+len(payload)+len(binary))+struct.pack('<II',len(payload),0x4E4F534A)+payload+struct.pack('<II',len(binary),0x004E4942)+binary)
print('CALIBRATED_FOOT_LANES',amounts)
