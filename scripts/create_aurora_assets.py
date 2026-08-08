import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "public" / "models"
BLEND_DIR = ROOT / "assets" / "blender"
OUTPUT_DIR = ROOT / "output"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
BLEND_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def make_collection(name):
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def make_material(name, color, metallic=0.0, roughness=0.45, alpha=1.0, emission=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, alpha)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Alpha"].default_value = alpha
        if emission:
            emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
            emission_strength = bsdf.inputs.get("Emission Strength")
            if emission_input:
                emission_input.default_value = (*emission, 1.0)
            if emission_strength:
                emission_strength.default_value = 2.8
    material.diffuse_color = (*color, alpha)
    if alpha < 1:
        try:
            material.surface_render_method = "DITHERED"
        except (AttributeError, TypeError):
            pass
    return material


def assign_material(obj, material):
    obj.data.materials.append(material)
    return obj


def shade_smooth(obj):
    if not hasattr(obj.data, "polygons"):
        return obj
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def add_bevel(obj, width, segments=3):
    modifier = obj.modifiers.new(name="precision_bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    return obj


def add_box(name, location, dimensions, material, collection, bevel=0.06, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, material)
    if bevel:
        add_bevel(obj, bevel, 3)
    return move_to_collection(obj, collection)


def add_sphere(name, location, scale, material, collection, segments=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, material)
    shade_smooth(obj)
    return move_to_collection(obj, collection)


def add_cylinder_between(name, start, end, radius, material, collection, vertices=16):
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    midpoint = (start_vector + end_vector) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=direction.length,
        location=midpoint,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    assign_material(obj, material)
    shade_smooth(obj)
    return move_to_collection(obj, collection)


def add_curve(name, points, bevel_depth, material, collection, cyclic=False):
    curve = bpy.data.curves.new(name=f"{name}_curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def create_prism(name, lower_outline, lower_z, upper_outline, upper_z, material, collection, bevel=0.04):
    if len(lower_outline) != len(upper_outline):
        raise ValueError("Prism outlines must contain the same number of points")
    count = len(lower_outline)
    vertices = [(x, y, lower_z) for x, y in lower_outline] + [(x, y, upper_z) for x, y in upper_outline]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, next_index + count, index + count))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    assign_material(obj, material)
    if bevel:
        add_bevel(obj, bevel, 3)
    shade_smooth(obj)
    return obj


