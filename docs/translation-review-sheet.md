# Translation review sheet

Every Hindi (hi) and Kannada (kn) line the backend speaks or sends. All are drafts.
Reviewer: correct the text in place in the source file shown, then tick the box.

| Source | Key | English | Hindi | Kannada | OK |
|---|---|---|---|---|---|
| calls/script.py | consent | Hello. This is Aaroh, a science learning game for children. We would like to call {name} on a few days each week for short lessons. Calls are never recorded. Press 1 to agree, or press 2 to decline. | नमस्ते। यह आरोह है, बच्चों के लिए विज्ञान सीखने का खेल। हम {name} को हफ्ते में कुछ दिन छोटे पाठ के लिए फ़ोन करना चाहते हैं। कॉल रिकॉर्ड नहीं की जाती। सहमति के लिए 1 दबाएँ, मना करने के लिए 2 दबाएँ। | ನಮಸ್ಕಾರ. ಇದು ಆರೋಹ, ಮಕ್ಕಳಿಗಾಗಿ ವಿಜ್ಞಾನ ಕಲಿಕೆಯ ಆಟ. ನಾವು {name} ಅವರಿಗೆ ವಾರದಲ್ಲಿ ಕೆಲವು ದಿನ ಸಣ್ಣ ಪಾಠಕ್ಕಾಗಿ ಕರೆ ಮಾಡಲು ಬಯಸುತ್ತೇವೆ. ಕರೆಗಳನ್ನು ರೆಕಾರ್ಡ್ ಮಾಡುವುದಿಲ್ಲ. ಒಪ್ಪಿಗೆಗೆ 1 ಒತ್ತಿ, ನಿರಾಕರಿಸಲು 2 ಒತ್ತಿ. | [ ] |
| calls/script.py | consent_yes | Thank you! Let's start the first lesson. | धन्यवाद! चलिए पहला पाठ शुरू करते हैं। | ಧನ್ಯವಾದಗಳು! ಮೊದಲ ಪಾಠ ಪ್ರಾರಂಭಿಸೋಣ. | [ ] |
| calls/script.py | consent_no | Okay, we will not call. Thank you. | ठीक है, हम कॉल नहीं करेंगे। धन्यवाद। | ಸರಿ, ನಾವು ಕರೆ ಮಾಡುವುದಿಲ್ಲ. ಧನ್ಯವಾದಗಳು. | [ ] |
| calls/script.py | greet | Hello {name}! I am Golu. Your streak is {streak} days. Today we will learn: {lesson}. | नमस्ते {name}! मैं गोलू हूँ। तुम्हारी स्ट्रीक {streak} दिन की है। आज हम सीखेंगे: {lesson}। | ನಮಸ್ಕಾರ {name}! ನಾನು ಗೋಲು. ನಿನ್ನ ಸ್ಟ್ರೀಕ್ {streak} ದಿನಗಳು. ಇಂದು ನಾವು ಕಲಿಯುವುದು: {lesson}. | [ ] |
| calls/script.py | hint | Press 9 to hear it again. | दोबारा सुनने के लिए 9 दबाओ। | ಮತ್ತೆ ಕೇಳಲು 9 ಒತ್ತು. | [ ] |
| calls/script.py | option | Press {n} for {text}. | {n} दबाओ: {text}। | {n} ಒತ್ತು: {text}. | [ ] |
| calls/script.py | true_false | Press 1 for true, press 2 for false. | सही के लिए 1 दबाओ, गलत के लिए 2 दबाओ। | ಸರಿ ಎಂದರೆ 1 ಒತ್ತು, ತಪ್ಪು ಎಂದರೆ 2 ಒತ್ತು. | [ ] |
| calls/script.py | correct | Great job! That's right. Plus {xp} XP. | बहुत बढ़िया! सही जवाब। प्लस {xp} एक्स पी। | ಅದ್ಭುತ! ಸರಿಯಾದ ಉತ್ತರ. ಪ್ಲಸ್ {xp} ಎಕ್ಸ್ ಪಿ. | [ ] |
| calls/script.py | combo | Three in a row! | लगातार तीन सही! | ಸತತ ಮೂರು ಸರಿ! | [ ] |
| calls/script.py | not_quite | Not quite! The answer is: {answer}. | लगभग! सही जवाब है: {answer}। | ಸ್ವಲ್ಪದರಲ್ಲಿ ತಪ್ಪಿತು! ಸರಿಯಾದ ಉತ್ತರ: {answer}. | [ ] |
| calls/script.py | no_input | No key was pressed. Let's listen again. | कोई बटन नहीं दबाया। फिर से सुनो। | ಯಾವ ಬಟನ್ ಒತ್ತಲಿಲ್ಲ. ಮತ್ತೆ ಕೇಳು. | [ ] |
| calls/script.py | summary | Today you earned {xp} XP. Your streak is {streak} days. | आज तुमने {xp} एक्स पी कमाए। तुम्हारी स्ट्रीक {streak} दिन की है। | ಇಂದು ನೀನು {xp} ಎಕ್ಸ್ ಪಿ ಗಳಿಸಿದೆ. ನಿನ್ನ ಸ್ಟ್ರೀಕ್ {streak} ದಿನಗಳು. | [ ] |
| calls/script.py | badge | You earned a new badge! | तुम्हें नया बैज मिला! | ನಿನಗೆ ಹೊಸ ಬ್ಯಾಡ್ಜ್ ಸಿಕ್ಕಿದೆ! | [ ] |
| calls/script.py | rank | You are number {rank} in your class league. | क्लास लीग में तुम {rank} नंबर पर हो। | ತರಗತಿ ಲೀಗ್‌ನಲ್ಲಿ ನೀನು {rank}ನೇ ಸ್ಥಾನದಲ್ಲಿದ್ದೀಯ. | [ ] |
| calls/script.py | bye | Well done! See you on the next call. Goodbye! | शाबाश! अगली कॉल पर मिलते हैं। अलविदा! | ಶಭಾಷ್! ಮುಂದಿನ ಕರೆಯಲ್ಲಿ ಸಿಗೋಣ. ಬೈ! | [ ] |
| calls/script.py | no_lesson | There is no lesson for today. Goodbye! | आज के लिए कोई पाठ नहीं है। अलविदा! | ಇಂದು ಯಾವುದೇ ಪಾಠವಿಲ್ಲ. ಬೈ! | [ ] |
| calls/script.py | true | True | सही | ಸರಿ | [ ] |
| calls/script.py | false | False | गलत | ತಪ್ಪು | [ ] |
| calls/script.py | pick | Press {n} for {name}. | {n} दबाओ, {name} के लिए। | {name} ಗಾಗಿ {n} ಒತ್ತು. | [ ] |
| calls/script.py | closed | Aaroh calls are available from 9 am to 9 pm. Please call then. Thank you! | आरोह की कॉल सुबह 9 से रात 9 बजे तक होती हैं। कृपया तब कॉल करें। धन्यवाद! | ಆರೋಹ ಕರೆಗಳು ಬೆಳಿಗ್ಗೆ 9 ರಿಂದ ರಾತ್ರಿ 9 ರವರೆಗೆ. ದಯವಿಟ್ಟು ಆಗ ಕರೆ ಮಾಡಿ. ಧನ್ಯವಾದಗಳು! | [ ] |
| calls/script.py | cap | This week's call minutes are used up. See you next week! | इस हफ्ते के कॉल मिनट पूरे हो गए हैं। अगले हफ्ते मिलते हैं! | ಈ ವಾರದ ಕರೆ ನಿಮಿಷಗಳು ಮುಗಿದಿವೆ. ಮುಂದಿನ ವಾರ ಸಿಗೋಣ! | [ ] |
| calls/script.py | not_active | Calls are paused for this number. Thank you! | अभी इस नंबर के लिए कॉल बंद हैं। धन्यवाद! | ಈ ಸಂಖ್ಯೆಗೆ ಈಗ ಕರೆಗಳು ನಿಂತಿವೆ. ಧನ್ಯವಾದಗಳು! | [ ] |
| calls/script.py | repeat | Press {n} to hear the question again. | {n} दबाओ, सवाल दोबारा सुनने के लिए। | ಪ್ರಶ್ನೆಯನ್ನು ಮತ್ತೆ ಕೇಳಲು {n} ಒತ್ತು. | [ ] |
| calls/script.py | chosen | You chose: {text}. Press 1 to confirm your answer. Press 2 to hear the question again. | तुमने चुना: {text}। जवाब पक्का करने के लिए 1 दबाओ। सवाल दोबारा सुनने के लिए 2 दबाओ। | ನೀನು ಆರಿಸಿದ್ದು: {text}. ಉತ್ತರ ಖಚಿತಪಡಿಸಲು 1 ಒತ್ತು. ಪ್ರಶ್ನೆಯನ್ನು ಮತ್ತೆ ಕೇಳಲು 2 ಒತ್ತು. | [ ] |
| calls/script.py | lang_menu | For English, press 3. | हिंदी के लिए 1 दबाएँ। | ಕನ್ನಡಕ್ಕಾಗಿ 2 ಒತ್ತಿ. | [ ] |
| notify.py | course_complete_sms | Aaroh: {name} finished the course '{course}'! {xp} XP in total, a {streak}-day streak and {badges} badges. Well done! | आरोह: {name} ने '{course}' कोर्स पूरा कर लिया! कुल {xp} एक्स पी, {streak} दिन की स्ट्रीक, {badges} बैज। शाबाश! | ಆರೋಹ: {name} '{course}' ಕೋರ್ಸ್ ಪೂರ್ಣಗೊಳಿಸಿದ್ದಾರೆ! ಒಟ್ಟು {xp} ಎಕ್ಸ್ ಪಿ, {streak} ದಿನಗಳ ಸ್ಟ್ರೀಕ್, {badges} ಬ್ಯಾಡ್ಜ್‌ಗಳು. ಶಭಾಷ್! | [ ] |
| jobs/scheduler.py | weekly_sms | Aaroh: {name}, your streak is {streak} days, {badges} badges, rank {rank} in your class league. Well done! | आरोह: {name}, तुम्हारी स्ट्रीक {streak} दिन की है, {badges} बैज, क्लास लीग में {rank}। शाबाश! | ಆರೋಹ: {name}, ನಿನ್ನ ಸ್ಟ್ರೀಕ್ {streak} ದಿನಗಳು, {badges} ಬ್ಯಾಡ್ಜ್‌ಗಳು, ತರಗತಿ ಲೀಗ್‌ನಲ್ಲಿ {rank}. ಶಭಾಷ್! | [ ] |
