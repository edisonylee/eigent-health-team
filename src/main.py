"""CLI entry point.

    python -m src.main "34, desk job, want more energy and to lose 10 lbs"

Runs the four-agent Workforce and writes the resulting health plan to outputs/.
This is educational information, not medical advice.
"""

import datetime
import pathlib
import sys

from dotenv import load_dotenv

from camel.tasks import Task

from .workforce import build_workforce


def _slug(profile: str) -> str:
    words = "".join(c if c.isalnum() or c == " " else "" for c in profile).split()
    return "-".join(words[:5]).lower() or "profile"


def main() -> None:
    load_dotenv()

    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print('usage: python -m src.main "your profile — age, lifestyle, goals"')
        sys.exit(1)

    profile = sys.argv[1].strip()
    print(f"\nbuilding a plan for: {profile}\n" + "-" * 48)

    wf = build_workforce()
    task = Task(
        content=(
            "Produce a structured personalized health plan for this person. "
            "Research evidence-based guidance, assess their focus areas, "
            "review the plan for safety, and write the final plan.\n\n"
            f"Profile: {profile}"
        ),
        id="root",
    )

    result = wf.process_task(task)
    plan = result.result or "(no result produced)"

    outputs = pathlib.Path("outputs")
    outputs.mkdir(exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y-%m-%dT%H-%M")
    out = outputs / f"{stamp}-{_slug(profile)}.md"
    out.write_text(plan)

    print(f"\n--- HEALTH PLAN ---\n\n{plan}\n")
    print("-" * 48 + f"\nsaved -> {out}")


if __name__ == "__main__":
    main()
