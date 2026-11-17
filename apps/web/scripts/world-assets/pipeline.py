"""Quaternius (CC0) USDA -> web GLB. Run with bpy:  python pipeline.py SRC_ROOT OUT_DIR
Fixes leaf materials (mask textures become light alpha-cutout cards with a green tint),
puts the origin at the base centre, downsizes textures to 512 px WEBP."""
import sys, os, bpy, mathutils
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
TEX_CACHE = os.path.join(OUT, "_tex"); os.makedirs(TEX_CACHE, exist_ok=True)

ASSETS = {
  # name: (relative usda path)
  "barn": "FarmBuildings/S_Barn.usda", "barn-big": "FarmBuildings/S_BigBarn.usda", "barn-small": "FarmBuildings/S_SmallBarn.usda",
  "barn-open": "FarmBuildings/S_OpenBarn.usda", "chicken-coop": "FarmBuildings/S_ChickenCoop.usda", "silo": "FarmBuildings/S_Silo.usda",
  "silo-house": "FarmBuildings/S_SiloHouse.usda", "windmill": "FarmBuildings/S_Windmill.usda", "windmill-tower": "FarmBuildings/S_TowerWindmill.usda",
  "water-tower": "FarmBuildings/S_WaterTower.usda", "well": "FarmBuildings/S_Well.usda", "fence": "FarmBuildings/S_Fence.usda", "fence-2": "FarmBuildings/S_Fence2.usda",
  "house-1": "Buildings/S_House1.usda", "house-2": "Buildings/S_House2.usda",
  "cottage-1": "SimpleBuildings/S_House.usda", "cottage-2": "SimpleBuildings/S_House2.usda", "cottage-3": "SimpleBuildings/S_House3.usda",
  "cottage-4": "SimpleBuildings/S_House4.usda", "cottage-5": "SimpleBuildings/S_House5.usda", "shop": "SimpleBuildings/S_Shop.usda",
  "cow": "FarmAnimal/SK_Cow.usda", "cow-brown": "UltimateAnimatedAnimals/SK_Cow.usda", "horse-farm": "FarmAnimal/SK_Horse.usda", "bull": "UltimateAnimatedAnimals/SK_Bull.usda", "horse": "UltimateAnimatedAnimals/SK_Horse.usda",
  "horse-white": "UltimateAnimatedAnimals/SK_HorseWhite.usda", "donkey": "UltimateAnimatedAnimals/SK_Donkey.usda", "alpaca": "UltimateAnimatedAnimals/SK_Alpaca.usda",
  "deer": "UltimateAnimatedAnimals/SK_Deer.usda", "fox": "UltimateAnimatedAnimals/SK_Fox.usda", "stag": "UltimateAnimatedAnimals/SK_Stag.usda",
  "dog": "UltimateAnimatedAnimals/SK_ShibaInu.usda", "pig": "FarmAnimal/SK_Pig.usda", "sheep": "FarmAnimal/SK_Sheep.usda", "llama": "FarmAnimal/SK_Llama.usda",
  "bench": "FantasyPropsMegaKit/S_Bench.usda", "barrel": "FantasyPropsMegaKit/S_Barrel.usda", "barrel-apples": "FantasyPropsMegaKit/S_BarrelApples.usda",
  "crate": "FantasyPropsMegaKit/S_CrateWooden.usda", "crate-apple": "FantasyPropsMegaKit/S_FarmCrateApple.usda", "crate-carrot": "FantasyPropsMegaKit/S_FarmCrateCarrot.usda",
  "stall": "FantasyPropsMegaKit/S_StallEmpty.usda", "cart": "FantasyPropsMegaKit/S_StallCartEmpty.usda", "bucket": "FantasyPropsMegaKit/S_BucketWooden_1.usda",
  "table": "FantasyPropsMegaKit/S_TableLarge.usda", "stool": "FantasyPropsMegaKit/S_Stool.usda", "lantern": "FantasyPropsMegaKit/S_LanternWall.usda",
  "banner": "FantasyPropsMegaKit/S_Banner_1.usda", "workbench": "FantasyPropsMegaKit/S_Workbench.usda", "torch": "FantasyPropsMegaKit/S_TorchMetal.usda",
}
for i in range(1, 6):
  ASSETS[f"tree-{i}"] = f"StylizedNatureMegaKit/S_CommonTree_{i}.usda"
  ASSETS[f"pine-{i}"] = f"StylizedNatureMegaKit/S_Pine_{i}.usda"
  ASSETS[f"twisted-{i}"] = f"StylizedNatureMegaKit/S_TwistedTree_{i}.usda"
  ASSETS[f"pebble-{i}"] = f"StylizedNatureMegaKit/S_PebbleRound_{i}.usda"
