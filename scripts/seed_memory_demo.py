"""Seed the memory graph with a realistic batch of source documents.

The memory graph is *derived* from text in `check_in.adherence_notes`,
`run.memo`, `profile.notes`, and `biomarker.name`. A fresh DB only has
~12 entities, so the force-directed viz looks thin. This script writes
~30 check-ins, a multi-paragraph profile note, two run memos, and a
handful of biomarkers — then wipes `personal_entity`/`entity_mention`
and re-runs the extractor.

Idempotent: check-in days, biomarker (name, day) pairs, and run task_ids
are skipped on re-run; the profile note is upserted.

Usage:
    uv run python -m scripts.seed_memory_demo
"""

from __future__ import annotations

import datetime as dt
import time
import uuid

from backend.db import (
    _connect,
    add_check_in_sync,
    init_schema_sync,
    upsert_profile_sync,
)
from backend.personal_entities import (
    clear_entities_sync,
    index_existing_data_sync,
)


PROFILE_NOTE = """\
38yo, male, generally healthy but flagged for elevated fasting glucose
and borderline LDL cholesterol at my last visit with Dr. Patel.
Family history of T2 diabetes risk on my mom's side; mom also sees
the cardiologist quarterly. Currently working with Sara, my dietitian,
on an elimination diet block focused on more leafy greens, salmon,
and lentils, and pulling back on processed carbs.

Daily supplement stack: Vitamin D, magnesium, omega-3, and a B-complex.
Started melatonin recently for sleep. Workouts split between Equinox
(lifting Tuesday/Thursday) and cycling outdoors with my brother on
weekends. Lower back pain has been my main nuisance for two years —
yoga twice a week has helped more than ibuprofen ever did.

Watching HbA1c, LDL cholesterol, HDL cholesterol, and 25-Hydroxyvitamin D
quarterly. Annual full panel includes Ferritin and TSH.
"""


