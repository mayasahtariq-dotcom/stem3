/**
 * Seed course for the fake backend. Every question follows the backend's
 * question JSON exactly (backend/app/ai/schemas.py): multiple_choice,
 * match_pairs, fill_formula and true_false, with Tri {en, hi, kn} texts and
 * options that point to a term by key. Hindi/Kannada lines are drafts.
 */
export type Tri = { en: string; hi: string; kn: string };
const tri = (en: string, hi: string, kn: string): Tri => ({ en, hi, kn });

const callScript = (hi: string, kn: string) => ({ hi: { prompt: hi, options: [], explanation: "" }, kn: { prompt: kn, options: [], explanation: "" } });

export const TERMS: Record<string, { forms: Tri; meaning: Tri; analogy: Tri; page: number }> = {
  cell: { forms: tri("Cell", "कोशिका", "ಜೀವಕೋಶ"), meaning: tri("The smallest unit of life.", "जीवन की सबसे छोटी इकाई।", "ಜೀವದ ಅತ್ಯಂತ ಚಿಕ್ಕ ಘಟಕ."), analogy: tri("Like one brick in a wall.", "जैसे दीवार की एक ईंट।", "ಗೋಡೆಯ ಒಂದು ಇಟ್ಟಿಗೆಯಂತೆ."), page: 1 },
  nucleus: { forms: tri("Nucleus", "केंद्रक", "ಕೋಶಕೇಂದ್ರ"), meaning: tri("Controls the cell and holds its DNA.", "कोशिका को नियंत्रित करता है और DNA रखता है।", "ಜೀವಕೋಶವನ್ನು ನಿಯಂತ್ರಿಸುತ್ತದೆ ಮತ್ತು DNA ಹೊಂದಿದೆ."), analogy: tri("Like the farmer who decides the day's work.", "जैसे किसान जो दिन का काम तय करता है।", "ದಿನದ ಕೆಲಸ ನಿರ್ಧರಿಸುವ ರೈತನಂತೆ."), page: 2 },
  mitochondria: { forms: tri("Mitochondria", "माइटोकॉन्ड्रिया", "ಮೈಟೊಕಾಂಡ್ರಿಯಾ"), meaning: tri("Makes energy from food.", "भोजन से ऊर्जा बनाता है।", "ಆಹಾರದಿಂದ ಶಕ್ತಿ ಮಾಡುತ್ತದೆ."), analogy: tri("Like the stove in the kitchen.", "जैसे रसोई का चूल्हा।", "ಅಡುಗೆಮನೆಯ ಒಲೆಯಂತೆ."), page: 3 },
  ribosome: { forms: tri("Ribosome", "राइबोसोम", "ರೈಬೋಸೋಮ್"), meaning: tri("Makes proteins.", "प्रोटीन बनाता है।", "ಪ್ರೋಟೀನ್ ಮಾಡುತ್ತದೆ."), analogy: tri("Like a small workshop.", "जैसे छोटी कार्यशाला।", "ಚಿಕ್ಕ ಕಾರ್ಯಾಗಾರದಂತೆ."), page: 3 },
  cell_wall: { forms: tri("Cell wall", "कोशिका भित्ति", "ಕೋಶ ಭಿತ್ತಿ"), meaning: tri("A stiff outer layer in plant cells.", "पादप कोशिका की मज़बूत बाहरी परत।", "ಸಸ್ಯ ಕೋಶದ ಗಟ್ಟಿಯಾದ ಹೊರ ಪದರ."), analogy: tri("Like the fence around a field.", "जैसे खेत के चारों ओर बाड़।", "ಹೊಲದ ಸುತ್ತಲಿನ ಬೇಲಿಯಂತೆ."), page: 4 },
  chloroplast: { forms: tri("Chloroplast", "क्लोरोप्लास्ट", "ಕ್ಲೋರೋಪ್ಲಾಸ್ಟ್"), meaning: tri("Makes food from sunlight in plant cells.", "पादप कोशिका में धूप से भोजन बनाता है।", "ಸಸ್ಯ ಕೋಶದಲ್ಲಿ ಸೂರ್ಯನ ಬೆಳಕಿನಿಂದ ಆಹಾರ ಮಾಡುತ್ತದೆ."), analogy: tri("Like a solar panel on the barn roof.", "जैसे खलिहान की छत पर सोलर पैनल।", "ಕೊಟ್ಟಿಗೆಯ ಛಾವಣಿಯ ಸೌರ ಫಲಕದಂತೆ."), page: 4 },
  cell_membrane: { forms: tri("Cell membrane", "कोशिका झिल्ली", "ಜೀವಕೋಶ ಪೊರೆ"), meaning: tri("A thin layer that lets some things in and out.", "पतली परत जो कुछ चीज़ें अंदर-बाहर जाने देती है।", "ಕೆಲವು ವಸ್ತುಗಳನ್ನು ಒಳಗೆ ಹೊರಗೆ ಬಿಡುವ ತೆಳು ಪದರ."), analogy: tri("Like the farm gate.", "जैसे खेत का फाटक।", "ಹೊಲದ ಗೇಟಿನಂತೆ."), page: 2 },
  vacuole: { forms: tri("Vacuole", "रिक्तिका", "ರಸದಾನಿ"), meaning: tri("Stores water and food.", "पानी और भोजन जमा करती है।", "ನೀರು ಮತ್ತು ಆಹಾರ ಸಂಗ್ರಹಿಸುತ್ತದೆ."), analogy: tri("Like the water tank on the farm.", "जैसे खेत की पानी की टंकी।", "ಹೊಲದ ನೀರಿನ ತೊಟ್ಟಿಯಂತೆ."), page: 5 },
};