for i in range(1, 4):
  ASSETS[f"rock-{i}"] = f"StylizedNatureMegaKit/S_RockMedium_{i}.usda"
  ASSETS[f"path-stone-{i}"] = f"StylizedNatureMegaKit/S_RockPathRoundSmall_{i}.usda"
for n, p in {"bush": "S_BushCommon", "bush-flowers": "S_BushCommonFlowers", "fern": "S_Fern_1", "flowers-a": "S_Flower3Group", "flowers-b": "S_Flower4Group",
             "flower-a": "S_Flower3Single", "flower-b": "S_Flower4Single", "grass-short": "S_GrassCommonShort", "grass-tall": "S_GrassCommonTall",
             "grass-wispy": "S_GrassWispyTall", "mushroom": "S_MushroomCommon", "clover": "S_Clover_1", "plant-big": "S_Plant1Big", "plant-7": "S_Plant7Big",
             "dead-tree": "S_DeadTree_1"}.items():
  ASSETS[n] = f"StylizedNatureMegaKit/{p}.usda"
for crop in ["Wheat", "Corn", "Carrot", "Pumpkin", "Lettuce", "Tomato", "Watermelon", "Beet", "BushBerries", "Apple", "Orange", "Flowers", "Rice", "Mushroom"]:
  for s in range(1, 5):
    ASSETS[f"crop-{crop.lower()}-{s}"] = f"UltimateCrops/S_{crop}_{s}.usda"
  if crop not in ("Rice", "Carrot", "Beet", "Wheat"):
    pass

only = set(os.environ.get("ONLY", "").split(",")) - {""}

def light_mask(path):
  """Leaf-cluster mask texture -> light grey with alpha, so the material colour tints it."""
  dst = os.path.join(TEX_CACHE, "light_" + os.path.basename(path))
  if not os.path.exists(dst):
    im = Image.open(path).convert("RGBA")
    r, g, b, a = im.split()
    mx = max(1, max(g.getextrema()[1], r.getextrema()[1]))
    v = g.point(lambda x: int(150 + 105 * x / mx))
    Image.merge("RGBA", (v, v, v, a)).resize((512, 512)).save(dst)
  return dst

LEAF_TINT = {"Leaves_NormalTree": (0.22, 0.50, 0.12), "Leaves_TwistedTree": (0.30, 0.52, 0.12), "Leaves_Pine": (0.12, 0.34, 0.14)}

for name, rel in ASSETS.items():
  if only and name not in only:
    continue
  src = os.path.join(SRC, rel)
  if not os.path.exists(src):
    print("MISSING", name, rel); continue
  bpy.ops.wm.read_factory_settings(use_empty=True)
  bpy.ops.wm.usd_import(filepath=src)
  for o in list(bpy.data.objects):
    if o.type in {"CAMERA", "LIGHT"}:
      bpy.data.objects.remove(o)
  # materials: fix leaf masks, downsize textures
  for m in bpy.data.materials:
    if not m.use_nodes:
      continue
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    imgs = [n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image]
    is_mask = any(("C_" in os.path.basename(n.image.filepath) or "LeafPine" in n.image.filepath) for n in imgs)
    if bsdf and is_mask:
      tex = imgs[0]
      tex.image = bpy.data.images.load(light_mask(bpy.path.abspath(tex.image.filepath)))
      for l in list(nt.links):
        if l.to_node == bsdf and l.to_socket.name in ("Base Color", "Alpha"):
          nt.links.remove(l)
      nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
      nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
      # extra image nodes (opacity duplicates) removed
      for n in imgs[1:]:
        nt.nodes.remove(n)
      m.blend_method = "CLIP" if hasattr(m, "blend_method") else None
      tint = next((v for k, v in LEAF_TINT.items() if k.lower() in m.name.lower()), (0.38, 0.63, 0.22))
      # glTF exporter reads a Mix/Multiply? Keep it simple: store tint as custom prop, three.js applies it
      m["leafTint"] = list(tint)
      m.name = "LEAF_" + m.name
    for n in [n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image]:
      im = n.image
      if im and max(im.size) > 512:
        im.scale(512, 512)
  # origin: base centre
  meshes = [o for o in bpy.data.objects if o.type == "MESH"]
  pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
  if not pts:
    print("EMPTY", name); continue
  mn = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
  mx = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
  off = mathutils.Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
  for o in bpy.data.objects:
    if o.parent is None:
      o.location -= off
  dst = os.path.join(OUT, name + ".glb")
  bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_yup=True, export_apply=False, export_animations=False,
                            export_skins=True, export_image_format="WEBP", export_image_quality=80, export_extras=True,
                            export_draco_mesh_compression_enable=False)
  print("OK", name, os.path.getsize(dst), "size=%.2fx%.2fx%.2f" % tuple(mx - mn))
