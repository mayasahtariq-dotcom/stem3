"""M6 (classes, publish, dashboard) and M7 (parent, consent, deletion, call students)."""
from fastapi.testclient import TestClient
from sqlalchemy import Connection, text

from tests.conftest import needs_db
from tests.helpers import make_user, make_world

pytestmark = needs_db

CONTENT = {"units": [{"title": "Cells", "lessons": [{"title": "Intro", "questions": [
    {"kind": "mcq", "prompt": {"regional": "?", "english": "Powerhouse?"},
     "options": ["Nucleus", "Mitochondria"], "answer": "Mitochondria", "concept": "cell",
     "flagged": False},
    {"kind": "true_false", "prompt": {"regional": "?", "english": "Plants have cells"},
     "answer": True, "concept": "cell", "flagged": True}]}]}]}


def test_teacher_builds_publishes_and_student_joins(conn: Connection, client: TestClient) -> None:
    t = make_user(conn, "teacher")
    h = t["headers"]
    cls = client.post("/v1/classrooms", headers=h, json={"name": "8A"}).json()
    course = client.post("/v1/courses", headers=h,
                         json={"title": "Cells", "subject": "biology"}).json()["id"]
    assert client.post(f"/v1/courses/{course}/publish", headers=h).status_code == 409  # empty
    assert client.post(f"/v1/courses/{course}/content", headers=h, json=CONTENT).json() == {
        "units": 1, "questions": 2}
    review = client.get(f"/v1/courses/{course}", headers=h).json()
    qs = review["units"][0]["lessons"][0]["questions"]
    assert qs[0]["flagged"] is True                    # flagged questions come first
    # editing a flagged question marks it reviewed
    client.patch(f"/v1/questions/{qs[0]['id']}", headers=h, json={"concept": "plants"})
    again = client.get(f"/v1/courses/{course}", headers=h).json()
    assert all(not q["flagged"] for q in again["units"][0]["lessons"][0]["questions"])
    assert client.post(f"/v1/courses/{course}/publish", headers=h).json()["status"] == "published"
    assert client.post(f"/v1/courses/{course}/assign", headers=h,
                       json={"classroom_id": cls["id"]}).status_code == 200

    s = make_user(conn, "student", "Meena")
    assert client.post("/v1/classrooms/join", headers=s["headers"],
                       json={"class_key": cls["class_key"].lower()}).status_code == 200
    assert client.post("/v1/classrooms/join", headers=s["headers"],
                       json={"class_key": "NOPE"}).status_code == 404
    home = client.get("/v1/home", headers=s["headers"]).json()
    assert home["continue"]["lesson_title"] == "Intro"

    dash = client.get(f"/v1/classrooms/{cls['id']}/dashboard", headers=h).json()
    assert [x["name"] for x in dash["students"]] == ["Meena"] and dash["students"][0]["idle"]
    assert client.patch(f"/v1/classrooms/{cls['id']}", headers=h,
                        json={"league_enabled": False}).json()["league_enabled"] is False


def test_teachers_only_see_their_own_things(conn: Connection, client: TestClient) -> None:
    a, b = make_world(conn), make_world(conn)
    assert client.get(f"/v1/classrooms/{a['classroom']}/dashboard",
                      headers=b["teacher"]["headers"]).status_code == 404
    assert client.get(f"/v1/courses/{a['course']}",
                      headers=b["teacher"]["headers"]).status_code == 404
    assert client.get(f"/v1/classrooms/{a['classroom']}/dashboard",
                      headers=a["student"]["headers"]).status_code == 403


def test_call_student_records_and_consent(conn: Connection, client: TestClient) -> None:
    w = make_world(conn)
    th, c = w["teacher"]["headers"], w["classroom"]
    bad = client.post(f"/v1/classrooms/{c}/call-students", headers=th, json={
        "name": "Kid", "phone": "9876543210", "language": "kn", "window_start": "08:00:00"})
    assert bad.status_code == 422                                    # outside 9 am to 9 pm
    ok = client.post(f"/v1/classrooms/{c}/call-students", headers=th, json={
        "name": "Kid", "phone": "9876543210", "language": "kn"})
    assert ok.status_code == 201 and ok.json()["status"] == "waiting_consent"
    csid, lid = ok.json()["id"], ok.json()["learner_id"]
    dash = client.get(f"/v1/classrooms/{c}/dashboard", headers=th).json()
    assert dash["call_only_students"] == ["Kid"]

    code = client.post(f"/v1/call-students/{csid}/link-code", headers=th).json()["code"]
    parent = make_user(conn, "parent", "Mum")
    assert client.post("/v1/parent/link", headers=parent["headers"],
                       json={"code": code}).json()["learner_id"] == lid
    assert client.post("/v1/parent/link", headers=parent["headers"],
                       json={"code": code}).status_code == 404       # one-time code
    client.post("/v1/parent/consent", headers=parent["headers"],
                json={"learner_id": lid, "granted": True})
    rows = client.get(f"/v1/classrooms/{c}/call-students", headers=th).json()
    assert rows[0]["status"] == "active"
    r = client.patch(f"/v1/call-students/{csid}", headers=th, json={"paused": True})
    assert r.json()["status"] == "paused"


def test_parent_summary_consent_and_deletion(conn: Connection, client: TestClient) -> None:
    w = make_world(conn)
    s, lid = w["student"], w["student"]["learner"]
    conn.execute(text("insert into doubts(learner_id, text) values (:l,'private question')"),
                 {"l": lid})
    code = client.post("/v1/me/link-code", headers=s["headers"]).json()["code"]
    parent, stranger = make_user(conn, "parent"), make_user(conn, "parent")
    client.post("/v1/parent/link", headers=parent["headers"], json={"code": code})
    kids = client.get("/v1/parent/children", headers=parent["headers"]).json()
    assert [k["name"] for k in kids] == ["Ravi"]
    summary = client.get(f"/v1/parent/children/{lid}/summary", headers=parent["headers"])
    assert summary.status_code == 200 and "private question" not in summary.text
    assert client.get(f"/v1/parent/children/{lid}/summary",
                      headers=stranger["headers"]).status_code == 404

    client.post("/v1/parent/consent", headers=parent["headers"],
                json={"learner_id": str(lid), "granted": False})          # revoke
    blocked = client.post(f"/v1/lessons/{w['lessons'][0]}/start", headers=s["headers"])
    assert blocked.status_code == 403

    done = client.post("/v1/parent/deletion", headers=parent["headers"],
                       json={"learner_id": str(lid)})
    assert done.json() == {"status": "done"}
    left = conn.execute(text("select (select count(*) from users where id=:u) + "
                             "(select count(*) from student_stats where learner_id=:l) + "
                             "(select count(*) from doubts where learner_id=:l)"),
                        {"u": s["id"], "l": lid}).scalar_one()
    assert left == 0
    assert conn.execute(text("select count(*) from audit_log where action='learner_deleted'")
                        ).scalar_one() >= 1
