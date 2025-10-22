#!/usr/bin/env python3
"""
Checks every /Book/Chapter.json in the repo against a reference KJV
and reports mismatches. Produces:
 - console summary
 - CSV: ./bible_mismatches.csv

Your structure:
  /Genesis/01.json
  /Genesis/02.json
  ...
  /Genesis/10.json
"""

import os, re, json, time, csv
from typing import List, Tuple, Dict
import requests

# ------------------ CONFIG ------------------
REPO_ROOT = "."             # repo root; keep "." if script is at root
TRANSLATION = "kjv"         # reference translation
API_BASE = "https://bible-api.com"
REQUEST_TIMEOUT = 15
RETRY_COUNT = 3
RETRY_SLEEP_SEC = 1.5
THROTTLE_BETWEEN_CALLS = 0.25   # be polite to the API
CSV_OUT = os.path.join(REPO_ROOT, "bible_mismatches.csv")
# --------------------------------------------

KJV_BOOKS_IN_ORDER = [
    "Genesis","Exodus","Leviticus","Numbers","Deuteronomy",
    "Joshua","Judges","Ruth","1 Samuel","2 Samuel",
    "1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra",
    "Nehemiah","Esther","Job","Psalms","Proverbs",
    "Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations",
    "Ezekiel","Daniel","Hosea","Joel","Amos",
    "Obadiah","Jonah","Micah","Nahum","Habakkuk",
    "Zephaniah","Haggai","Zechariah","Malachi",
    "Matthew","Mark","Luke","John","Acts",
    "Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians",
    "Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy",
    "2 Timothy","Titus","Philemon","Hebrews","James",
    "1 Peter","2 Peter","1 John","2 John","3 John",
    "Jude","Revelation"
]

SPACE_RX = re.compile(r"\s+")
PUNCT_RX = re.compile(r"[^\w\s]")

def norm_text(s: str) -> str:
    s = s.replace("\u201c","\"").replace("\u201d","\"").replace("\u2019","'").replace("\u2018","'")
    s = SPACE_RX.sub(" ", s).strip()
    return s

def norm_text_strict(s: str) -> str:
    s = norm_text(s)
    s = PUNCT_RX.sub("", s)
    s = SPACE_RX.sub(" ", s).strip().lower()
    return s

def read_local_chapter(book: str, chapter_num: int) -> Tuple[List[str], Dict]:
    # note the two-digit format for chapters under 10
    path = os.path.join(REPO_ROOT, book, f"{chapter_num:02}.json")
    if not os.path.exists(path):
        # fallback in case file isn't padded
        alt_path = os.path.join(REPO_ROOT, book, f"{chapter_num}.json")
        if os.path.exists(alt_path):
            path = alt_path
        else:
            raise FileNotFoundError(f"Missing file: {book}/{chapter_num:02}.json or {chapter_num}.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    verses = data.get("verses", [])
    if verses and isinstance(verses[0], dict):
        local_texts = [str(v.get("text","")) for v in verses]
    else:
        local_texts = [str(v) for v in verses]
    return local_texts, data

def fetch_ref_chapter(book: str, chapter_num: int) -> List[str]:
    url = f"{API_BASE}/{requests.utils.quote(book)}%20{chapter_num}?translation={TRANSLATION}"
    last_err = None
    for _ in range(RETRY_COUNT):
        try:
            r = requests.get(url, timeout=REQUEST_TIMEOUT)
            if r.status_code == 429:
                time.sleep(2.0)
                continue
            r.raise_for_status()
            js = r.json()
            verses = js.get("verses", [])
            return [norm_text(str(v.get("text",""))) for v in verses]
        except Exception as e:
            last_err = e
            time.sleep(RETRY_SLEEP_SEC)
    raise RuntimeError(f"Failed to fetch {book} {chapter_num}: {last_err}")

def first_diff(local: List[str], ref: List[str]) -> Tuple[int, str, str]:
    n = min(len(local), len(ref))
    for i in range(n):
        if norm_text_strict(local[i]) != norm_text_strict(ref[i]):
            return i+1, local[i], ref[i]
    if len(local) != len(ref):
        return n+1, f"[local length={len(local)}]", f"[ref length={len(ref)}]"
    return -1, "", ""

def discover_books() -> List[str]:
    present = set(d for d in os.listdir(REPO_ROOT)
                  if os.path.isdir(os.path.join(REPO_ROOT, d)))
    return [b for b in KJV_BOOKS_IN_ORDER if b in present]

def discover_chapters(book: str) -> List[int]:
    book_dir = os.path.join(REPO_ROOT, book)
    nums = []
    for name in os.listdir(book_dir):
        if not name.endswith(".json"):
            continue
        stem = name[:-5]
        try:
            nums.append(int(stem))
        except ValueError:
            pass
    return sorted(nums)

def main():
    books = discover_books()
    if not books:
        print("No book folders found at repo root.")
        return

    print(f"Found {len(books)} books.")
    mismatches = []
    totals = matched = missing = errors = 0

    for book in books:
        chapters = discover_chapters(book)
        if not chapters:
            print(f"⚠️  No chapters found in {book}/")
            continue
        print(f"\n== {book} ({len(chapters)} chapters) ==")

        for ch in chapters:
            totals += 1
            label = f"{book} {ch}"
            try:
                local_verses, _ = read_local_chapter(book, ch)
            except FileNotFoundError:
                print(f"❓ Missing: {label}")
                missing += 1
                continue
            except Exception as e:
                print(f"🛑 Error reading {label}: {e}")
                errors += 1
                continue

            try:
                ref_verses = fetch_ref_chapter(book, ch)
                time.sleep(THROTTLE_BETWEEN_CALLS)
            except Exception as e:
                print(f"🛑 Error fetching reference for {label}: {e}")
                errors += 1
                continue

            vnum, lv, rv = first_diff(local_verses, ref_verses)
            if vnum == -1:
                print(f"✅ {label}")
                matched += 1
            else:
                print(f"❌ {label} (first diff at verse {vnum})")
                mismatches.append({
                    "book": book,
                    "chapter": ch,
                    "first_diff_verse": vnum,
                    "local_snippet": lv[:200],
                    "ref_snippet": rv[:200],
                    "local_verse_count": len(local_verses),
                    "ref_verse_count": len(ref_verses),
                })

    if mismatches:
        with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=[
                "book","chapter","first_diff_verse",
                "local_verse_count","ref_verse_count",
                "local_snippet","ref_snippet"
            ])
            w.writeheader()
            w.writerows(mismatches)

    print("\n============== SUMMARY ==============")
    print(f"Total chapters scanned : {totals}")
    print(f"Chapters matched       : {matched}")
    print(f"Chapters mismatched    : {len(mismatches)}")
    print(f"Missing files          : {missing}")
    print(f"Errors (read/fetch)    : {errors}")
    if mismatches:
        print(f"\nCSV report written to: {CSV_OUT}")
    print("====================================")

if __name__ == "__main__":
    main()