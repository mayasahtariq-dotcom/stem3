"""Lesson kinds, terms, saved terms and doubt chat."""
from fastapi.testclient import TestClient
from sqlalchemy import Connection, text

from tests.conftest import needs_db
from tests.helpers import make_user

pytestmark = needs_db

CONTENT = {
    "units": [{"title": "Cells", "lessons": [
        {"title": "Watch", "kind": "video", "content": {"url": "https://example.test/cell.mp4",
                                                         "transcript": {"en": "Cells are tiny."}}},
        {"title": "Read", "kind": "reading", "content": {"body": {"en": "The nucleus controls."}}},
        {"title": "Quiz", "questions": [{"kind": "mcq", "prompt": {"en": "Smallest unit?"},
                                         "options": ["Cell", "Organ"], "answer": "Cell"}]}]}],
    "terms": [{"regional": "कोशिका", "english": "Cell",
               "definition": {"en": "The smallest unit of life."}}],
}


def setup(conn: Connection, client: TestClient) -> tuple[dict[str, str], str]:
    t = make_user(conn, "teacher")
    cls = client.post("/v1/classrooms", headers=t["headers"], json={"name": "7A"}).json()
    course = client.post("/v1/courses", headers=t["headers"],
                         json={"title": "Cells", "subject": "biology"}).json()["id"]
    client.post(f"/v1/courses/{course}/content", headers=t["headers"], json=CONTENT)
    client.post(f"/v1/courses/{course}/publish", headers=t["headers"])
    client.post(f"/v1/courses/{course}/assign", headers=t["headers"],
                json={"classroom_id": cls["id"]})
    s = make_user(conn, "student", "Ravi")
    client.post("/v1/classrooms/join", headers=s["headers"], json={"class_key": cls["class_key"]})
    conn.execute(text("insert into consent_records(learner_id, given_by, granted) values "
                      "(:l,'school',true)"), {"l": s["learner"]})
    return s["headers"], course


def test_video_and_reading_lessons(conn: Connection, client: TestClient) -> None:
    h, course = setup(conn, client)
    path = client.get(f"/v1/courses/{course}/path", headers=h).json()
    kinds = [le["kind"] for le in path["units"][0]["lessons"]]
    assert kinds == ["video", "reading", "quiz"]
    first = path["units"][0]["lessons"][0]["id"]
    started = client.post(f"/v1/lessons/{first}/start", headers=h).json()
    assert started["lesson"]["kind"] == "video" and started["questions"] == []
    assert started["lesson"]["content"]["url"].endswith("cell.mp4")
    done = client.post(f"/v1/lessons/{first}/complete", headers=h)
    assert done.status_code == 200 and done.json()["xp_gained"] >= 20


def test_terms_saved_terms_and_doubts(conn: Connection, client: TestClient) -> None:
    h, course = setup(conn, client)
    terms = client.get(f"/v1/courses/{course}/terms", headers=h).json()
    assert terms[0]["english"] == "Cell" and terms[0]["saved"] is False
    assert client.post(f"/v1/terms/{terms[0]['id']}/save", headers=h).status_code == 204
    assert client.get("/v1/me/saved-terms", headers=h).json()[0]["english"] == "Cell"
    a = client.post("/v1/doubts", headers=h, json={"text": "What is a cell?"}).json()
    assert "smallest unit" in a["answer"] and a["citation"]["course"] == "Cells"
    miss = client.post("/v1/doubts", headers=h, json={"text": "Why is the sky blue?"}).json()
    assert miss["citation"] is None
    assert len(client.get("/v1/doubts", headers=h).json()) == 2


def test_dev_otp_only_in_demo_with_fake_sms(client: TestClient, monkeypatch: object) -> None:
    from app.config import Settings
    mp = monkeypatch
    mp.setattr("app.routers.auth.get_settings",  # type: ignore[attr-defined]
               lambda: Settings(demo_mode=True, use_fake_sms=True))
    r = client.post("/v1/auth/otp", json={"phone": "9876512399"}).json()
    assert r["sent"] and len(r["dev_code"]) == 6
    mp.setattr("app.routers.auth.get_settings",  # type: ignore[attr-defined]
               lambda: Settings(demo_mode=False, use_fake_sms=True))
    assert client.post("/v1/auth/otp", json={"phone": "9876512398"}).json()["dev_code"] is None
