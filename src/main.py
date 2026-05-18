"""CLI entry point.

    python -m src.main "subscription socks for cats, $12/mo"

Runs the four-agent Workforce and writes the resulting memo to outputs/.
"""

import datetime
import pathlib
import sys

from dotenv import load_dotenv

from camel.tasks import Task

from .workforce import build_workforce


def _slug(idea: str) -> str:
    words = "".join(c if c.isalnum() or c == " " else "" for c in idea).split()
    return "-".join(words[:5]).lower() or "idea"


def main() -> None:
    load_dotenv()

    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print('usage: python -m src.main "your startup idea"')
        sys.exit(1)

    idea = sys.argv[1].strip()
    print(f"\nresearching: {idea}\n" + "-" * 48)

    wf = build_workforce()
    task = Task(
        content=(
            "Produce a structured one-page market memo for this startup idea. "
            "Research it, analyze the market, critique the assumptions, and "
            f"write the final memo.\n\nIdea: {idea}"
        ),
        id="root",
    )

    result = wf.process_task(task)
    memo = result.result or "(no result produced)"

    outputs = pathlib.Path("outputs")
    outputs.mkdir(exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y-%m-%dT%H-%M")
    out = outputs / f"{stamp}-{_slug(idea)}.md"
    out.write_text(memo)

    print(f"\n--- MEMO ---\n\n{memo}\n")
    print("-" * 48 + f"\nsaved -> {out}")


if __name__ == "__main__":
    main()