/** Term content in the backend's shape (backend/app/ai/fake_content.py `_term`). */
export function termContent(key: string) {
  const t = TERMS[key]!;
  return { key, forms: t.forms, transliteration: tri(t.forms.en.toLowerCase(), t.forms.en.toLowerCase(), t.forms.en.toLowerCase()), formal: t.forms, meaning: t.meaning, analogy: t.analogy, related: [], source_page: t.page };
}

type Q = Record<string, unknown> & { type: string };
const base = (prompt: Tri, explanation: Tri, page: number) => ({ source_page: page, confidence: 0.92, flag_reason: null, prompt, explanation, call_safe: true, call_script: callScript(prompt.hi, prompt.kn) });

const mcq = (prompt: Tri, keys: string[], correct: number, explanation: Tri, page = 2): Q => ({ type: "multiple_choice", ...base(prompt, explanation, page), options: keys.map((k) => ({ term_key: k })), correct_index: correct });
const tf = (statement: Tri, answer: boolean, explanation: Tri, page = 2): Q => ({ type: "true_false", ...base(tri("True or false?", "सही या गलत?", "ಸರಿ ಅಥವಾ ತಪ್ಪು?"), explanation, page), statement, answer });
const fill = (prompt: Tri, formula: string, answer: string, chips: string[], explanation: Tri, page = 4): Q => ({ type: "fill_formula", ...base(prompt, explanation, page), call_safe: false, formula, answer, chips });
const match = (prompt: Tri, pairs: [string, Tri][], explanation: Tri, page = 3): Q => ({ type: "match_pairs", ...base(prompt, explanation, page), call_safe: false, pairs: pairs.map(([k, right]) => ({ left: { term_key: k }, right: { text: right } })) });

