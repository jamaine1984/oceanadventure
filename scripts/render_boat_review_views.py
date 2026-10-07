"""Render readable review views from the saved, editable boat scene."""
from pathlib import Path
import bpy
from mathutils import Vector

root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/blender/ocean_boats_v2_full.blend'))
scene=bpy.context.scene
scene.render.resolution_x=1400
scene.render.resolution_y=900
camera=scene.camera
for name,offset,length in [('Aurora 42',-8.8,42),('Voyager X',9.0,28)]:
    for other in ['Aurora 42','Voyager X']:
        for obj in bpy.data.collections[other].objects: obj.hide_render=other!=name
    for view,position in [('front',(offset+length*.83,-length*.87,length*.43)),('aft',(offset+length*.75,length*.73,length*.40))]:
        camera.location=position
        camera.data.lens=52
        camera.rotation_euler=(Vector((offset,-length*.03,3))-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(root/'output/boats-v2'/f'{name.lower().replace(" ","-")}-{view}.png')
        bpy.ops.render.render(write_still=True)
