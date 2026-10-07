"""Prepare the user-supplied rigged character in an isolated Blender process."""
from pathlib import Path
import bpy
import json
import math
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/characters/ocean-human-source.glb'
OUT = ROOT / 'output/character-review'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
print('CHARACTER_INFO', json.dumps({
    'version': bpy.app.version_string,
    'objects': [(o.name, o.type, list(o.dimensions)) for o in bpy.context.scene.objects],
    'bones': {b.name: {'head': list(b.head_local), 'tail': list(b.tail_local)} for b in rig.data.bones if any(s in b.name for s in ['Hips', 'UpLeg', 'Arm', 'Shoulder', 'Head', 'Foot'])},
    'export_animation_modes': [i.identifier for i in bpy.ops.export_scene.gltf.get_rna_type().properties['export_animation_mode'].enum_items],
}))
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.render.resolution_x=1000
scene.render.resolution_y=1000
scene.render.resolution_percentage=100
world=bpy.data.worlds.new('Character review studio')
world.use_nodes=True
next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs['Color'].default_value=(.17,.20,.24,1)
next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs['Strength'].default_value=.6
scene.world=world
for name,loc,power,size in [('Key',(-1.5,-2,2.5),160,2),('Fill',(2,-1,1.2),80,2),('Rim',(0,1.5,2),180,1.5)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    lamp=bpy.data.objects.new(name,data);scene.collection.objects.link(lamp);lamp.location=loc;lamp.rotation_euler=(Vector((0,0,.5))-lamp.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('Review camera');camera=bpy.data.objects.new('Review camera',camera_data);scene.collection.objects.link(camera);scene.camera=camera
camera.location=(1.15,-2.5,1.3);camera.rotation_euler=(Vector((0,0,.45))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=1.6
scene.render.filepath=str(OUT/'source-character.png')
bpy.ops.render.render(write_still=True)

# Author stationary clips on the supplied skeleton. Translation remains owned by
# the browser controller, so animations cannot move the player through collision.
rest={b.name:b.matrix_local.to_quaternion() for b in rig.data.bones}
local_rest={b.name:(rest[b.parent.name].inverted() @ rest[b.name] if b.parent else rest[b.name]) for b in rig.data.bones}
X,Y,Z=Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1))
identity=Quaternion()
scene.render.fps=30
rig.animation_data_create()
for clip,frames in [('Idle',90),('Walk',30),('Run',22),('Swim',44)]:
    action=bpy.data.actions.new(clip);rig.animation_data.action=action
    for frame in range(1,frames+2,2):
        # Always include an identical endpoint for seamless looping.
        phase=(min(frame-1,frames)/frames)*math.tau
        fast=clip=='Run'; moving=clip in ('Walk','Run'); swimming=clip=='Swim'
        corr={}
        sway=math.sin(phase)*(.025 if moving else .012)
        corr['mixamorig:Hips']=Quaternion(Y,sway)
        corr['mixamorig:Spine']=Quaternion(X,(-.055 if fast else -.018 if moving else .007*math.sin(phase))) @ Quaternion(Z,-sway*.4)
        corr['mixamorig:Spine1']=Quaternion(X,.012*math.sin(phase))
        corr['mixamorig:Spine2']=Quaternion(Z,sway*.6)
        for side,label in [(1,'Left'),(-1,'Right')]:
            p=phase+(0 if side==1 else math.pi)
            thigh=math.sin(p)*(.55 if fast else .38 if moving else .16 if swimming else 0)
            bend=max(0,math.sin(p))*(.80 if fast else .55 if moving else .19 if swimming else 0)
            corr[f'mixamorig:{label}UpLeg']=Quaternion(X,thigh)
            corr[f'mixamorig:{label}Leg']=Quaternion(X,thigh+bend)
            corr[f'mixamorig:{label}Foot']=Quaternion(X,.12*math.sin(p) if moving or swimming else 0)
            corr[f'mixamorig:{label}ToeBase']=Quaternion(X,.04*math.sin(p) if moving else 0)
            drop=side*(1.28 if swimming else 1.38)
            swing=-math.sin(p)*(.46 if fast else .28 if moving else .08 if swimming else .016)
            elbow=.55 if fast else .24 if swimming else .13
            corr[f'mixamorig:{label}Arm']=Quaternion(X,swing) @ Quaternion(Y,drop)
            corr[f'mixamorig:{label}ForeArm']=Quaternion(X,swing-elbow) @ Quaternion(Y,drop)
            corr[f'mixamorig:{label}Hand']=Quaternion(X,swing-elbow) @ Quaternion(Y,drop)
        posed={}
        for bone in rig.data.bones:
            pb=rig.pose.bones[bone.name]
            pb.rotation_mode='QUATERNION'
            parent=posed.get(bone.parent.name,identity) if bone.parent else identity
            if bone.name in corr:
                target=corr[bone.name] @ rest[bone.name]
                pb.rotation_quaternion=local_rest[bone.name].inverted() @ parent.inverted() @ target
            else:
                pb.rotation_quaternion=identity
            posed[bone.name]=parent @ local_rest[bone.name] @ pb.rotation_quaternion
            pb.location=(0,0,0)
            if bone.name=='mixamorig:Hips' and moving:
                # Local hip axis is upright; small bounce only, with no root travel.
                pb.location.y=abs(math.sin(phase))* (.012 if fast else .006)
            pb.keyframe_insert(data_path='rotation_quaternion',frame=frame)
            if bone.name=='mixamorig:Hips':pb.keyframe_insert(data_path='location',frame=frame)
    action['purpose']='In-place '+clip.lower()+' for Ocean Adventure'

# Keep a complete editable source and a bounded 2K runtime texture.
for image in bpy.data.images:
    if image.size[0]>2048 and image.size[1]>2048:image.scale(2048,2048)
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
bpy.context.view_layer.update()
for o in bpy.context.scene.objects:o.select_set(False)
rig.select_set(True);body.select_set(True);bpy.context.view_layer.objects.active=rig
asset_dir=ROOT/'assets/blender';asset_dir.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(asset_dir/'ocean_player_character.blend'))
runtime=ROOT/'public/models/ocean-player-character.glb'
bpy.ops.export_scene.gltf(filepath=str(runtime),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_image_format='JPEG',export_jpeg_quality=90)
scene.render.filepath=str(OUT/'standing-character.png');bpy.ops.render.render(write_still=True)
print('CHARACTER_READY',str(runtime))