def create_hull(materials, collection):
    section_count = 52
    loop_size = 9
    vertices = []
    loops = []

    for index in range(section_count + 1):
        t = index / section_count
        y = 18.0 - t * 38.0
        beam_curve = math.sin(math.pi * (0.04 + t * 0.94)) ** 0.42
        stern_factor = 0.78 + min(1.0, t * 4.5) * 0.22
        bow_factor = 1.0
        if t > 0.76:
            bow_factor = max(0.08, 1.0 - ((t - 0.76) / 0.24) ** 1.35)
        half_beam = 3.75 * beam_curve * stern_factor * bow_factor
        half_beam = max(0.12, half_beam)
        bow_rise = max(0.0, (t - 0.68) / 0.32) ** 1.8
        stern_rise = max(0.0, (0.1 - t) / 0.1)
        sheer = 1.35 + bow_rise * 1.25 + stern_rise * 0.28
        keel = -2.75 + bow_rise * 1.85 + stern_rise * 0.45
        chine = -0.95 + bow_rise * 0.85

        loop = [
            (0.0, y, keel),
            (half_beam * 0.48, y, chine - 0.62),
            (half_beam * 0.82, y, chine),
            (half_beam, y, 0.18 + bow_rise * 0.42),
            (half_beam * 0.92, y, sheer),
            (-half_beam * 0.92, y, sheer),
            (-half_beam, y, 0.18 + bow_rise * 0.42),
            (-half_beam * 0.82, y, chine),
            (-half_beam * 0.48, y, chine - 0.62),
        ]
        indices = []
        for vertex in loop:
            indices.append(len(vertices))
            vertices.append(vertex)
        loops.append(indices)

    faces = []
    for index in range(section_count):
        current_loop = loops[index]
        next_loop = loops[index + 1]
        for side in range(loop_size):
            following = (side + 1) % loop_size
            faces.append((current_loop[side], current_loop[following], next_loop[following], next_loop[side]))
    faces.append(tuple(reversed(loops[0])))
    faces.append(tuple(loops[-1]))

    mesh = bpy.data.meshes.new("aurora_deep_v_hull_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    hull = bpy.data.objects.new("aurora_deep_v_hull", mesh)
    collection.objects.link(hull)
    hull.data.materials.append(materials["navy"])
    hull.data.materials.append(materials["white"])
    for polygon in hull.data.polygons:
        average_z = sum(hull.data.vertices[index].co.z for index in polygon.vertices) / len(polygon.vertices)
        polygon.material_index = 1 if average_z > 0.35 else 0
    add_bevel(hull, 0.06, 3)
    shade_smooth(hull)

    for side in (-1, 1):
        points = []
        for index in range(28):
            t = index / 27
            y = 15.5 - t * 32.5
            bow_factor = 1.0 if t < 0.8 else max(0.12, 1 - ((t - 0.8) / 0.2) ** 1.3)
            x = side * 3.7 * (math.sin(math.pi * (0.06 + t * 0.91)) ** 0.42) * bow_factor
            z = 0.42 + max(0, (t - 0.68) / 0.32) ** 1.7 * 0.7
            points.append((x, y, z))
        add_curve(f"{'port' if side < 0 else 'starboard'}_waterline_stripe", points, 0.075, materials["silver"], collection)

    return hull


def create_yacht(materials, collection):
    root = bpy.data.objects.new("aurora_explorer_yacht", None)
    collection.objects.link(root)
    create_hull(materials, collection)

    main_deck = [(-3.35, 15.2), (3.35, 15.2), (3.55, -10.2), (2.5, -17.2), (-2.5, -17.2), (-3.55, -10.2)]
    upper_deck = [(-3.16, 14.5), (3.16, 14.5), (3.32, -9.8), (2.3, -16.3), (-2.3, -16.3), (-3.32, -9.8)]
    create_prism("sculpted_main_deck", main_deck, 1.28, upper_deck, 1.52, materials["teak"], collection, 0.09)

    aft_platform_lower = [(-3.45, 19.0), (3.45, 19.0), (3.45, 15.0), (-3.45, 15.0)]
    aft_platform_upper = [(-3.25, 19.2), (3.25, 19.2), (3.32, 15.1), (-3.32, 15.1)]
    create_prism("hydraulic_swim_platform", aft_platform_lower, 0.78, aft_platform_upper, 1.06, materials["teak"], collection, 0.12)

    main_lower = [(-3.0, 8.3), (3.0, 8.3), (3.15, -8.0), (2.2, -11.2), (-2.2, -11.2), (-3.15, -8.0)]
    main_upper = [(-2.72, 8.0), (2.72, 8.0), (2.86, -7.7), (1.85, -10.6), (-1.85, -10.6), (-2.86, -7.7)]
    create_prism("tapered_main_superstructure", main_lower, 1.5, main_upper, 3.68, materials["white"], collection, 0.18)

    bridge_lower = [(-2.45, 3.4), (2.45, 3.4), (2.55, -6.9), (1.7, -9.0), (-1.7, -9.0), (-2.55, -6.9)]
    bridge_upper = [(-2.12, 3.1), (2.12, 3.1), (2.2, -6.55), (1.45, -8.45), (-1.45, -8.45), (-2.2, -6.55)]
    create_prism("panoramic_pilothouse", bridge_lower, 3.62, bridge_upper, 5.35, materials["white"], collection, 0.2)

    roof_lower = [(-2.7, 3.9), (2.7, 3.9), (2.72, -7.25), (1.72, -9.15), (-1.72, -9.15), (-2.72, -7.25)]
    roof_upper = [(-2.58, 4.0), (2.58, 4.0), (2.6, -7.2), (1.65, -9.0), (-1.65, -9.0), (-2.6, -7.2)]
    create_prism("floating_bridge_roof", roof_lower, 5.32, roof_upper, 5.58, materials["white"], collection, 0.1)

    # Wraparound glazing is faceted to follow the tapered bridge instead of reading as a box.
    add_box("bridge_front_glass", (0, -8.63, 4.55), (2.88, 0.09, 1.02), materials["glass"], collection, 0.035)
    for side in (-1, 1):
        side_name = "port" if side < 0 else "starboard"
        for index, y in enumerate((-6.7, -4.65, -2.6, -0.55, 1.5)):
            add_box(
                f"{side_name}_bridge_glass_{index}",
                (side * (2.26 - index * 0.018), y, 4.54),
                (0.08, 1.72, 0.95),
                materials["glass"],
                collection,
                0.035,
                rotation=(0, 0, side * math.radians(0.7)),
            )
        for index, y in enumerate((-7.5, -4.85, -2.2, 0.45, 3.1, 5.65)):
            add_box(
                f"{side_name}_salon_window_{index}",
                (side * 2.91, y, 2.62),
                (0.07, 2.1, 0.78),
                materials["dark_glass"],
                collection,
                0.03,
            )

    add_box("foredeck_sun_lounge", (0, -13.25, 1.94), (3.4, 4.1, 0.28), materials["sand"], collection, 0.18)
    add_box("aft_deck_dining_table", (0, 10.0, 1.95), (1.9, 3.6, 0.18), materials["teak_dark"], collection, 0.12)
    for x in (-1.25, 1.25):
        for y in (8.9, 11.0):
            add_box(f"aft_lounge_chair_{x}_{y}", (x, y, 1.94), (0.82, 0.88, 0.26), materials["sand"], collection, 0.16)

    # Teak planks give close cameras useful scale and specular breakup.
    for index in range(13):
        x = -2.72 + index * 0.455
        add_box(f"teak_plank_inlay_{index}", (x, 11.9, 1.545), (0.035, 5.4, 0.018), materials["teak_dark"], collection, 0.006)

    # Railings follow the deck sheer and are built from curve tubes plus individual stanchions.
    for side in (-1, 1):
        side_name = "port" if side < 0 else "starboard"
        x = side * 3.22
        rail_points = [
            (side * 2.45, -16.0, 2.55),
            (side * 3.2, -10.0, 2.3),
            (x, 4.0, 2.22),
            (side * 3.05, 14.2, 2.15),
        ]
        add_curve(f"{side_name}_continuous_safety_rail", rail_points, 0.035, materials["chrome"], collection)
        for index, y in enumerate((-14.5, -11.0, -7.0, -3.0, 1.0, 5.0, 9.0, 13.0)):
            bow_taper = 1.0 if y > -10 else max(0.72, 1 - (-10 - y) * 0.055)
            post_x = x * bow_taper
            base_z = 1.56 + max(0, (-y - 10) * 0.04)
            add_cylinder_between(
                f"{side_name}_stanchion_{index}",
                (post_x, y, base_z),
                (post_x, y, base_z + 0.7),
                0.027,
                materials["chrome"],
                collection,
                12,
            )

    add_cylinder_between("radar_mast", (0, -1.4, 5.56), (0, -1.4, 7.65), 0.075, materials["chrome"], collection, 18)
    add_box("open_array_radar", (0, -1.4, 7.34), (3.3, 0.13, 0.12), materials["white"], collection, 0.055)
    add_sphere("satellite_dome_port", (-0.95, 0.2, 6.28), (0.56, 0.56, 0.42), materials["white"], collection)
    add_sphere("satellite_dome_starboard", (0.95, 0.2, 6.28), (0.56, 0.56, 0.42), materials["white"], collection)
    add_cylinder_between("vhf_antenna_port", (-0.72, -1.15, 6.0), (-1.2, -1.45, 8.35), 0.018, materials["chrome"], collection, 10)
    add_cylinder_between("vhf_antenna_starboard", (0.72, -1.15, 6.0), (1.2, -1.45, 8.35), 0.018, materials["chrome"], collection, 10)

    # Compact RIB tender with a shaped hull and stainless launch crane.
    tender_lower = [(-1.25, 12.9), (1.25, 12.9), (1.02, 8.9), (0, 8.2), (-1.02, 8.9)]
    tender_upper = [(-1.08, 12.7), (1.08, 12.7), (0.9, 9.1), (0, 8.55), (-0.9, 9.1)]
    create_prism("expedition_rib_tender", tender_lower, 2.08, tender_upper, 2.62, materials["charcoal"], collection, 0.1)
    add_box("tender_console", (0, 10.25, 2.9), (0.72, 0.8, 0.62), materials["white"], collection, 0.1)
    add_curve("tender_launch_crane", [(2.4, 12.8, 1.8), (2.75, 12.7, 4.25), (1.3, 11.0, 4.45)], 0.085, materials["chrome"], collection)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.34,
            minor_radius=0.055,
            major_segments=24,
            minor_segments=8,
            location=(side * 3.18, 7.1, 2.25),
            rotation=(0, math.radians(90), 0),
        )
        lifebuoy = bpy.context.object
        lifebuoy.name = f"{'port' if side < 0 else 'starboard'}_lifebuoy"
        assign_material(lifebuoy, materials["orange"])
        move_to_collection(lifebuoy, collection)

    add_sphere("red_navigation_light", (-2.72, -7.0, 5.62), (0.1, 0.1, 0.1), materials["red_light"], collection, 16, 8)
    add_sphere("green_navigation_light", (2.72, -7.0, 5.62), (0.1, 0.1, 0.1), materials["green_light"], collection, 16, 8)

    create_captain(materials, collection)

    for obj in collection.objects:
        if obj != root and obj.parent is None:
            obj.parent = root
    return root


