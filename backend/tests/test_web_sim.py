"""Browser phone simulator: answers tagged PHONE_SIMULATOR on the same student, session log, channel views."""
from fastapi.testclient import TestClient
from sqlalchemy import Connection, text

from app.auth.tokens import issue_token
from tests.conftest import needs_db
from tests.helpers import make_world

pytestmark = needs_db


def test_simulator_lesson_counts_for_the_same_student(conn: Connection, client: TestClient) -> None:
    w = make_world(conn, n_lessons=1)
    sid, tid, lesson = w["student"]["id"], w["teacher"]["id"], w["lessons"][0]
    h = {"Authorization": f"Bearer {issue_token(sid, 'student')}"}
    t = {"Authorization": f"Bearer {issue_token(tid, 'teacher')}"}
    lid = w["student"]["learner"]

    s = client.post("/web/sim/sessions", headers=h, json={"lesson_id": lesson})
    assert s.status_code == 201, s.text
    session = s.json()["id"]
    qs = client.post(f"/web/lessons/{lesson}/start", headers=h).json()["lesson"]["questions"]
    sim = h | {"X-Channel": "phone_simulator"}
    first = client.post("/web/attempts", headers=sim,
                        json={"question_id": qs[0]["id"], "answer": {"index": 0}}).json()
    assert first["correct"] is True
    for q in qs[1:]:                    # wrong first, then right on the retry (as the simulator re-asks)
        client.post("/web/attempts", headers=sim, json={"question_id": q["id"], "answer": {"index": 1}})
        client.post("/web/attempts", headers=sim,
                    json={"question_id": q["id"], "answer": {"index": 0}, "retry": True})
    assert client.post(f"/web/lessons/{lesson}/complete", headers=h).status_code == 200
    patch = {"status": "completed", "answered": len(qs), "correct": 1, "incorrect": len(qs) - 1,
             "question_index": len(qs), "question_count": len(qs), "lessons_completed": 1, "seconds": 95}
    assert client.patch(f"/web/sim/sessions/{session}", headers=h, json=patch).status_code == 200
    # a finished call can't be counted twice
    assert client.patch(f"/web/sim/sessions/{session}", headers=h, json=patch).status_code == 409

    chans = conn.execute(text("select distinct channel from answer_attempts where learner_id=:l"),
                         {"l": lid}).scalars().all()
    assert chans == ["phone_simulator"]
    # the app sees the same progress: the lesson is done and XP went up
    path = client.get(f"/web/courses/{w['course']}/path", headers=h).json()
    assert path["units"][0]["lessons"][0]["state"] == "done"
    assert client.get("/web/me/stats", headers=h).json()["xp_total"] > 0

    act = client.get(f"/web/classrooms/{w['classroom']}/sim-activity", headers=t).json()
    assert act["simulator_users"] == 1 and act["sessions"] == 1 and act["lessons_completed"] == 1
    answers = 2 * len(qs) - 1
    assert act["correct"] == len(qs) and act["incorrect"] == len(qs) - 1 and act["call_seconds"] == 95
    assert act["channels"]["phone_simulator"] == {"answers": answers, "lessons": 1}
    assert act["channels"]["app"]["lessons"] == 0
    assert act["recent"][0]["status"] == "completed"
    # another teacher can't see this class; a student can't read teacher views
    assert client.get(f"/web/classrooms/{w['classroom']}/sim-activity", headers=h).status_code == 403


def test_hung_up_call_is_interrupted(conn: Connection, client: TestClient) -> None:
    w = make_world(conn, n_lessons=1)
    h = {"Authorization": f"Bearer {issue_token(w['student']['id'], 'student')}"}
    t = {"Authorization": f"Bearer {issue_token(w['teacher']['id'], 'teacher')}"}
    session = client.post("/web/sim/sessions", headers=h, json={"lesson_id": w["lessons"][0]}).json()["id"]
    client.patch(f"/web/sim/sessions/{session}", headers=h,
                 json={"status": "ended", "answered": 1, "correct": 0, "incorrect": 1, "question_index": 1,
                       "question_count": 3, "lessons_completed": 0, "seconds": 20})
    act = client.get(f"/web/classrooms/{w['classroom']}/sim-activity", headers=t).json()
    assert act["interrupted"] == 1 and act["recent"][0]["status"] == "interrupted"
    assert client.patch(f"/web/sim/sessions/{session}x", headers=h, json={}).status_code == 422


class StubLLM:
    def generate_json(self, prompt: str, schema: object, system: str | None = None) -> dict[str, str]:
        return {"en": prompt, "hi": "पौधे भोजन बनाते हैं", "kn": "ಸಸ್ಯಗಳು ಆಹಾರ ಮಾಡುತ್ತವೆ"}


def test_voice_lines_are_spoken_in_the_student_language(conn: Connection) -> None:
    from app.titles import in_language
    assert in_language(conn, StubLLM(), "Plants make food", "kn") == "ಸಸ್ಯಗಳು ಆಹಾರ ಮಾಡುತ್ತವೆ"
    assert in_language(conn, StubLLM(), "पहले से हिंदी", "hi") == "पहले से हिंदी"     # already Hindi: unchanged


def test_parent_link_code_has_six_characters(conn: Connection, client: TestClient) -> None:
    w = make_world(conn, n_lessons=1)
    h = {"Authorization": f"Bearer {issue_token(w['student']['id'], 'student')}"}
    assert len(client.post("/web/me/link-code", headers=h).json()["code"]) == 6