const BANK: Q[][] = [
  [
    mcq(tri("What is the smallest unit of life?", "जीवन की सबसे छोटी इकाई क्या है?", "ಜೀವದ ಅತ್ಯಂತ ಚಿಕ್ಕ ಘಟಕ ಯಾವುದು?"), ["nucleus", "cell", "vacuole"], 1, tri("Every living thing is made of cells.", "हर जीव कोशिकाओं से बना है।", "ಪ್ರತಿ ಜೀವಿಯೂ ಜೀವಕೋಶಗಳಿಂದ ಆಗಿದೆ."), 1),
    tf(tri("All living things are made of cells.", "सभी जीव कोशिकाओं से बने हैं।", "ಎಲ್ಲಾ ಜೀವಿಗಳು ಜೀವಕೋಶಗಳಿಂದ ಆಗಿವೆ."), true, tri("Cells are the building blocks of life.", "कोशिकाएँ जीवन की ईंटें हैं।", "ಜೀವಕೋಶಗಳು ಜೀವದ ಇಟ್ಟಿಗೆಗಳು."), 1),
    fill(tri("Fill the gap in the levels of life.", "जीवन के स्तरों में खाली जगह भरो।", "ಜೀವದ ಹಂತಗಳಲ್ಲಿ ಖಾಲಿ ತುಂಬಿ."), "Cell → Tissue → __ → Organ system", "Organ", ["Organ", "Atom", "Cell", "Seed"], tri("Tissues work together as an organ.", "ऊतक मिलकर अंग बनाते हैं।", "ಅಂಗಾಂಶಗಳು ಸೇರಿ ಅಂಗವಾಗುತ್ತವೆ."), 1),
    tf(tri("A cell can be seen easily without a microscope.", "कोशिका बिना सूक्ष्मदर्शी के आसानी से दिखती है।", "ಸೂಕ್ಷ್ಮದರ್ಶಕವಿಲ್ಲದೆ ಜೀವಕೋಶ ಸುಲಭವಾಗಿ ಕಾಣುತ್ತದೆ."), false, tri("Most cells are too small to see with our eyes alone.", "ज़्यादातर कोशिकाएँ आँख से दिखने के लिए बहुत छोटी हैं।", "ಹೆಚ್ಚಿನ ಜೀವಕೋಶಗಳು ಕಣ್ಣಿಗೆ ಕಾಣದಷ್ಟು ಚಿಕ್ಕವು."), 1),
  ],
  [
    mcq(tri("Which part controls the cell?", "कौन सा भाग कोशिका को नियंत्रित करता है?", "ಯಾವ ಭಾಗ ಜೀವಕೋಶವನ್ನು ನಿಯಂತ್ರಿಸುತ್ತದೆ?"), ["mitochondria", "nucleus", "ribosome", "vacuole"], 1, tri("The nucleus holds DNA and controls the cell.", "केंद्रक DNA रखता है और कोशिका को चलाता है।", "ಕೋಶಕೇಂದ್ರ DNA ಹೊಂದಿದೆ ಮತ್ತು ಜೀವಕೋಶವನ್ನು ನಡೆಸುತ್ತದೆ."), 2),
    match(tri("Match each part to its job.", "हर भाग को उसके काम से मिलाओ।", "ಪ್ರತಿ ಭಾಗವನ್ನು ಅದರ ಕೆಲಸಕ್ಕೆ ಹೊಂದಿಸಿ."), [["nucleus", tri("Controls the cell", "कोशिका चलाता है", "ಜೀವಕೋಶ ನಡೆಸುತ್ತದೆ")], ["mitochondria", tri("Makes energy", "ऊर्जा बनाता है", "ಶಕ್ತಿ ಮಾಡುತ್ತದೆ")], ["ribosome", tri("Makes proteins", "प्रोटीन बनाता है", "ಪ್ರೋಟೀನ್ ಮಾಡುತ್ತದೆ")]], tri("Each part has one main job.", "हर भाग का एक मुख्य काम है।", "ಪ್ರತಿ ಭಾಗಕ್ಕೂ ಒಂದು ಮುಖ್ಯ ಕೆಲಸವಿದೆ."), 3),
    tf(tri("The cell membrane lets some things in and out.", "कोशिका झिल्ली कुछ चीज़ें अंदर-बाहर जाने देती है।", "ಜೀವಕೋಶ ಪೊರೆ ಕೆಲವು ವಸ್ತುಗಳನ್ನು ಒಳಗೆ ಹೊರಗೆ ಬಿಡುತ್ತದೆ."), true, tri("It works like a farm gate.", "यह खेत के फाटक जैसा है।", "ಇದು ಹೊಲದ ಗೇಟಿನಂತೆ."), 2),
    mcq(tri("Which part makes proteins?", "कौन सा भाग प्रोटीन बनाता है?", "ಯಾವ ಭಾಗ ಪ್ರೋಟೀನ್ ಮಾಡುತ್ತದೆ?"), ["ribosome", "cell_wall", "vacuole"], 0, tri("Ribosomes are small protein workshops.", "राइबोसोम प्रोटीन की छोटी कार्यशाला है।", "ರೈಬೋಸೋಮ್ ಪ್ರೋಟೀನ್‌ನ ಚಿಕ್ಕ ಕಾರ್ಯಾಗಾರ."), 3),
  ],
  [
    mcq(tri("Which part is found only in plant cells?", "कौन सा भाग सिर्फ़ पादप कोशिका में होता है?", "ಯಾವ ಭಾಗ ಸಸ್ಯ ಕೋಶದಲ್ಲಿ ಮಾತ್ರ ಇದೆ?"), ["nucleus", "cell_membrane", "cell_wall"], 2, tri("Animal cells have no cell wall.", "जंतु कोशिका में कोशिका भित्ति नहीं होती।", "ಪ್ರಾಣಿ ಕೋಶದಲ್ಲಿ ಕೋಶ ಭಿತ್ತಿ ಇಲ್ಲ."), 4),
    tf(tri("Animal cells have chloroplasts.", "जंतु कोशिका में क्लोरोप्लास्ट होते हैं।", "ಪ್ರಾಣಿ ಕೋಶದಲ್ಲಿ ಕ್ಲೋರೋಪ್ಲಾಸ್ಟ್ ಇದೆ."), false, tri("Only plant cells make food from sunlight.", "सिर्फ़ पादप कोशिका धूप से भोजन बनाती है।", "ಸಸ್ಯ ಕೋಶ ಮಾತ್ರ ಬೆಳಕಿನಿಂದ ಆಹಾರ ಮಾಡುತ್ತದೆ."), 4),
    match(tri("Match each part to its farm friend.", "हर भाग को खेत की चीज़ से मिलाओ।", "ಪ್ರತಿ ಭಾಗವನ್ನು ಹೊಲದ ವಸ್ತುವಿಗೆ ಹೊಂದಿಸಿ."), [["cell_wall", tri("Fence", "बाड़", "ಬೇಲಿ")], ["vacuole", tri("Water tank", "पानी की टंकी", "ನೀರಿನ ತೊಟ್ಟಿ")], ["chloroplast", tri("Solar panel", "सोलर पैनल", "ಸೌರ ಫಲಕ")]], tri("Picturing the farm helps you remember.", "खेत की तस्वीर याद रखने में मदद करती है।", "ಹೊಲವನ್ನು ಕಲ್ಪಿಸಿಕೊಳ್ಳುವುದು ನೆನಪಿಗೆ ಸಹಾಯ."), 4),
    tf(tri("A vacuole stores water.", "रिक्तिका पानी जमा करती है।", "ರಸದಾನಿ ನೀರು ಸಂಗ್ರಹಿಸುತ್ತದೆ."), true, tri("Plant cells have a large vacuole.", "पादप कोशिका में बड़ी रिक्तिका होती है।", "ಸಸ್ಯ ಕೋಶದಲ್ಲಿ ದೊಡ್ಡ ರಸದಾನಿ ಇದೆ."), 5),
  ],
  [
    mcq(tri("Which part of the cell makes energy?", "कोशिका का कौन सा भाग ऊर्जा बनाता है?", "ಜೀವಕೋಶದ ಯಾವ ಭಾಗ ಶಕ್ತಿ ಮಾಡುತ್ತದೆ?"), ["nucleus", "mitochondria", "cell_wall", "vacuole"], 1, tri("Mitochondria make energy from food, like a stove.", "माइटोकॉन्ड्रिया भोजन से ऊर्जा बनाता है, जैसे चूल्हा।", "ಮೈಟೊಕಾಂಡ್ರಿಯಾ ಆಹಾರದಿಂದ ಶಕ್ತಿ ಮಾಡುತ್ತದೆ, ಒಲೆಯಂತೆ."), 3),
    fill(tri("Complete photosynthesis.", "प्रकाश संश्लेषण पूरा करो।", "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಪೂರ್ಣಗೊಳಿಸಿ."), "CO₂ + H₂O → __ + O₂", "Glucose", ["Glucose", "Salt", "Iron", "Sand"], tri("Plants turn carbon dioxide and water into glucose and oxygen.", "पौधे कार्बन डाइऑक्साइड और पानी से ग्लूकोज़ और ऑक्सीजन बनाते हैं।", "ಸಸ್ಯಗಳು ಕಾರ್ಬನ್ ಡೈಆಕ್ಸೈಡ್ ಮತ್ತು ನೀರಿನಿಂದ ಗ್ಲೂಕೋಸ್ ಮತ್ತು ಆಮ್ಲಜನಕ ಮಾಡುತ್ತವೆ."), 4),
    tf(tri("Mitochondria are found in animal cells.", "माइटोकॉन्ड्रिया जंतु कोशिका में होते हैं।", "ಮೈಟೊಕಾಂಡ್ರಿಯಾ ಪ್ರಾಣಿ ಕೋಶದಲ್ಲಿ ಇವೆ."), true, tri("Both plant and animal cells need energy.", "पादप और जंतु दोनों कोशिकाओं को ऊर्जा चाहिए।", "ಸಸ್ಯ ಮತ್ತು ಪ್ರಾಣಿ ಕೋಶಗಳಿಗೆ ಶಕ್ತಿ ಬೇಕು."), 3),
    mcq(tri("Which part makes food from sunlight?", "कौन सा भाग धूप से भोजन बनाता है?", "ಯಾವ ಭಾಗ ಬೆಳಕಿನಿಂದ ಆಹಾರ ಮಾಡುತ್ತದೆ?"), ["chloroplast", "ribosome", "nucleus"], 0, tri("Chloroplasts hold the green pigment.", "क्लोरोप्लास्ट में हरा रंग होता है।", "ಕ್ಲೋರೋಪ್ಲಾಸ್ಟ್‌ನಲ್ಲಿ ಹಸಿರು ವರ್ಣ ಇದೆ."), 4),
  ],
];