def create_captain(materials, collection):
    root = bpy.data.objects.new("captain_mara", None)
    collection.objects.link(root)
    parts = []
    parts.append(add_sphere("captain_head", (0.82, -5.8, 6.24), (0.2, 0.2, 0.24), materials["skin"], collection, 20, 10))
    parts.append(add_sphere("captain_hair", (0.82, -5.77, 6.39), (0.22, 0.22, 0.12), materials["hair"], collection, 20, 8))
    parts.append(add_box("captain_jacket", (0.82, -5.8, 5.84), (0.45, 0.28, 0.62), materials["orange"], collection, 0.08))
    parts.append(add_box("captain_vest", (0.82, -5.96, 5.87), (0.36, 0.06, 0.42), materials["navy_fabric"], collection, 0.03))
    parts.append(add_cylinder_between("captain_left_leg", (0.68, -5.8, 5.56), (0.65, -5.8, 5.24), 0.07, materials["charcoal"], collection, 12))
    parts.append(add_cylinder_between("captain_right_leg", (0.96, -5.8, 5.56), (0.99, -5.8, 5.24), 0.07, materials["charcoal"], collection, 12))
    parts.append(add_cylinder_between("captain_left_arm", (0.58, -5.82, 5.98), (0.32, -6.08, 5.72), 0.055, materials["orange"], collection, 12))
    parts.append(add_cylinder_between("captain_right_arm", (1.06, -5.82, 5.98), (1.28, -6.1, 5.74), 0.055, materials["orange"], collection, 12))
    parts.append(add_box("captain_binoculars", (0.82, -6.13, 6.13), (0.46, 0.16, 0.14), materials["charcoal"], collection, 0.035))
    for part in parts:
        part.parent = root


