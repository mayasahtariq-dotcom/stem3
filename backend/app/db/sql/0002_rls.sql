-- Row-level security. Backend connects as a privileged role (bypasses RLS) and owns all writes;
-- these policies protect direct client access. Clients get SELECT only.
create schema if not exists private;

create function private.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub'
  )::uuid
$$;

create function private.is_teacher_of_classroom(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from classrooms where id = c and teacher_id = private.uid())
$$;

create function private.can_read_learner(l uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from learners x where x.id = l and (
      x.user_id = private.uid()
      or exists (select 1 from parent_links p where p.parent_id = private.uid() and p.learner_id = x.id)
      or exists (select 1 from memberships m join classrooms c on c.id = m.classroom_id
                 where m.user_id = x.user_id and c.teacher_id = private.uid())
      or exists (select 1 from call_students cs join classrooms c on c.id = cs.classroom_id
                 where cs.id = x.call_student_id and c.teacher_id = private.uid())
    ))
$$;

create function private.is_own_learner(l uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from learners where id = l and user_id = private.uid())
$$;

create function private.can_read_course(co uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from courses c where c.id = co and (
    c.teacher_id = private.uid()
    or (c.status = 'published' and exists (
        select 1 from course_assignments a join memberships m on m.classroom_id = a.classroom_id
        where a.course_id = c.id and m.user_id = private.uid()))))
$$;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

-- helper to grant select + policy
-- People
grant select on users, classrooms, memberships, call_students, learners, parent_links,
  consent_records to authenticated;
create policy users_read on users for select to authenticated using (
  id = private.uid()
  or exists (select 1 from learners l where l.user_id = users.id and private.can_read_learner(l.id)));
create policy classrooms_read on classrooms for select to authenticated using (
  teacher_id = private.uid()
  or exists (select 1 from memberships m where m.classroom_id = classrooms.id and m.user_id = private.uid()));
create policy memberships_read on memberships for select to authenticated using (
  user_id = private.uid() or private.is_teacher_of_classroom(classroom_id));
create policy call_students_read on call_students for select to authenticated using (
  private.is_teacher_of_classroom(classroom_id));
create policy learners_read on learners for select to authenticated using (private.can_read_learner(id));
create policy parent_links_read on parent_links for select to authenticated using (parent_id = private.uid());
create policy consent_read on consent_records for select to authenticated using (private.can_read_learner(learner_id));

-- Content
grant select on courses, units, lessons, terms, course_assignments to authenticated;
create policy courses_read on courses for select to authenticated using (private.can_read_course(id));
create policy units_read on units for select to authenticated using (private.can_read_course(course_id));
create policy lessons_read on lessons for select to authenticated using (
  exists (select 1 from units u where u.id = lessons.unit_id and private.can_read_course(u.course_id)));
create policy terms_read on terms for select to authenticated using (private.can_read_course(course_id));
create policy assignments_read on course_assignments for select to authenticated using (
  private.is_teacher_of_classroom(classroom_id) or private.can_read_course(course_id));
-- questions (holds answers) and uploads: teacher only; students get questions via the API
grant select on questions, uploads, upload_pages to authenticated;
create policy questions_teacher on questions for select to authenticated using (
  exists (select 1 from lessons l join units u on u.id = l.unit_id join courses c on c.id = u.course_id
          where l.id = questions.lesson_id and c.teacher_id = private.uid()));
create policy uploads_teacher on uploads for select to authenticated using (teacher_id = private.uid());
create policy upload_pages_teacher on upload_pages for select to authenticated using (
  exists (select 1 from uploads u where u.id = upload_pages.upload_id and u.teacher_id = private.uid()));

-- Learning / twin / game: learner, teacher of their class, linked parent
grant select on answer_attempts, lesson_progress, twin_concepts, twin_confusions, student_stats,
  gems_ledger, quest_progress, badge_awards, mascot_state, pot_opens, league_scores to authenticated;
create policy attempts_read on answer_attempts for select to authenticated using (private.can_read_learner(learner_id));
create policy progress_read on lesson_progress for select to authenticated using (private.can_read_learner(learner_id));
create policy twin_c_read on twin_concepts for select to authenticated using (private.can_read_learner(learner_id));
create policy twin_f_read on twin_confusions for select to authenticated using (private.can_read_learner(learner_id));
create policy stats_read on student_stats for select to authenticated using (private.can_read_learner(learner_id));
create policy gems_read on gems_ledger for select to authenticated using (private.can_read_learner(learner_id));
create policy quest_p_read on quest_progress for select to authenticated using (private.can_read_learner(learner_id));
create policy badge_a_read on badge_awards for select to authenticated using (private.can_read_learner(learner_id));
create policy mascot_read on mascot_state for select to authenticated using (private.can_read_learner(learner_id));
create policy pots_read on pot_opens for select to authenticated using (private.can_read_learner(learner_id));
create policy league_s_read on league_scores for select to authenticated using (private.can_read_learner(learner_id));

-- Doubts and saved terms: the learner only (never teacher or parent)
grant select on doubts, saved_terms to authenticated;
create policy doubts_own on doubts for select to authenticated using (private.is_own_learner(learner_id));
create policy saved_own on saved_terms for select to authenticated using (private.is_own_learner(learner_id));

-- Reference data readable by any signed-in user
grant select on quests, badges to authenticated;
create policy quests_read on quests for select to authenticated using (true);
create policy badges_read on badges for select to authenticated using (true);

-- Calls: teacher of the class only
grant select on call_sessions, call_events to authenticated;
create policy sessions_teacher on call_sessions for select to authenticated using (
  exists (select 1 from call_students cs where cs.id = call_sessions.call_student_id
          and private.is_teacher_of_classroom(cs.classroom_id)));
create policy events_teacher on call_events for select to authenticated using (
  exists (select 1 from call_sessions s join call_students cs on cs.id = s.call_student_id
          where s.id = call_events.session_id and private.is_teacher_of_classroom(cs.classroom_id)));
-- No policies (no client access): deletion_requests, link_codes, audio_cache, call_audio,
-- audit_log, leagues, league_pods. Backend only.