export interface FakeQuestion {
  id: string;
  position: number;
  type: string;
  content: Q;
  source_page: number;
  call_safe: boolean;
  /** Review metadata the teacher sees (backend Question columns). */
  confidence?: number;
  flag_reason?: string | null;
  teacher_edited?: boolean;
}

export interface FakeLesson {
  id: string;
  courseId: string;
  unit: number;
  position: number;
  title: Tri;
  generation_status: "ready" | "generating";
  published: boolean;
  questions: FakeQuestion[];
}

const LESSON_TITLES: Tri[] = [
  tri("What is a cell?", "कोशिका क्या है?", "ಜೀವಕೋಶ ಎಂದರೇನು?"),
  tri("Parts of a cell", "कोशिका के भाग", "ಜೀವಕೋಶದ ಭಾಗಗಳು"),
  tri("Plant and animal cells", "पादप और जंतु कोशिका", "ಸಸ್ಯ ಮತ್ತು ಪ್ರಾಣಿ ಕೋಶ"),
  tri("Energy in the cell", "कोशिका में ऊर्जा", "ಜೀವಕೋಶದಲ್ಲಿ ಶಕ್ತಿ"),
  tri("Food from sunlight", "धूप से भोजन", "ಬೆಳಕಿನಿಂದ ಆಹಾರ"),
  tri("Cell review", "कोशिका दोहराव", "ಜೀವಕೋಶ ಪುನರಾವರ್ತನೆ"),
];