def create_diver(materials, collection):
    root = bpy.data.objects.new("explorer_diver", None)
    collection.objects.link(root)
    parts = []
    parts.append(add_sphere("diver_head", (0, -1.18, 0.08), (0.25, 0.31, 0.24), materials["hood"], collection, 24, 12))
    parts.append(add_box("diver_mask", (0, -1.43, 0.1), (0.4, 0.12, 0.22), materials["mask_glass"], collection, 0.07))
    parts.append(add_box("diver_torso", (0, -0.45, 0.0), (0.62, 1.16, 0.38), materials["wetsuit"], collection, 0.16))
    parts.append(add_box("diver_bcd", (0, -0.42, 0.22), (0.68, 0.9, 0.22), materials["navy_fabric"], collection, 0.12))
    tank = add_cylinder_between("diver_air_tank", (0, -0.87, 0.36), (0, 0.22, 0.36), 0.18, materials["tank"], collection, 20)
    parts.append(tank)
    for side in (-1, 1):
        side_name = "left" if side < 0 else "right"
        parts.append(add_cylinder_between(f"diver_{side_name}_arm", (side * 0.32, -0.78, 0.02), (side * 0.58, -1.4, -0.02), 0.085, materials["wetsuit"], collection, 14))
        parts.append(add_sphere(f"diver_{side_name}_glove", (side * 0.6, -1.48, -0.02), (0.1, 0.14, 0.08), materials["orange"], collection, 16, 8))
        parts.append(add_cylinder_between(f"diver_{side_name}_leg", (side * 0.19, 0.03, 0), (side * 0.24, 1.03, 0), 0.11, materials["wetsuit"], collection, 14))
        fin = create_prism(
            f"diver_{side_name}_fin",
            [(side * 0.35 - 0.1, 1.0), (side * 0.35 + 0.1, 1.0), (side * 0.52 + 0.18, 1.82), (side * 0.52 - 0.18, 1.82)],
            -0.08,
            [(side * 0.35 - 0.1, 1.0), (side * 0.35 + 0.1, 1.0), (side * 0.52 + 0.18, 1.82), (side * 0.52 - 0.18, 1.82)],
            0.04,
            materials["orange"],
            collection,
            0.03,
        )
        parts.append(fin)
    parts.append(add_curve("diver_regulator_hose", [(0.15, -0.72, 0.36), (0.42, -1.05, 0.2), (0.18, -1.38, 0.08)], 0.025, materials["charcoal"], collection))
    for part in parts:
        part.parent = root
    return root