CHECK_INS = [
    # (days_ago, energy, sleep_hours, mood, adherence_notes)
    # Energy + mood are on the UI's 1–5 scale (matches the SCALE constant in
    # Today.tsx and CheckIn.tsx). 2 = rough day, 5 = great day.
    (40, 4, 7.5, 4, "Took Vitamin D, magnesium, and omega-3 with breakfast. Cycled to Equinox before work. Salmon and kale for dinner with my partner."),
    (39, 3, 6.0, 3, "Skipped melatonin and slept badly. Back pain flared during the morning meeting — took two ibuprofen, regret it. Yoga at lunch helped."),
    (38, 5, 8.0, 5, "Long hike with my brother out by the lake house. Packed sardines and oats. Energy felt great. Mom called about her cardiologist appointment."),
    (37, 2, 5.5, 2, "Rough sleep again. Fatigue all morning. Did a 20-minute easy run anyway. Logged my fasting glucose — still trending high."),
    (36, 4, 7.0, 4, "Met with Dr. Patel. She wants me to keep going on the elimination diet and add probiotics. Cut back on ibuprofen for the lower back pain."),
    (35, 3, 6.5, 3, "Equinox lifting day. Took magnesium post-workout. Lentil soup for dinner. My partner made blueberry crumble — too good to resist."),
    (34, 4, 7.5, 4, "Yoga in the morning helped the back. Sara, my dietitian, sent a new meal plan with more leafy greens and fortified dairy."),
    (33, 5, 8.0, 5, "Slept 8 hours, took melatonin. Big run in the park before brunch. Felt strong. Salmon and broccoli for lunch."),
    (32, 3, 6.0, 4, "Energy mid. Vitamin D and Vitamin C with breakfast. Quick swim at Equinox. Mom mentioned my brother's new running coach Jamie."),
    (31, 4, 7.0, 4, "Cycled with my brother along the lake. Sore quads. Iron-rich dinner: lentils, leafy greens, sardines. Took zinc before bed."),
    (30, 2, 5.0, 2, "Anxiety symptoms creeping in. Slept poorly. Skipped melatonin. Mom called about her sertraline switch — said her cardiologist approved."),
    (28, 4, 7.5, 4, "Yoga + lifting combo day at Equinox. Back feels best when I stack both. Salmon and oats."),
    (27, 5, 8.5, 5, "Banff trip planning with my partner. Hiking and cycling itinerary mapped. Stocked up on Vitamin D, omega-3, magnesium for the road."),
    (26, 3, 6.5, 3, "Logged HbA1c and LDL cholesterol from yesterday's draw. HDL cholesterol looks better than last quarter — Dr. Patel will be pleased."),
    (25, 4, 7.0, 4, "Long cycling session outside. Pulled an oat-and-blueberry bowl after. My partner joined for yoga in the evening."),
    (24, 5, 8.0, 5, "Felt sharp all day. Melatonin worked, slept clean. Lifted at Equinox. Salmon, kale, and brown rice for dinner."),
    (23, 3, 6.0, 3, "Lower back pain returned mid-day. Iced it. Skipped lifting, did yoga instead. Took magnesium before bed."),
    (22, 4, 7.0, 4, "Mom's cardiologist appointment went well. She's adding fish oil and Vitamin B12. Reminded me to refill my probiotics."),
    (21, 2, 5.5, 2, "Bad sleep. Energy in the basement. Fatigue all afternoon. Forced an easy run to reset. Lentils and broccoli for dinner."),
    (20, 4, 7.5, 4, "Yoga twice today — once in the park, once at home with my partner. Back never felt better. No ibuprofen needed."),
    (19, 5, 8.0, 5, "Cycled to the office. Lifted at Equinox after work. Sleep last night was deep — magnesium and melatonin combo seems to be the move."),
    (18, 3, 6.5, 3, "Sara updated my meal plan: more sardines, more leafy greens, less processed carbs. Coach Jamie wants me running 3x a week."),
    (17, 4, 7.0, 4, "Vitamin D, omega-3, zinc, probiotics. Big salmon dinner with my brother. Talked about the Banff trip route."),
    (16, 4, 7.5, 4, "Yoga + run morning. Felt the elimination diet kick in — energy steadier. Took ferritin-watcher iron with dinner."),
    (15, 5, 8.0, 5, "Equinox heavy lifting. Lower back held up. Oats and blueberries for breakfast. Mom called from the cardiologist's office."),
    (14, 2, 5.0, 2, "Anxiety symptoms again. Sleep was 5 hours. Skipped Equinox. Slow yoga in the park, then leafy greens for lunch."),
    (12, 4, 7.0, 4, "Dr. Patel reviewed my Vitamin D level — back in range. Keeping the stack: Vitamin D, magnesium, omega-3, B12."),
    (10, 5, 8.5, 5, "Banff weekend. Hiking, cycling, cold lake swims. Ate well — salmon, lentils, oats. Slept like a rock."),
    (7, 4, 7.5, 4, "Back at Equinox after the trip. Lifting felt fresh. My partner cooked broccoli and sardines. Took magnesium before bed."),
    (4, 3, 6.5, 3, "Lower back pain mild. Yoga helped. Logged TSH from this morning's lab. Coach Jamie sent a new running block — spring training."),
    (2, 4, 7.0, 4, "Solid run in the park with my brother. Salmon, leafy greens, blueberries. Zinc and Vitamin C before bed."),
    (1, 5, 8.0, 5, "Felt great. Yoga, lifting, salmon, oats. Mom called — her sertraline switch is going well. Cardiologist is happy."),
]


RUN_MEMOS = [
    # (idea, memo)
    (
        "Build a 30-day plan to lower fasting glucose",
        "Plan focuses on the elimination diet block Sara recommended: more "
        "leafy greens, salmon, lentils, sardines; less processed carbs. "
        "Daily Vitamin D + magnesium + omega-3, melatonin for sleep, and a "
        "yoga + cycling rhythm to manage lower back pain. Dr. Patel will "
        "review HbA1c and LDL cholesterol at the 30-day mark.",
    ),
    (
        "Banff weekend prep — supplements, food, routes",
        "Packing list: Vitamin D, magnesium, omega-3, probiotics, melatonin. "
        "Meal plan emphasizes oats, blueberries, salmon, lentils. Coach Jamie "
        "approved a light running block. Cycling and hiking with my brother; "
        "cold lake swim each morning. Skip ibuprofen, stick to yoga for the back.",
    ),
]


BIOMARKERS = [
    # (name, value, unit, ref_range, flag, days_ago)
    ("Hemoglobin A1c", "5.9", "%", "<5.7", "high", 12),
    ("LDL cholesterol", "138", "mg/dL", "<100", "high", 12),
    ("HDL cholesterol", "52", "mg/dL", ">40", "normal", 12),
    ("25-Hydroxyvitamin D", "34", "ng/mL", "30-100", "normal", 12),
    ("Ferritin", "78", "ng/mL", "30-400", "normal", 12),
    ("TSH (Thyroid stimulating hormone)", "2.1", "mIU/L", "0.4-4.5", "normal", 4),
]


