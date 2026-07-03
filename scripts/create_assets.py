import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "public" / "models"
BLEND_DIR = ROOT / "assets" / "blender"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
BLEND_DIR.mkdir(parents=True, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def make_material(name, color, metallic=0.0, roughness=0.45, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], alpha)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Alpha"].default_value = alpha
    mat.diffuse_color = (color[0], color[1], color[2], alpha)
    if alpha < 1:
        mat.blend_method = "BLEND"
        mat.use_screen_refraction = True
        mat.show_transparent_back = True
    return mat


def assign_mat(obj, mat):
    obj.data.materials.append(mat)
    return obj


def shade_smooth(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    obj.select_set(False)


def add_bevel(obj, amount, segments=3):
    bevel = obj.modifiers.new(name="softened_edges", type="BEVEL")
    bevel.width = amount
    bevel.segments = segments
    bevel.affect = "EDGES"
    obj.modifiers.new(name="weighted_normals", type="WEIGHTED_NORMAL")
    return obj


def add_beveled_cube(name, location, scale, mat, bevel=0.05, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_mat(obj, mat)
    add_bevel(obj, bevel, segments)
    return obj


def add_cylinder_between(name, start, end, radius, mat, vertices=20):
    start_v = Vector(start)
    end_v = Vector(end)
    direction = end_v - start_v
    length = direction.length
    midpoint = (start_v + end_v) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    assign_mat(obj, mat)
    shade_smooth(obj)
    return obj


def add_uv_sphere(name, location, scale, mat, segments=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign_mat(obj, mat)
    shade_smooth(obj)
    return obj


def create_hull(materials):
    length = 30.0
    sections = 30
    loops = []
    verts = []

    for i in range(sections + 1):
        t = i / sections
        y = -length * 0.5 + t * length
        bow_taper = math.sin(math.pi * t) ** 0.52
        stern_fill = 0.78 + 0.22 * min(1.0, t * 2.2)
        half_width = (1.05 + 2.25 * bow_taper) * stern_fill
        if t < 0.16:
            half_width *= 0.42 + t * 3.3
        if t > 0.9:
            half_width *= 0.95 - (t - 0.9) * 2.0

        deck_z = 1.08 - 0.1 * abs(t - 0.5)
        chine_z = -0.72 - 0.25 * math.sin(math.pi * t)
        keel_z = -1.75 + 0.38 * abs(t - 0.5)
        flare = 1.12 + 0.1 * math.sin(math.pi * t)
        loop = [
            (0.0, y, keel_z),
            (half_width * 0.58, y, chine_z),
            (half_width * flare, y, 0.22),
            (half_width * 0.92, y, deck_z),
            (-half_width * 0.92, y, deck_z),
            (-half_width * flare, y, 0.22),
            (-half_width * 0.58, y, chine_z),
        ]
        indices = []
        for vert in loop:
            indices.append(len(verts))
            verts.append(vert)
        loops.append(indices)

    faces = []
    for i in range(sections):
        a = loops[i]
        b = loops[i + 1]
        for j in range(len(a)):
            faces.append((a[j], a[(j + 1) % len(a)], b[(j + 1) % len(a)], b[j]))
    faces.append(tuple(reversed(loops[0])))
    faces.append(tuple(loops[-1]))

    mesh = bpy.data.meshes.new("expedition_yacht_hull_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("expedition_yacht_hull", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(materials["hull_white"])
    add_bevel(obj, 0.07, 5)
    shade_smooth(obj)

    # Painted lower hull and rub rail are separate shaped strips so the yacht reads from distance.
    add_beveled_cube("navy_lower_hull_band", (0, 0.1, -0.35), (6.25, 27.2, 0.32), materials["hull_blue"], 0.12, 6)
    add_beveled_cube("black_rub_rail", (0, -0.3, 0.8), (6.5, 26.5, 0.12), materials["rubber"], 0.08, 4)
    return obj


def create_yacht(materials):
    create_hull(materials)
    add_beveled_cube("teak_main_deck", (0, -0.1, 1.18), (5.4, 24.0, 0.12), materials["teak"], 0.12, 5)
    add_beveled_cube("aft_swim_platform", (0, 15.4, 0.75), (5.2, 2.2, 0.18), materials["white"], 0.16, 6)
    add_beveled_cube("foredeck_sun_pad", (0, -8.8, 1.36), (3.25, 4.2, 0.22), materials["cream"], 0.18, 7)

    add_beveled_cube("main_cabin", (0, -1.2, 2.05), (4.45, 8.7, 1.8), materials["white"], 0.28, 8)
    add_beveled_cube("upper_bridge", (0, -1.8, 3.15), (3.35, 5.2, 1.05), materials["white"], 0.25, 8)
    add_beveled_cube("bridge_roof", (0, -1.9, 3.86), (3.85, 5.8, 0.26), materials["white"], 0.18, 6)
    add_beveled_cube("aft_shaded_lounge", (0, 5.0, 2.0), (4.65, 3.2, 0.95), materials["white"], 0.22, 6)

    for x in (-2.34, 2.34):
        add_beveled_cube(f"side_glass_{x}", (x, -1.45, 2.2), (0.08, 6.2, 0.95), materials["glass"], 0.035, 2)
    add_beveled_cube("windshield_center", (0, -5.66, 2.58), (3.0, 0.08, 0.88), materials["glass"], 0.04, 2)
    add_beveled_cube("bridge_windshield", (0, -4.35, 3.35), (2.65, 0.08, 0.58), materials["glass"], 0.035, 2)

    for x in (-1.6, -0.55, 0.55, 1.6):
        add_beveled_cube(f"cabin_porthole_{x}", (x, -6.6, 2.02), (0.48, 0.05, 0.34), materials["dark_glass"], 0.05, 5)
    for y in (-3.8, -2.4, -1.0, 0.4, 1.8):
        add_beveled_cube(f"port_window_{y}", (-2.56, y, 1.9), (0.06, 0.82, 0.42), materials["dark_glass"], 0.04, 4)
        add_beveled_cube(f"starboard_window_{y}", (2.56, y, 1.9), (0.06, 0.82, 0.42), materials["dark_glass"], 0.04, 4)

    # Stainless railings, built as real cylinders and posts.
    rail_z = 1.86
    for side, x in (("port", -2.82), ("starboard", 2.82)):
        add_cylinder_between(f"{side}_bow_rail", (x, -12.4, rail_z), (x * 0.78, -6.2, rail_z + 0.08), 0.035, materials["chrome"], 18)
        add_cylinder_between(f"{side}_mid_rail", (x * 0.78, -6.2, rail_z + 0.08), (x, 8.2, rail_z), 0.035, materials["chrome"], 18)
        add_cylinder_between(f"{side}_aft_rail", (x, 8.2, rail_z), (x * 0.84, 13.2, rail_z - 0.1), 0.035, materials["chrome"], 18)
        for y in (-11.2, -8.0, -4.7, -1.3, 2.2, 5.8, 9.2, 12.0):
            add_cylinder_between(f"{side}_rail_post_{y}", (x * 0.96, y, 1.18), (x * 0.96, y, rail_z), 0.028, materials["chrome"], 14)

    add_cylinder_between("radar_mast", (0, -1.95, 3.88), (0, -1.95, 5.1), 0.06, materials["chrome"], 20)
    add_uv_sphere("radar_dome", (0, -1.95, 5.18), (0.55, 0.55, 0.28), materials["white"], 32, 12)
    add_cylinder_between("vhf_antenna", (0.82, -1.9, 3.92), (1.42, -2.55, 6.2), 0.018, materials["chrome"], 12)
    add_cylinder_between("nav_light_bar", (-1.4, -1.8, 4.05), (1.4, -1.8, 4.05), 0.035, materials["chrome"], 16)
    add_uv_sphere("red_nav_light", (-1.52, -1.8, 4.05), (0.12, 0.12, 0.12), materials["red_light"], 16, 8)
    add_uv_sphere("green_nav_light", (1.52, -1.8, 4.05), (0.12, 0.12, 0.12), materials["green_light"], 16, 8)

    # Lifebuoys and cockpit details.
    for x in (-2.75, 2.75):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.32, minor_radius=0.055, major_segments=32, minor_segments=8, location=(x, 7.05, 1.78))
        torus = bpy.context.object
        torus.name = f"lifebuoy_{x}"
        torus.rotation_euler[1] = math.radians(90)
        assign_mat(torus, materials["safety_orange"])
        shade_smooth(torus)
    add_beveled_cube("helm_console", (0, -3.25, 3.4), (1.2, 0.68, 0.48), materials["dark_panel"], 0.08, 4)
    add_cylinder_between("steering_wheel_mount", (0, -3.68, 3.42), (0, -3.92, 3.42), 0.035, materials["chrome"], 12)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.018, major_segments=32, minor_segments=6, location=(0, -3.98, 3.42))
    wheel = bpy.context.object
    wheel.name = "steering_wheel"
    wheel.rotation_euler[0] = math.radians(90)
    assign_mat(wheel, materials["chrome"])
    shade_smooth(wheel)

    # A wavy cloth flag, named so the runtime can animate it subtly if desired.
    flag_verts = []
    flag_faces = []
    cols = 5
    rows = 3
    for r in range(rows):
        for c in range(cols):
            flag_verts.append((0.12 * math.sin(c * 0.9), -1.93 - c * 0.34, 4.8 - r * 0.18))
    for r in range(rows - 1):
        for c in range(cols - 1):
            a = r * cols + c
            flag_faces.append((a, a + 1, a + 1 + cols, a + cols))
    mesh = bpy.data.meshes.new("wind_flag_mesh")
    mesh.from_pydata(flag_verts, [], flag_faces)
    mesh.update()
    flag = bpy.data.objects.new("wind_flag", mesh)
    bpy.context.collection.objects.link(flag)
    flag.data.materials.append(materials["flag_teal"])
    add_cylinder_between("flag_pole", (0, -1.95, 3.95), (0, -1.95, 4.95), 0.025, materials["chrome"], 12)


def create_explorer_npc(materials):
    # NPC stands on the flybridge facing the route.
    add_uv_sphere("explorer_head", (0.72, -3.18, 4.16), (0.22, 0.22, 0.26), materials["skin"], 24, 12)
    add_beveled_cube("explorer_torso", (0.72, -3.18, 3.75), (0.42, 0.26, 0.62), materials["jacket"], 0.08, 4)
    add_beveled_cube("explorer_vest", (0.72, -3.35, 3.78), (0.36, 0.08, 0.46), materials["safety_orange"], 0.04, 3)
    add_cylinder_between("explorer_left_leg", (0.58, -3.18, 3.45), (0.52, -3.18, 3.1), 0.07, materials["pants"], 14)
    add_cylinder_between("explorer_right_leg", (0.86, -3.18, 3.45), (0.92, -3.18, 3.1), 0.07, materials["pants"], 14)
    add_cylinder_between("explorer_left_arm", (0.49, -3.17, 3.9), (0.18, -3.5, 3.65), 0.055, materials["skin"], 14)
    add_cylinder_between("explorer_right_arm", (0.95, -3.17, 3.9), (1.18, -3.55, 3.68), 0.055, materials["skin"], 14)
    add_beveled_cube("explorer_binoculars", (0.72, -3.52, 4.04), (0.46, 0.16, 0.14), materials["dark_panel"], 0.04, 4)
    add_uv_sphere("explorer_cap", (0.72, -3.18, 4.38), (0.25, 0.25, 0.08), materials["cap"], 24, 8)
    add_beveled_cube("explorer_cap_brim", (0.72, -3.43, 4.34), (0.34, 0.22, 0.04), materials["cap"], 0.03, 3)


def add_scene_helpers(materials):
    bpy.ops.object.light_add(type="AREA", location=(0, -5, 8))
    light = bpy.context.object
    light.name = "asset_preview_softbox"
    light.data.energy = 350
    light.data.size = 7
    bpy.ops.object.camera_add(location=(8, -22, 8), rotation=(math.radians(63), 0, math.radians(21)))
    bpy.context.scene.camera = bpy.context.object


def main():
    clear_scene()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.render.engine = "CYCLES"

    materials = {
        "hull_white": make_material("pearl white gelcoat", (0.92, 0.95, 0.94), 0.0, 0.22),
        "white": make_material("warm white fiberglass", (0.96, 0.97, 0.94), 0.0, 0.3),
        "hull_blue": make_material("deep ocean navy hull", (0.02, 0.12, 0.24), 0.0, 0.34),
        "teak": make_material("oiled teak deck", (0.57, 0.34, 0.16), 0.0, 0.54),
        "cream": make_material("cream deck cushions", (0.9, 0.82, 0.68), 0.0, 0.62),
        "glass": make_material("tinted blue glass", (0.28, 0.57, 0.72), 0.0, 0.08, 0.42),
        "dark_glass": make_material("dark reflective glass", (0.03, 0.08, 0.12), 0.0, 0.14, 0.72),
        "chrome": make_material("brushed chrome", (0.75, 0.78, 0.78), 1.0, 0.18),
        "rubber": make_material("black rubber rail", (0.01, 0.012, 0.014), 0.0, 0.48),
        "safety_orange": make_material("safety orange", (1.0, 0.28, 0.05), 0.0, 0.4),
        "red_light": make_material("red navigation light", (1.0, 0.03, 0.02), 0.0, 0.18),
        "green_light": make_material("green navigation light", (0.02, 0.9, 0.28), 0.0, 0.18),
        "flag_teal": make_material("teal expedition flag", (0.0, 0.56, 0.66), 0.0, 0.58),
        "skin": make_material("warm skin", (0.73, 0.47, 0.32), 0.0, 0.52),
        "jacket": make_material("storm jacket navy", (0.05, 0.16, 0.26), 0.0, 0.55),
        "pants": make_material("charcoal deck pants", (0.04, 0.05, 0.06), 0.0, 0.6),
        "cap": make_material("canvas explorer cap", (0.63, 0.55, 0.38), 0.0, 0.65),
        "dark_panel": make_material("matte instrument panel", (0.015, 0.018, 0.02), 0.0, 0.42),
    }

    create_yacht(materials)
    create_explorer_npc(materials)
    add_scene_helpers(materials)

    for obj in bpy.context.scene.objects:
        obj.select_set(True)

    blend_path = BLEND_DIR / "ocean_adventure_yacht.blend"
    glb_path = MODEL_DIR / "expedition_yacht.glb"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )

    print(f"Saved Blender source: {blend_path}")
    print(f"Exported GLB: {glb_path}")


if __name__ == "__main__":
    main()
