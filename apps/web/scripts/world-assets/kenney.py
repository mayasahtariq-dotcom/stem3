"""Kenney (CC0) GLB -> self-contained GLB with origin at base centre. python kenney.py KENNEY_3D OUT"""
import sys, os, bpy, mathutils
K, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
A = {}
for n in ["cliff_waterfall_rock", "cliff_waterfallTop_rock", "cliff_large_rock", "cliff_block_rock", "cliff_top_rock", "cliff_cornerLarge_rock", "bridge_wood", "bridge_woodRound",
          "lily_large", "lily_small", "log", "log_stack", "log_large", "stump_round", "stump_oldTall", "tent_detailedOpen", "campfire_stones", "statue_obelisk", "statue_column",
          "pot_large", "pot_small", "sign", "mushroom_redGroup", "mushroom_tanGroup", "fence_simple", "fence_gate", "fence_planks", "rock_tallA", "rock_tallC", "rock_largeA", "rock_largeC",
          "tree_oak_fall", "tree_default_fall", "tree_detailed_fall", "tree_pineTallA_detailed", "tree_pineTallC_detailed", "tree_oak", "tree_detailed", "hanging_moss", "canoe",
          "plant_bushDetailed", "plant_bushLarge", "flower_purpleA", "flower_redA", "flower_yellowA", "flower_purpleC", "flower_redC", "flower_yellowC", "crops_dirtRow",
          "crops_cornStageD", "crops_wheatStageB", "crop_pumpkin", "crop_melon"]:
  A["k-" + n.replace("_", "-").lower()] = f"nature/{n}.glb"
for n in ["fountain-round-detail", "fountain-round", "lantern", "fence-gate", "hedge", "hedge-gate", "hedge-large", "stall-red", "stall-green", "cart", "banner-red", "banner-green", "pillar-stone", "stall-bench"]:
  A["k-" + n] = f"fantasy-town/{n}.glb"
for n in ["bench", "lantern", "rocks-large"]:
  A["k-h-" + n] = f"holiday/{n}.glb"
for n in ["signpost", "tent", "chest", "workbench", "barrel", "tree-autumn", "tree-autumn-tall", "fence-doorway"]:
  A["k-s-" + n] = f"survival/{n}.glb"
A["k-hay-bale"] = "graveyard/hay-bale.glb"; A["k-hay-bale-bundled"] = "graveyard/hay-bale-bundled.glb"
for name, rel in A.items():
  src = os.path.join(K, rel)
  if not os.path.exists(src): print("MISSING", name); continue
  bpy.ops.wm.read_factory_settings(use_empty=True)
  bpy.ops.import_scene.gltf(filepath=src)
  meshes = [o for o in bpy.data.objects if o.type == "MESH"]
  pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
  mn = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
  mx = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
  off = mathutils.Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
  for o in bpy.data.objects:
    if o.parent is None: o.location -= off
  dst = os.path.join(OUT, name + ".glb")
  bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_yup=True, export_animations=False, export_image_format="AUTO")
  print("OK", name, os.path.getsize(dst), "size=%.2fx%.2fx%.2f" % tuple(mx - mn))
