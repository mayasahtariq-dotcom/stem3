"""Hackathon demo data: one class, two trilingual courses, a call-only student on your phone,
and classmates so the league means something. Question text is a DRAFT for review."""
import json
from typing import Any

from sqlalchemy import Connection, text

from app.auth.service import normalize_phone
from app.game import engine, leagues
from app.people import create_learner

TEACHER_PHONE = "+910000000099"
RIVALS = [("Meena", "+910000000101", 45), ("Arjun", "+910000000102", 30),
          ("Fatima", "+910000000103", 20), ("Kiran", "+910000000104", 10)]


def opt(hi: str, kn: str, en: str) -> dict[str, str]:
    return {"hi": hi, "kn": kn, "en": en}


COURSES = [
    ("1. Cells", "biology", "The Cell", [
        ("mcq", opt("जीवन की सबसे छोटी इकाई क्या है?", "ಜೀವದ ಅತ್ಯಂತ ಚಿಕ್ಕ ಘಟಕ ಯಾವುದು?",
                    "What is the smallest unit of life?"),
         [opt("कोशिका", "ಕೋಶ", "Cell"), opt("अंग", "ಅಂಗ", "Organ"), opt("ऊतक", "ಅಂಗಾಂಶ", "Tissue")],
         0),
        ("mcq", opt("कोशिका का पावरहाउस किसे कहते हैं?", "ಕೋಶದ ಶಕ್ತಿ ಕೇಂದ್ರ ಯಾವುದು?",
                    "Which part is called the powerhouse of the cell?"),
         [opt("नाभिक", "ನ್ಯೂಕ್ಲಿಯಸ್", "Nucleus"), opt("माइटोकॉन्ड्रिया", "ಮೈಟೋಕಾಂಡ್ರಿಯಾ", "Mitochondria"),
          opt("कोशिका भित्ति", "ಕೋಶ ಭಿತ್ತಿ", "Cell wall")], 1),
        ("true_false", opt("पौधों की कोशिकाओं में कोशिका भित्ति होती है।", "ಸಸ್ಯ ಕೋಶಗಳಲ್ಲಿ ಕೋಶ ಭಿತ್ತಿ ಇರುತ್ತದೆ.",
                           "Plant cells have a cell wall."), None, True),
        ("mcq", opt("कोशिका को नियंत्रित कौन करता है?", "ಕೋಶವನ್ನು ನಿಯಂತ್ರಿಸುವುದು ಯಾವುದು?",
                    "Which part controls the cell?"),
         [opt("नाभिक", "ನ್ಯೂಕ್ಲಿಯಸ್", "Nucleus"), opt("कोशिका झिल्ली", "ಕೋಶ ಪೊರೆ", "Cell membrane"),
          opt("रिक्तिका", "ರಸದಾನಿ", "Vacuole")], 0),
    ]),
    ("2. Force", "physics", "Push and Pull", [
        ("mcq", opt("धक्का या खिंचाव को क्या कहते हैं?", "ತಳ್ಳುವಿಕೆ ಅಥವಾ ಎಳೆಯುವಿಕೆಯನ್ನು ಏನೆಂದು ಕರೆಯುತ್ತಾರೆ?",
                    "What do we call a push or a pull?"),
         [opt("बल", "ಬಲ", "Force"), opt("ऊर्जा", "ಶಕ್ತಿ", "Energy"), opt("गति", "ವೇಗ", "Speed")], 0),
        ("true_false", opt("घर्षण चीज़ों को धीमा करता है।", "ಘರ್ಷಣೆ ವಸ್ತುಗಳನ್ನು ನಿಧಾನಗೊಳಿಸುತ್ತದೆ.",
                           "Friction slows things down."), None, True),
        ("mcq", opt("बल की इकाई क्या है?", "ಬಲದ ಏಕಮಾನ ಯಾವುದು?", "What is the unit of force?"),
         [opt("न्यूटन", "ನ್ಯೂಟನ್", "Newton"), opt("मीटर", "ಮೀಟರ್", "Metre"),
          opt("किलोग्राम", "ಕಿಲೋಗ್ರಾಂ", "Kilogram")], 0),
    ]),
]


