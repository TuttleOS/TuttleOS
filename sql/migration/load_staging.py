#!/usr/bin/env python3
"""Load CasePeer export CSVs into staging.* for migrate_v2.5.sql.

CSVs stay in the firm's Dropbox — never commit them. See docs/CASEPEER_MIGRATION.md.

Env:
  DATABASE_URL          required (direct Postgres URI; prefer session mode for DDL)
  CASEPEER_CSV_DIR      directory containing the three export CSVs
  CASEPEER_CLIENTS_CSV  optional filename override (default ClientsReport-8.csv)
  CASEPEER_OPEN_CSV     optional (default OpenCasesReport-4.csv)
  CASEPEER_NOTES_CSV    optional (default NotesReport.csv)
"""

from __future__ import annotations

import csv
import os
import re
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 required. pip install -r sql/migration/requirements.txt", file=sys.stderr)
    sys.exit(1)


def colname(h: str, i: int) -> str:
    if not h.strip():
        return f"col_{i}"
    c = re.sub(r"[^a-z0-9]+", "_", h.strip().lower()).strip("_")
    return f'"{c}"' if c else f"col_{i}"


def main() -> int:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL is not set.", file=sys.stderr)
        return 1

    csv_dir = Path(os.environ.get("CASEPEER_CSV_DIR", "")).expanduser()
    if not csv_dir.is_dir():
        print(
            "ERROR: CASEPEER_CSV_DIR must point at the Dropbox export folder "
            '(e.g. ".../0 Tuttle OS/CasePeer exported reports").',
            file=sys.stderr,
        )
        return 1

    files = {
        "clients": os.environ.get("CASEPEER_CLIENTS_CSV", "ClientsReport-8.csv"),
        "open_cases": os.environ.get("CASEPEER_OPEN_CSV", "OpenCasesReport-4.csv"),
        "notes": os.environ.get("CASEPEER_NOTES_CSV", "NotesReport.csv"),
    }

    missing = [fn for fn in files.values() if not (csv_dir / fn).is_file()]
    if missing:
        print("ERROR: missing CSV file(s) in CASEPEER_CSV_DIR:", file=sys.stderr)
        for fn in missing:
            print(f"  - {fn}", file=sys.stderr)
        return 1

    # Refuse paths that look like the git kit (extra safety for gate 10.1).
    kit_marker = Path(__file__).resolve().parents[2]
    try:
        csv_dir.resolve().relative_to(kit_marker)
        print(
            "ERROR: CASEPEER_CSV_DIR resolves inside the git kit. "
            "Keep CasePeer CSVs in Dropbox only (gate 10.1).",
            file=sys.stderr,
        )
        return 1
    except ValueError:
        pass

    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cur.execute("DROP SCHEMA IF EXISTS staging CASCADE; CREATE SCHEMA staging;")
        for tbl, fn in files.items():
            path = csv_dir / fn
            with path.open(newline="", encoding="utf-8-sig") as f:
                rdr = csv.reader(f)
                hdr = next(rdr)
                cols = [colname(h, i) for i, h in enumerate(hdr)]
                cur.execute(
                    f"CREATE TABLE staging.{tbl} ("
                    f"{', '.join(c + ' text' for c in cols)}, src_row int)"
                )
                rows = [tuple(r) + (n,) for n, r in enumerate(rdr, 2)]
                if not rows:
                    print(f"WARNING: {tbl} has 0 data rows ({fn})")
                ph = ",".join(["%s"] * (len(cols) + 1))
                cur.executemany(
                    f"INSERT INTO staging.{tbl} VALUES ({ph})", rows
                )
                print(f"{tbl}: {len(rows)} rows, {len(cols)} cols ← {fn}")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

    print("OK: staging schema loaded. Next: migrate_v2.5.sql")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
