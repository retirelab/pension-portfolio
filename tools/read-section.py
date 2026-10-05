#!/usr/bin/env python3
"""Read only selected marked sections; never changes the source file."""
import argparse
import re
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("sections", nargs="*")
parser.add_argument("--list", action="store_true", help="List section IDs and current line ranges")
args = parser.parse_args()
source = Path(__file__).resolve().parents[1] / "index.html"
lines = source.read_text(encoding="utf-8").splitlines(keepends=True)
pattern = re.compile(r"^\s*(?://|\{/\*) @section ([a-z0-9-]+) \| (.*?)(?: \*/\})?\s*$")
starts = [(i, match.group(1), match.group(2)) for i, line in enumerate(lines) if (match := pattern.match(line))]
sections = {}
for n, (start, key, label) in enumerate(starts):
    if key in sections:
        parser.error(f"duplicate section: {key}")
    end = starts[n + 1][0] if n + 1 < len(starts) else len(lines)
    sections[key] = (start, end, label)
unknown = set(args.sections) - sections.keys()
if unknown:
    parser.error("unknown sections: " + ", ".join(sorted(unknown)))
if args.list or not args.sections:
    for key, (start, end, label) in sections.items():
        print(f"{key:22} {start + 1:4}-{end:<4} {label}")
for key in args.sections:
    start, end, label = sections[key]
    print(f"--- {key} ({source.name}:{start + 1}-{end}) ---")
    print("".join(lines[start:end]), end="")