def _day_str(days_ago: int) -> str:
    return (dt.date.today() - dt.timedelta(days=days_ago)).isoformat()


def _seed_profile() -> int:
    existing = None
    with _connect() as conn:
        row = conn.execute("SELECT id, name, dob, sex, height_cm, weight_kg FROM profile LIMIT 1").fetchone()
        if row:
            existing = dict(row)
    payload = {
        "name": (existing or {}).get("name") or "Demo User",
        "dob": (existing or {}).get("dob") or "1987-06-15",
        "sex": (existing or {}).get("sex") or "male",
        "height_cm": (existing or {}).get("height_cm") or 180.0,
        "weight_kg": (existing or {}).get("weight_kg") or 82.0,
        "notes": PROFILE_NOTE,
    }
    saved = upsert_profile_sync(payload)
    return saved["id"]


def _seed_check_ins(profile_id: int) -> tuple[int, int]:
    inserted = 0
    skipped = 0
    with _connect() as conn:
        existing_days = {
            r["day"] for r in conn.execute("SELECT day FROM check_in").fetchall()
        }
    for days_ago, energy, sleep_hours, mood, notes in CHECK_INS:
        day = _day_str(days_ago)
        if day in existing_days:
            skipped += 1
            continue
        add_check_in_sync({
            "profile_id": profile_id,
            "day": day,
            "energy": energy,
            "sleep_hours": sleep_hours,
            "mood": mood,
            "adherence_notes": notes,
        })
        inserted += 1
    return inserted, skipped


def _seed_run_memos() -> tuple[int, int]:
    inserted = 0
    skipped = 0
    with _connect() as conn:
        existing_ideas = {
            r["idea"]
            for r in conn.execute(
                "SELECT idea FROM run WHERE idea IS NOT NULL"
            ).fetchall()
        }
        for idea, memo in RUN_MEMOS:
            if idea in existing_ideas:
                skipped += 1
                continue
            task_id = f"seed-{uuid.uuid4().hex[:12]}"
            now = time.time()
            conn.execute(
                "INSERT INTO run(task_id, profile_id, started_at, ended_at, "
                "status, idea, memo, cost_usd, model_backend) "
                "VALUES(?, NULL, ?, ?, 'done', ?, ?, 0, 'seed')",
                (task_id, now, now, idea, memo),
            )
            inserted += 1
        conn.commit()
    return inserted, skipped


def _seed_biomarkers(profile_id: int) -> tuple[int, int]:
    inserted = 0
    skipped = 0
    with _connect() as conn:
        for name, value, unit, ref_range, flag, days_ago in BIOMARKERS:
            day = _day_str(days_ago)
            row = conn.execute(
                "SELECT 1 FROM biomarker WHERE name = ? "
                "AND DATE(recorded_at, 'unixepoch') = ?",
                (name, day),
            ).fetchone()
            if row:
                skipped += 1
                continue
            recorded_at = time.mktime(
                time.strptime(day + " 09:00", "%Y-%m-%d %H:%M")
            )
            conn.execute(
                "INSERT INTO biomarker(profile_id, name, value, unit, ref_range, "
                "flag, recorded_at) VALUES(?, ?, ?, ?, ?, ?, ?)",
                (profile_id, name, value, unit, ref_range, flag, recorded_at),
            )
            inserted += 1
        conn.commit()
    return inserted, skipped


def main() -> int:
    init_schema_sync()
    profile_id = _seed_profile()
    chk_ins, chk_skip = _seed_check_ins(profile_id)
    run_ins, run_skip = _seed_run_memos()
    bio_ins, bio_skip = _seed_biomarkers(profile_id)

    print(f"profile      : upserted (id={profile_id})")
    print(f"check-ins    : +{chk_ins} inserted, {chk_skip} skipped (already present)")
    print(f"run memos    : +{run_ins} inserted, {run_skip} skipped")
    print(f"biomarkers   : +{bio_ins} inserted, {bio_skip} skipped")

    print("clearing personal_entity + entity_mention and reindexing…")
    clear_entities_sync()
    counts = index_existing_data_sync()

    with _connect() as conn:
        n_entities = conn.execute("SELECT COUNT(*) FROM personal_entity").fetchone()[0]
        n_mentions = conn.execute("SELECT COUNT(*) FROM entity_mention").fetchone()[0]

    print(
        f"indexed      : run_memos={counts['run_memos']} "
        f"check_ins={counts['check_ins']} "
        f"profile={counts['profile']} "
        f"biomarkers={counts['biomarkers']}"
    )
    print(f"final graph  : {n_entities} entities, {n_mentions} mentions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
