"""Render the actual runtime land clips in a clear side view for motion review."""
from pathlib import Path
import bpy, math
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(root/'public/models/ocean-player-character.glb'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.render.resolution_x=480;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.fps=30
scene.display.shading.light='STUDIO';scene.display.shading.color_type='TEXTURE'
scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
scene.world=bpy.data.worlds.new('Review world')
scene.display.shading.background_type='WORLD';scene.world.color=(.075,.10,.12)
bpy.ops.mesh.primitive_plane_add(size=200)
floor=bpy.context.object;floor.name='Review floor';floor.location.z=-.025
floor.color=(.16,.22,.24,1)
bpy.ops.object.camera_add(location=(2,-.35,.61))
camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=1.11
camera.rotation_euler=(Vector((0,0,.45))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
for name in ['Walk','Run']:
    action=next(a for a in bpy.data.actions if a.name==name)
    rig.animation_data.action=action
    folder=root/'output/character-review'/('compact-jog-frames' if name=='Run' else 'default-walk-frames')
    folder.mkdir(exist_ok=True,parents=True)
    start,end=action.frame_range
    for i in range(24):
        frame=start+(end-start)*i/24
        scene.frame_set(math.floor(frame),subframe=frame%1)
        scene.render.filepath=str(folder/f'{i:02}.png')
        bpy.ops.render.render(write_still=True)
    print('MOTION_RENDERED',name,24)
