"""Spoken lines for calls. Hindi and Kannada are DRAFTS until a native speaker reviews them
(logged in docs/translations-to-review.md). Feedback says "not quite", never "wrong"."""

LINES: dict[str, dict[str, str]] = {
    "hi": {
        "consent": "नमस्ते। यह आरोह है, बच्चों के लिए विज्ञान सीखने का खेल। हम {name} को हफ्ते में "
                   "कुछ दिन छोटे पाठ के लिए फ़ोन करना चाहते हैं। कॉल रिकॉर्ड नहीं की जाती। "
                   "सहमति के लिए 1 दबाएँ, मना करने के लिए 2 दबाएँ।",
        "consent_yes": "धन्यवाद! चलिए पहला पाठ शुरू करते हैं।",
        "consent_no": "ठीक है, हम कॉल नहीं करेंगे। धन्यवाद।",
        "greet": "नमस्ते {name}! मैं गोलू हूँ। तुम्हारी स्ट्रीक {streak} दिन की है। "
                 "आज हम सीखेंगे: {lesson}।",
        "hint": "दोबारा सुनने के लिए 9 दबाओ।",
        "option": "{n} दबाओ: {text}।",
        "true_false": "सही के लिए 1 दबाओ, गलत के लिए 2 दबाओ।",
        "correct": "बहुत बढ़िया! सही जवाब। प्लस {xp} एक्स पी।",
        "combo": "लगातार तीन सही!",
        "not_quite": "लगभग! सही जवाब है: {answer}।",
        "no_input": "कोई बटन नहीं दबाया। फिर से सुनो।",
        "summary": "आज तुमने {xp} एक्स पी कमाए। तुम्हारी स्ट्रीक {streak} दिन की है।",
        "badge": "तुम्हें नया बैज मिला!",
        "rank": "क्लास लीग में तुम {rank} नंबर पर हो।",
        "bye": "शाबाश! अगली कॉल पर मिलते हैं। अलविदा!",
        "no_lesson": "आज के लिए कोई पाठ नहीं है। अलविदा!",
        "true": "सही", "false": "गलत",
        "pick": "{n} दबाओ, {name} के लिए।",
        "closed": "आरोह की कॉल सुबह 9 से रात 9 बजे तक होती हैं। कृपया तब कॉल करें। धन्यवाद!",
        "cap": "इस हफ्ते के कॉल मिनट पूरे हो गए हैं। अगले हफ्ते मिलते हैं!",
        "not_active": "अभी इस नंबर के लिए कॉल बंद हैं। धन्यवाद!",
        "repeat": "{n} दबाओ, सवाल दोबारा सुनने के लिए।",
        "chosen": "तुमने चुना: {text}। जवाब पक्का करने के लिए 1 दबाओ। सवाल दोबारा सुनने के लिए 2 दबाओ।",
        "lang_menu": "हिंदी के लिए 1 दबाएँ।",
    },
    "kn": {
        "consent": "ನಮಸ್ಕಾರ. ಇದು ಆರೋಹ, ಮಕ್ಕಳಿಗಾಗಿ ವಿಜ್ಞಾನ ಕಲಿಕೆಯ ಆಟ. ನಾವು {name} ಅವರಿಗೆ ವಾರದಲ್ಲಿ "
                   "ಕೆಲವು ದಿನ ಸಣ್ಣ ಪಾಠಕ್ಕಾಗಿ ಕರೆ ಮಾಡಲು ಬಯಸುತ್ತೇವೆ. ಕರೆಗಳನ್ನು ರೆಕಾರ್ಡ್ ಮಾಡುವುದಿಲ್ಲ. "
                   "ಒಪ್ಪಿಗೆಗೆ 1 ಒತ್ತಿ, ನಿರಾಕರಿಸಲು 2 ಒತ್ತಿ.",
        "consent_yes": "ಧನ್ಯವಾದಗಳು! ಮೊದಲ ಪಾಠ ಪ್ರಾರಂಭಿಸೋಣ.",
        "consent_no": "ಸರಿ, ನಾವು ಕರೆ ಮಾಡುವುದಿಲ್ಲ. ಧನ್ಯವಾದಗಳು.",
        "greet": "ನಮಸ್ಕಾರ {name}! ನಾನು ಗೋಲು. ನಿನ್ನ ಸ್ಟ್ರೀಕ್ {streak} ದಿನಗಳು. ಇಂದು ನಾವು ಕಲಿಯುವುದು: {lesson}.",
        "hint": "ಮತ್ತೆ ಕೇಳಲು 9 ಒತ್ತು.",
        "option": "{n} ಒತ್ತು: {text}.",
        "true_false": "ಸರಿ ಎಂದರೆ 1 ಒತ್ತು, ತಪ್ಪು ಎಂದರೆ 2 ಒತ್ತು.",
        "correct": "ಅದ್ಭುತ! ಸರಿಯಾದ ಉತ್ತರ. ಪ್ಲಸ್ {xp} ಎಕ್ಸ್ ಪಿ.",
        "combo": "ಸತತ ಮೂರು ಸರಿ!",
        "not_quite": "ಸ್ವಲ್ಪದರಲ್ಲಿ ತಪ್ಪಿತು! ಸರಿಯಾದ ಉತ್ತರ: {answer}.",
        "no_input": "ಯಾವ ಬಟನ್ ಒತ್ತಲಿಲ್ಲ. ಮತ್ತೆ ಕೇಳು.",
        "summary": "ಇಂದು ನೀನು {xp} ಎಕ್ಸ್ ಪಿ ಗಳಿಸಿದೆ. ನಿನ್ನ ಸ್ಟ್ರೀಕ್ {streak} ದಿನಗಳು.",
        "badge": "ನಿನಗೆ ಹೊಸ ಬ್ಯಾಡ್ಜ್ ಸಿಕ್ಕಿದೆ!",
        "rank": "ತರಗತಿ ಲೀಗ್‌ನಲ್ಲಿ ನೀನು {rank}ನೇ ಸ್ಥಾನದಲ್ಲಿದ್ದೀಯ.",
        "bye": "ಶಭಾಷ್! ಮುಂದಿನ ಕರೆಯಲ್ಲಿ ಸಿಗೋಣ. ಬೈ!",
        "no_lesson": "ಇಂದು ಯಾವುದೇ ಪಾಠವಿಲ್ಲ. ಬೈ!",
        "true": "ಸರಿ", "false": "ತಪ್ಪು",
        "pick": "{name} ಗಾಗಿ {n} ಒತ್ತು.",
        "closed": "ಆರೋಹ ಕರೆಗಳು ಬೆಳಿಗ್ಗೆ 9 ರಿಂದ ರಾತ್ರಿ 9 ರವರೆಗೆ. ದಯವಿಟ್ಟು ಆಗ ಕರೆ ಮಾಡಿ. ಧನ್ಯವಾದಗಳು!",
        "cap": "ಈ ವಾರದ ಕರೆ ನಿಮಿಷಗಳು ಮುಗಿದಿವೆ. ಮುಂದಿನ ವಾರ ಸಿಗೋಣ!",
        "not_active": "ಈ ಸಂಖ್ಯೆಗೆ ಈಗ ಕರೆಗಳು ನಿಂತಿವೆ. ಧನ್ಯವಾದಗಳು!",
        "repeat": "ಪ್ರಶ್ನೆಯನ್ನು ಮತ್ತೆ ಕೇಳಲು {n} ಒತ್ತು.",
        "chosen": "ನೀನು ಆರಿಸಿದ್ದು: {text}. ಉತ್ತರ ಖಚಿತಪಡಿಸಲು 1 ಒತ್ತು. ಪ್ರಶ್ನೆಯನ್ನು ಮತ್ತೆ ಕೇಳಲು 2 ಒತ್ತು.",
        "lang_menu": "ಕನ್ನಡಕ್ಕಾಗಿ 2 ಒತ್ತಿ.",
    },
    "en": {
        "consent": "Hello. This is Aaroh, a science learning game for children. We would like to "
                   "call {name} on a few days each week for short lessons. Calls are never "
                   "recorded. Press 1 to agree, or press 2 to decline.",
        "consent_yes": "Thank you! Let's start the first lesson.",
        "consent_no": "Okay, we will not call. Thank you.",
        "greet": "Hello {name}! I am Golu. Your streak is {streak} days. "
                 "Today we will learn: {lesson}.",
        "hint": "Press 9 to hear it again.",
        "option": "Press {n} for {text}.",
        "true_false": "Press 1 for true, press 2 for false.",
        "correct": "Great job! That's right. Plus {xp} XP.",
        "combo": "Three in a row!",
        "not_quite": "Not quite! The answer is: {answer}.",
        "no_input": "No key was pressed. Let's listen again.",
        "summary": "Today you earned {xp} XP. Your streak is {streak} days.",
        "badge": "You earned a new badge!",
        "rank": "You are number {rank} in your class league.",
        "bye": "Well done! See you on the next call. Goodbye!",
        "no_lesson": "There is no lesson for today. Goodbye!",
        "true": "True", "false": "False",
        "pick": "Press {n} for {name}.",
        "closed": "Aaroh calls are available from 9 am to 9 pm. Please call then. Thank you!",
        "cap": "This week's call minutes are used up. See you next week!",
        "not_active": "Calls are paused for this number. Thank you!",
        "repeat": "Press {n} to hear the question again.",
        "chosen": "You chose: {text}. Press 1 to confirm your answer. "
                  "Press 2 to hear the question again.",
        "lang_menu": "For English, press 3.",
    },
}


def line(lang: str, key: str, **kw: object) -> str:
    return LINES.get(lang, LINES["hi"])[key].format(**kw)


UNKNOWN_CALLER = "Thank you for calling Aaroh. This number is not registered. Please ask your teacher."