def export_collection(collection, filepath):
    bpy.ops.object.select_all(action="DESELECT")
    export_objects = list(collection.all_objects)
    for obj in export_objects:
        obj.select_set(True)
    active = next((obj for obj in export_objects if obj.type == "MESH"), export_objects[0])
    bpy.context.view_layer.objects.active = active
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )


def point_camera(camera, target):
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def create_preview(materials, yacht_collection, diver_collection):
    for obj in diver_collection.all_objects:
        obj.hide_render = True

    preview_collection = make_collection("Preview Studio")
    bpy.ops.mesh.primitive_plane_add(size=140, location=(0, 0, 0.25))
    water_plane = bpy.context.object
    water_plane.name = "preview_ocean_surface"
    assign_material(water_plane, materials["preview_water"])
    move_to_collection(water_plane, preview_collection)

    bpy.ops.object.light_add(type="AREA", location=(12, 4, 20))
    key = bpy.context.object
    key.name = "preview_key"
    key.data.energy = 1800
    key.data.shape = "DISK"
    key.data.size = 11
    move_to_collection(key, preview_collection)
    point_camera(key, (0, 0, 2))

    bpy.ops.object.light_add(type="AREA", location=(-13, 15, 10))
    fill = bpy.context.object
    fill.name = "preview_fill"
    fill.data.energy = 950
    fill.data.color = (0.42, 0.68, 1.0)
    fill.data.size = 9
    move_to_collection(fill, preview_collection)
    point_camera(fill, (0, 0, 2))

    bpy.ops.object.light_add(type="SUN", location=(0, 0, 18))
    sun = bpy.context.object
    sun.name = "preview_sun"
    sun.rotation_euler = (math.radians(28), math.radians(-18), math.radians(145))
    sun.data.energy = 2.1
    sun.data.angle = math.radians(4)
    move_to_collection(sun, preview_collection)

    bpy.ops.object.camera_add(location=(36, 50, 22))
    camera = bpy.context.object
    camera.name = "aurora_preview_camera"
    camera.data.lens = 56
    point_camera(camera, (0, -1.0, 2.4))
    move_to_collection(camera, preview_collection)
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(OUTPUT_DIR / "aurora_yacht_preview.png")
    scene.render.film_transparent = False
    scene.world.color = (0.035, 0.075, 0.12)
    scene.view_settings.look = "AgX - Medium High Contrast"
    bpy.ops.render.render(write_still=True)


