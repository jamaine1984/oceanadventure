"""Refresh the editable land character scene and inspect retargeted pose motion."""
from pathlib import Path
import bpy, json, math, statistics, sys
from mathutils import Vector
root = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=30
path=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else root / 'public/models/ocean-player-character.glb'
bpy.ops.import_scene.gltf(filepath=str(path))
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.data.objects if o.type == 'MESH' and len(o.vertex_groups) > 50)
bpy.context.scene.render.fps = 30
record = {}
metrics = {}
for action in bpy.data.actions:
    rig.animation_data.action = action
    poses = []
    for frame in [1, 9, 17]:
        bpy.context.scene.frame_set(frame)
        evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        corners = [evaluated.matrix_world @ Vector(v) for v in evaluated.bound_box]
        bones = {b.name: list(b.matrix.translation) for b in rig.pose.bones if any(part in b.name for part in ['Foot', 'Hand']) and not any(part in b.name for part in ['Index', 'Thumb', 'Pinky', 'Middle', 'Ring'])}
        poses.append({'frame': frame, 'boundsMin': [min(v[i] for v in corners) for i in range(3)], 'boundsMax': [max(v[i] for v in corners) for i in range(3)], 'joints': bones})
    record[action.name] = poses
    feet=[next(b for b in rig.pose.bones if b.name.endswith(name)) for name in ['LeftFoot','RightFoot']]
    samples=[]
    for frame in range(math.ceil(action.frame_range[0]),math.floor(action.frame_range[1])+1):
        bpy.context.scene.frame_set(frame)
        samples.append([b.matrix.translation.copy() for b in feet])
    scale=1.75/.9165039
    velocities=[]
    for side in [0,1]:
        ground=min(s[side].z for s in samples)
        for i in range(1,len(samples)):
            if samples[i][side].z<ground+.025:
                v=(samples[i][side].y-samples[i-1][side].y)*30*scale
                if v>.1:velocities.append(v)
    metrics[action.name]={'foreAftFootSeparationM':max(abs(s[0].y-s[1].y) for s in samples)*scale,'lateralFootSeparationM':max(abs(s[0].x-s[1].x) for s in samples)*scale,'groundedFootSpeedMps':statistics.median(velocities) if velocities else 0}
rig.animation_data.action = next(a for a in bpy.data.actions if 'Idle' in a.name)
bpy.context.scene.frame_set(1)
if '--' not in sys.argv:bpy.ops.wm.save_as_mainfile(filepath=str(root / 'assets/blender/ocean_player_character.blend'))
prefix='land-jog-previous' if '--' in sys.argv else 'land-mesh2motion'
(root / f'output/character-review/{prefix}-poses.json').write_text(json.dumps({'poses':record,'metrics':metrics}, indent=2))
print('LAND_ANIMATIONS', list(record))
for name, poses in record.items():
    print('POSE_CHECK', name, [(p['frame'], p['boundsMin'], p['boundsMax']) for p in poses])
print('FOOT_MOTION_METRICS',json.dumps(metrics))
