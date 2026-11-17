from collections.abc import Callable
from typing import Annotated, Any

from fastapi import Depends, HTTPException
from sqlalchemy import Connection, text

from app.db.session import get_db
from app.routers.auth import UserOut, current_user

DbDep = Annotated[Connection, Depends(get_db)]
UserDep = Annotated[UserOut, Depends(current_user)]


def require_role(*roles: str) -> Callable[[UserOut], UserOut]:
    def dep(user: UserDep) -> UserOut:
        if user.role not in roles:
            raise HTTPException(403, "Not allowed for this account")
        return user

    return dep


Student = Annotated[UserOut, Depends(require_role("student"))]
Teacher = Annotated[UserOut, Depends(require_role("teacher"))]
Parent = Annotated[UserOut, Depends(require_role("parent"))]


def learner_id_for(db: Connection, user_id: str) -> Any:
    lid = db.execute(text("select id from learners where user_id=:u"), {"u": user_id}).scalar()
    if lid is None:
        raise HTTPException(404, "No learner profile")
    return lid


def has_consent(db: Connection, learner_id: Any) -> bool:
    """Latest consent record wins; otherwise a school-wide consent for the learner's class."""
    row = db.execute(text("select granted from consent_records where learner_id=:l "
                          "order by created_at desc limit 1"), {"l": learner_id}).scalar()
    if row is not None:
        return bool(row)
    return bool(db.execute(text(
        "select exists (select 1 from learners x join memberships m on m.user_id = x.user_id "
        "join classrooms c on c.id = m.classroom_id where x.id=:l and c.school_consent)"),
        {"l": learner_id}).scalar())