def main():
    clear_scene()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.length_unit = "METERS"

    materials = {
        "navy": make_material("Aurora midnight blue hull", (0.008, 0.045, 0.085), 0.08, 0.2),
        "white": make_material("Pearl ceramic gelcoat", (0.93, 0.955, 0.95), 0.04, 0.19),
        "teak": make_material("Quarter sawn teak", (0.58, 0.32, 0.13), 0.0, 0.48),
        "teak_dark": make_material("Teak caulking", (0.17, 0.08, 0.035), 0.0, 0.64),
        "sand": make_material("Champagne marine upholstery", (0.83, 0.73, 0.57), 0.0, 0.57),
        "glass": make_material("Panoramic ocean glass", (0.035, 0.16, 0.22), 0.18, 0.08, 0.72),
        "dark_glass": make_material("Smoked salon glass", (0.012, 0.055, 0.075), 0.12, 0.1, 0.82),
        "mask_glass": make_material("Diver mask glass", (0.07, 0.33, 0.42), 0.08, 0.05, 0.68),
        "chrome": make_material("Marine stainless steel", (0.68, 0.72, 0.75), 0.95, 0.14),
        "silver": make_material("Brushed waterline silver", (0.5, 0.55, 0.58), 0.82, 0.2),
        "charcoal": make_material("Technical charcoal", (0.018, 0.022, 0.026), 0.0, 0.4),
        "orange": make_material("Expedition signal orange", (0.95, 0.18, 0.035), 0.0, 0.34),
        "red_light": make_material("Port navigation light", (0.65, 0.01, 0.01), 0.0, 0.15, emission=(1.0, 0.01, 0.01)),
        "green_light": make_material("Starboard navigation light", (0.01, 0.55, 0.1), 0.0, 0.15, emission=(0.01, 1.0, 0.18)),
        "skin": make_material("Captain skin", (0.46, 0.24, 0.14), 0.0, 0.52),
        "hair": make_material("Captain dark hair", (0.025, 0.012, 0.008), 0.0, 0.7),
        "navy_fabric": make_material("Navy expedition fabric", (0.025, 0.09, 0.14), 0.0, 0.62),
        "hood": make_material("Graphite neoprene hood", (0.015, 0.018, 0.022), 0.0, 0.72),
        "wetsuit": make_material("Graphite neoprene suit", (0.022, 0.034, 0.045), 0.0, 0.62),
        "tank": make_material("Brushed dive cylinder", (0.58, 0.62, 0.64), 0.72, 0.28),
        "preview_water": make_material("Preview ocean", (0.012, 0.16, 0.23), 0.25, 0.12, 0.88),
    }

    yacht_collection = make_collection("Aurora Yacht")
    diver_collection = make_collection("Explorer Diver")
    create_yacht(materials, yacht_collection)
    create_diver(materials, diver_collection)

    blend_path = BLEND_DIR / "aurora_explorer_yacht.blend"
    yacht_path = MODEL_DIR / "aurora_explorer_yacht.glb"
    diver_path = MODEL_DIR / "explorer_diver.glb"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    export_collection(yacht_collection, yacht_path)
    export_collection(diver_collection, diver_path)
    create_preview(materials, yacht_collection, diver_collection)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    print(f"Saved Blender source: {blend_path}")
    print(f"Exported yacht: {yacht_path}")
    print(f"Exported diver: {diver_path}")
    print(f"Rendered preview: {OUTPUT_DIR / 'aurora_yacht_preview.png'}")


if __name__ == "__main__":
    main()