export const UNITS: { id: string; title: Tri }[] = [
  { id: "unit-cell-1", title: tri("Cell structure", "कोशिका की संरचना", "ಜೀವಕೋಶದ ರಚನೆ") },
  { id: "unit-cell-2", title: tri("Cell energy", "कोशिका की ऊर्जा", "ಜೀವಕೋಶದ ಶಕ್ತಿ") },
];

export const COURSE_ID = "course-cell";
export const COURSE_TITLE = tri("The Cell", "कोशिका", "ಜೀವಕೋಶ");

/** Six lessons in two units; the last one is still being made (LESSON_NOT_READY demo). */
export function buildLessons(): FakeLesson[] {
  return LESSON_TITLES.map((title, i) => {
    const bank = BANK[i % BANK.length]!;
    const extra = BANK[(i + 1) % BANK.length]!;
    const qs = [...bank, extra[0]!, extra[2]!];
    return {
      id: `lesson-${i + 1}`,
      courseId: COURSE_ID,
      unit: i < 3 ? 0 : 1,
      position: i + 1,
      title,
      generation_status: i === 5 ? "generating" : "ready",
      published: true,
      questions: qs.map((content, j) => ({ id: `q-${i + 1}-${j + 1}`, position: j + 1, type: content.type, content, source_page: Number(content.source_page), call_safe: Boolean(content.call_safe) })),
    };
  });
}
