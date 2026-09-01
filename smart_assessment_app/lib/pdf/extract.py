import json
import sys

import fitz

MAX_PAGES = 25


def extract_text(path: str) -> dict:
    doc = fitz.open(path)
    page_count = len(doc)
    pages = min(page_count, MAX_PAGES)
    chunks = []

    for i in range(pages):
        text = doc[i].get_text("text").strip()
        if text:
            chunks.append({"page": i + 1, "text": text})

    doc.close()
    return {
        "pageCount": page_count,
        "usedPages": pages,
        "chunks": chunks,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Missing file path")
    print(json.dumps(extract_text(sys.argv[1])))