def reset_demo(db: Connection) -> None:
    phones = [TEACHER_PHONE] + [p for _, p, _ in RIVALS]
    db.execute(text("delete from users where phone_e164 = any(:p)"), {"p": phones})


def seed_demo(db: Connection, student_phone: str, parent_phone: str | None) -> dict[str, Any]:
    """Wipe and recreate the demo. The call student starts 'waiting for consent'."""
    reset_demo(db)
    teacher = db.execute(text("insert into users(role, name, phone_e164) values "
                              "('teacher','Demo Teacher',:p) returning id"),
                         {"p": TEACHER_PHONE}).scalar_one()
    klass = db.execute(text("insert into classrooms(teacher_id, name, class_key) values "
                            "(:t,'Class 7 Science','DEMO7SCI') on conflict (class_key) do update "
                            "set teacher_id=:t returning id"), {"t": teacher}).scalar_one()
    for title, subject, lesson_title, questions in COURSES:
        course = db.execute(text("insert into courses(teacher_id, title, subject, status) values "
                                 "(:t,:n,:s,'published') returning id"),
                            {"t": teacher, "n": title, "s": subject}).scalar_one()
        unit = db.execute(text("insert into units(course_id, position, title) values (:c,1,:n) "
                               "returning id"), {"c": course, "n": lesson_title}).scalar_one()
        lesson = db.execute(text("insert into lessons(unit_id, position, title) values "
                                 "(:u,1,:n) returning id"), {"u": unit, "n": lesson_title}
                            ).scalar_one()
        for i, (kind, prompt, options, answer) in enumerate(questions):
            ans = options[answer] if options is not None and isinstance(answer, int) else answer
            db.execute(text(
                "insert into questions(lesson_id, kind, prompt, options, answer, concept, "
                "call_safe, position) values (:l,:k,cast(:p as jsonb),cast(:o as jsonb),"
                "cast(:a as jsonb),:c,true,:pos)"),
                {"l": lesson, "k": kind, "pos": i + 1, "p": json.dumps({**prompt, "regional": prompt["hi"],
                                                         "english": prompt["en"]},
                                                        ensure_ascii=False),
                 "o": json.dumps(options, ensure_ascii=False) if options else None,
                 "a": json.dumps(ans, ensure_ascii=False),
                 "c": "cell" if subject == "biology" else f"force{i}"})
        db.execute(text("insert into course_assignments values (:c,:k)"),
                   {"c": course, "k": klass})
    now = engine.utcnow()
    for name, phone, xp in RIVALS:
        uid = db.execute(text("insert into users(role, name, phone_e164) values "
                              "('student',:n,:p) returning id"), {"n": name, "p": phone}
                         ).scalar_one()
        lid = create_learner(db, user_id=uid)
        db.execute(text("insert into memberships values (:c,:u)"), {"c": klass, "u": uid})
        db.execute(text("update student_stats set xp=:x where learner_id=:l"), {"x": xp, "l": lid})
        leagues.add_xp(db, lid, xp, "bronze", now)
    cs = db.execute(text(
        "insert into call_students(classroom_id, name, phone_e164, language, parent_phone_e164, "
        "window_start, window_end) values (:k,'Ananya',:p,'hi',:pp,'09:00','21:00') returning id"),
        {"k": klass, "p": normalize_phone(student_phone),
         "pp": normalize_phone(parent_phone) if parent_phone else None}).scalar_one()
    learner = create_learner(db, call_student_id=cs)
    return {"teacher_id": str(teacher), "classroom_id": str(klass), "call_student_id": str(cs),
            "learner_id": str(learner)}
