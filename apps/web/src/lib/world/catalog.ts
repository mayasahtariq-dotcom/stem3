/**
 * Farm Store catalogue (pure data). Prices are in gems, the spendable
 * currency students earn (5 per lesson, 20 per quest, 50 per badge). XP is
 * never spent. The real server owns prices; these are the fake backend's.
 * `model` names a 3D model in src/three/worlds/models.ts; `radius` is the
 * footprint used for overlap checks.
 */
export const STORE_CATEGORIES = ["decorations", "buildings", "nature", "animals", "customisation"] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export interface CatalogItem {
  id: string;
  category: StoreCategory;
  name: { en: string; hi: string; kn: string };
  description: { en: string; hi: string; kn: string };
  price: number;
  model: string;
  /** Footprint radius (m). */
  radius: number;
}

const t = (en: string, hi: string, kn: string) => ({ en, hi, kn });

export const CATALOG: CatalogItem[] = [
  // Decorations
  { id: "flower-cart", category: "decorations", name: t("Flower cart", "फूलों की गाड़ी", "ಹೂವಿನ ಗಾಡಿ"), description: t("A wooden cart filled with flowers.", "फूलों से भरी लकड़ी की गाड़ी।", "ಹೂವುಗಳಿಂದ ತುಂಬಿದ ಮರದ ಗಾಡಿ."), price: 50, model: "flower-cart", radius: 1.6 },
  { id: "garden-bench", category: "decorations", name: t("Garden bench", "बगीचे की बेंच", "ತೋಟದ ಬೆಂಚು"), description: t("A comfy bench to rest on.", "आराम करने के लिए बेंच।", "ವಿಶ್ರಾಂತಿಗೆ ಒಂದು ಬೆಂಚು."), price: 30, model: "garden-bench", radius: 1.2 },
  { id: "fountain", category: "decorations", name: t("Fountain", "फव्वारा", "ಕಾರಂಜಿ"), description: t("A stone fountain with splashing water.", "छलकते पानी वाला पत्थर का फव्वारा।", "ಚಿಮ್ಮುವ ನೀರಿನ ಕಲ್ಲಿನ ಕಾರಂಜಿ."), price: 70, model: "fountain", radius: 2.2 },
  { id: "lamp-post", category: "decorations", name: t("Lamp post", "लैंप पोस्ट", "ದೀಪದ ಕಂಬ"), description: t("Lights up the path at dusk.", "शाम को रास्ता रोशन करता है।", "ಸಂಜೆ ದಾರಿಗೆ ಬೆಳಕು."), price: 20, model: "lamp-post", radius: 0.5 },
  { id: "flower-arch", category: "decorations", name: t("Flower arch", "फूलों का मेहराब", "ಹೂವಿನ ಕಮಾನು"), description: t("An arch covered in roses.", "गुलाबों से ढका मेहराब।", "ಗುಲಾಬಿಗಳಿಂದ ಮುಚ್ಚಿದ ಕಮಾನು."), price: 40, model: "flower-arch", radius: 1.4 },
  { id: "birdhouse", category: "decorations", name: t("Birdhouse", "चिड़िया घर", "ಹಕ್ಕಿ ಗೂಡು"), description: t("A little home for garden birds.", "बगीचे की चिड़ियों का छोटा घर।", "ತೋಟದ ಹಕ್ಕಿಗಳಿಗೆ ಪುಟ್ಟ ಮನೆ."), price: 25, model: "birdhouse", radius: 0.6 },
  { id: "flower-pot", category: "decorations", name: t("Flower pot", "गमला", "ಹೂಕುಂಡ"), description: t("A clay pot of bright flowers.", "चमकीले फूलों वाला मिट्टी का गमला।", "ಬಣ್ಣದ ಹೂಗಳ ಮಣ್ಣಿನ ಕುಂಡ."), price: 15, model: "flower-pot", radius: 0.6 },
  { id: "well", category: "decorations", name: t("Wishing well", "कुआँ", "ಬಾವಿ"), description: t("A stone well with a little roof.", "छोटी छत वाला पत्थर का कुआँ।", "ಪುಟ್ಟ ಚಾವಣಿಯ ಕಲ್ಲಿನ ಬಾವಿ."), price: 45, model: "well", radius: 1.2 },
  { id: "statue", category: "decorations", name: t("Garden statue", "बगीचे की मूर्ति", "ತೋಟದ ಪ್ರತಿಮೆ"), description: t("A carved stone pillar.", "नक्काशीदार पत्थर का स्तंभ।", "ಕೆತ್ತಿದ ಕಲ್ಲಿನ ಕಂಬ."), price: 35, model: "statue", radius: 0.8 },
  // Buildings
  { id: "gazebo", category: "buildings", name: t("Gazebo", "गज़ेबो", "ಗೆಜೆಬೊ"), description: t("A shady wooden gazebo with a red roof.", "लाल छत वाला लकड़ी का गज़ेबो।", "ಕೆಂಪು ಚಾವಣಿಯ ಮರದ ಗೆಜೆಬೊ."), price: 120, model: "gazebo", radius: 2.6 },
  { id: "cottage", category: "buildings", name: t("Cottage", "कॉटेज", "ಕುಟೀರ"), description: t("A cosy two-storey farm cottage.", "दो मंज़िला आरामदायक कॉटेज।", "ಎರಡು ಅಂತಸ್ತಿನ ಸುಂದರ ಕುಟೀರ."), price: 200, model: "cottage", radius: 3.4 },
  { id: "small-barn", category: "buildings", name: t("Small barn", "छोटा खलिहान", "ಚಿಕ್ಕ ಕಣಜ"), description: t("A red barn for tools and hay.", "औज़ार और भूसे के लिए लाल खलिहान।", "ಉಪಕರಣ, ಹುಲ್ಲಿಗೆ ಕೆಂಪು ಕಣಜ."), price: 160, model: "small-barn", radius: 3.4 },
  { id: "chicken-coop", category: "buildings", name: t("Chicken coop", "मुर्गी घर", "ಕೋಳಿ ಗೂಡು"), description: t("A snug coop for hens.", "मुर्गियों के लिए आरामदायक घर।", "ಕೋಳಿಗಳಿಗೆ ಬೆಚ್ಚನೆಯ ಗೂಡು."), price: 90, model: "chicken-coop", radius: 1.8 },
  { id: "animal-shelter", category: "buildings", name: t("Animal shelter", "पशु आश्रय", "ಪ್ರಾಣಿ ಆಶ್ರಯ"), description: t("An open barn that keeps animals dry.", "जानवरों को सूखा रखने वाला खुला खलिहान।", "ಪ್ರಾಣಿಗಳಿಗೆ ತೆರೆದ ಕಣಜ."), price: 140, model: "animal-shelter", radius: 3.2 },
  { id: "silo", category: "buildings", name: t("Grain silo", "अनाज का साइलो", "ಧಾನ್ಯದ ಸೈಲೋ"), description: t("Stores the harvest.", "फसल रखता है।", "ಬೆಳೆ ಸಂಗ್ರಹಿಸುತ್ತದೆ."), price: 110, model: "silo", radius: 2 },
  { id: "windmill", category: "buildings", name: t("Windmill", "पवनचक्की", "ಗಾಳಿಯಂತ್ರ"), description: t("Its sails turn in the breeze.", "हवा में इसके पंख घूमते हैं।", "ಗಾಳಿಗೆ ರೆಕ್ಕೆ ತಿರುಗುತ್ತವೆ."), price: 180, model: "windmill", radius: 3 },
  { id: "greenhouse", category: "buildings", name: t("Greenhouse", "ग्रीनहाउस", "ಹಸಿರುಮನೆ"), description: t("A glass house for seedlings.", "पौधों के लिए काँच का घर।", "ಸಸಿಗಳಿಗೆ ಗಾಜಿನ ಮನೆ."), price: 130, model: "greenhouse", radius: 2.6 },
  // Nature
  { id: "oak-tree", category: "nature", name: t("Oak tree", "बरगद जैसा पेड़", "ಓಕ್ ಮರ"), description: t("A leafy shade tree.", "घनी छाया वाला पेड़।", "ದಟ್ಟ ನೆರಳಿನ ಮರ."), price: 25, model: "tree-1", radius: 1.6 },
  { id: "tall-tree", category: "nature", name: t("Tall tree", "ऊँचा पेड़", "ಎತ್ತರದ ಮರ"), description: t("A tall, slim tree.", "ऊँचा, पतला पेड़।", "ಎತ್ತರದ ತೆಳು ಮರ."), price: 25, model: "tree-3", radius: 1.4 },
  { id: "pine-tree", category: "nature", name: t("Pine tree", "चीड़ का पेड़", "ಪೈನ್ ಮರ"), description: t("An evergreen pine.", "सदाबहार चीड़।", "ನಿತ್ಯಹರಿದ್ವರ್ಣ ಪೈನ್."), price: 25, model: "pine-2", radius: 1.4 },
  { id: "blossom-tree", category: "nature", name: t("Blossom tree", "फूलों वाला पेड़", "ಹೂಬಿಡುವ ಮರ"), description: t("Covered in pink blossom.", "गुलाबी फूलों से ढका।", "ಗುಲಾಬಿ ಹೂಗಳಿಂದ ಮುಚ್ಚಿದೆ."), price: 40, model: "blossom-tree", radius: 1.6 },
  { id: "apple-tree", category: "nature", name: t("Apple tree", "सेब का पेड़", "ಸೇಬಿನ ಮರ"), description: t("Grows shiny red apples.", "चमकीले लाल सेब उगाता है।", "ಕೆಂಪು ಸೇಬು ಬೆಳೆಯುತ್ತದೆ."), price: 35, model: "apple-tree", radius: 1.4 },
  { id: "flower-bush", category: "nature", name: t("Flowering bush", "फूलों की झाड़ी", "ಹೂವಿನ ಪೊದೆ"), description: t("A round bush in bloom.", "खिली हुई गोल झाड़ी।", "ಅರಳಿದ ದುಂಡು ಪೊದೆ."), price: 12, model: "bush-flowers", radius: 1 },
  { id: "flower-bed", category: "nature", name: t("Flower bed", "फूलों की क्यारी", "ಹೂವಿನ ಮಡಿ"), description: t("A patch of wild flowers.", "जंगली फूलों की क्यारी।", "ಕಾಡು ಹೂಗಳ ಮಡಿ."), price: 10, model: "flowers-a", radius: 0.8 },
  { id: "sunflowers", category: "nature", name: t("Sunflowers", "सूरजमुखी", "ಸೂರ್ಯಕಾಂತಿ"), description: t("Tall sunflowers that follow the sun.", "सूरज की ओर मुड़ने वाले सूरजमुखी।", "ಸೂರ್ಯನತ್ತ ತಿರುಗುವ ಹೂ."), price: 15, model: "sunflowers", radius: 0.8 },
  { id: "pumpkins", category: "nature", name: t("Pumpkin patch", "कद्दू की क्यारी", "ಕುಂಬಳ ಮಡಿ"), description: t("Big orange pumpkins.", "बड़े नारंगी कद्दू।", "ದೊಡ್ಡ ಕಿತ್ತಳೆ ಕುಂಬಳ."), price: 15, model: "crop-pumpkin-4", radius: 0.9 },
  { id: "corn", category: "nature", name: t("Corn", "मक्का", "ಮೆಕ್ಕೆಜೋಳ"), description: t("A tall row of corn.", "मक्के की ऊँची कतार।", "ಎತ್ತರದ ಜೋಳದ ಸಾಲು."), price: 12, model: "crop-corn-4", radius: 0.6 },
  // Animals
  { id: "cow", category: "animals", name: t("Cow", "गाय", "ಹಸು"), description: t("A friendly Holstein cow.", "एक दोस्ताना गाय।", "ಸ್ನೇಹಪರ ಹಸು."), price: 100, model: "cow", radius: 1.4 },
  { id: "horse", category: "animals", name: t("Horse", "घोड़ा", "ಕುದುರೆ"), description: t("A chestnut horse.", "भूरा घोड़ा।", "ಕಂದು ಕುದುರೆ."), price: 130, model: "horse", radius: 1.4 },
  { id: "sheep", category: "animals", name: t("Sheep", "भेड़", "ಕುರಿ"), description: t("A woolly sheep.", "ऊनी भेड़।", "ಉಣ್ಣೆಯ ಕುರಿ."), price: 70, model: "sheep", radius: 1 },
  { id: "pig", category: "animals", name: t("Pig", "सूअर", "ಹಂದಿ"), description: t("A happy pink pig.", "खुश गुलाबी सूअर।", "ಖುಷಿಯ ಗುಲಾಬಿ ಹಂದಿ."), price: 70, model: "pig", radius: 1 },
  { id: "donkey", category: "animals", name: t("Donkey", "गधा", "ಕತ್ತೆ"), description: t("A gentle grey donkey.", "शांत भूरा गधा।", "ಸೌಮ್ಯ ಬೂದು ಕತ್ತೆ."), price: 90, model: "donkey", radius: 1.2 },
  { id: "alpaca", category: "animals", name: t("Alpaca", "अल्पाका", "ಅಲ್ಪಾಕ"), description: t("A fluffy alpaca.", "रोएँदार अल्पाका।", "ಮೃದು ಉಣ್ಣೆಯ ಅಲ್ಪಾಕ."), price: 110, model: "alpaca", radius: 1.1 },
  { id: "dog", category: "animals", name: t("Farm dog", "खेत का कुत्ता", "ತೋಟದ ನಾಯಿ"), description: t("A loyal farm dog.", "वफ़ादार कुत्ता।", "ನಿಷ್ಠಾವಂತ ನಾಯಿ."), price: 60, model: "dog", radius: 0.7 },
  // Customisation
  { id: "fence", category: "customisation", name: t("Wooden fence", "लकड़ी की बाड़", "ಮರದ ಬೇಲಿ"), description: t("A length of rustic fence.", "देहाती बाड़ का एक हिस्सा।", "ಹಳ್ಳಿಯ ಬೇಲಿಯ ತುಂಡು."), price: 6, model: "fence", radius: 1.4 },
  { id: "gate", category: "customisation", name: t("Garden gate", "बगीचे का गेट", "ತೋಟದ ಗೇಟು"), description: t("A wooden gate.", "लकड़ी का गेट।", "ಮರದ ಗೇಟು."), price: 10, model: "gate", radius: 1 },
  { id: "hedge", category: "customisation", name: t("Hedge", "झाड़ीदार बाड़", "ಬೇಲಿ ಗಿಡ"), description: t("A neatly trimmed hedge.", "सलीके से कटी झाड़ी।", "ಅಚ್ಚುಕಟ್ಟಾದ ಬೇಲಿ ಗಿಡ."), price: 8, model: "hedge", radius: 1 },
  { id: "stone-path", category: "customisation", name: t("Stepping stones", "पत्थर का रास्ता", "ಕಲ್ಲಿನ ದಾರಿ"), description: t("Flat stones to walk on.", "चलने के लिए चपटे पत्थर।", "ನಡೆಯಲು ಚಪ್ಪಟೆ ಕಲ್ಲು."), price: 4, model: "stepping-stones", radius: 0.7 },
  { id: "signpost", category: "customisation", name: t("Signpost", "दिशा-सूचक", "ದಿಕ್ಕಿನ ಫಲಕ"), description: t("Points the way.", "रास्ता बताता है।", "ದಾರಿ ತೋರಿಸುತ್ತದೆ."), price: 8, model: "signpost", radius: 0.5 },
  { id: "picnic-table", category: "customisation", name: t("Picnic table", "पिकनिक टेबल", "ಪಿಕ್ನಿಕ್ ಮೇಜು"), description: t("For lunch outdoors.", "बाहर खाने के लिए।", "ಹೊರಗೆ ಊಟಕ್ಕೆ."), price: 20, model: "picnic-table", radius: 1.5 },
  { id: "hay-bale", category: "customisation", name: t("Hay bale", "भूसे का गट्ठर", "ಹುಲ್ಲಿನ ಕಂತೆ"), description: t("A round bale of hay.", "भूसे का गोल गट्ठर।", "ಹುಲ್ಲಿನ ದುಂಡು ಕಂತೆ."), price: 6, model: "hay-bale", radius: 0.9 },
  { id: "log-pile", category: "customisation", name: t("Log pile", "लकड़ी का ढेर", "ಕಟ್ಟಿಗೆ ರಾಶಿ"), description: t("Firewood for winter.", "सर्दी के लिए लकड़ी।", "ಚಳಿಗಾಲಕ್ಕೆ ಕಟ್ಟಿಗೆ."), price: 8, model: "log-pile", radius: 1 },
];

export const catalogItem = (id: string) => CATALOG.find((i) => i.id === id);
