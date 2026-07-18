import csv, psycopg2, re
conn = psycopg2.connect("dbname=tuttle_v21 user=claude host=/var/run/postgresql")
cur = conn.cursor()
cur.execute("DROP SCHEMA IF EXISTS staging CASCADE; CREATE SCHEMA staging;")
base = "/mnt/user-data/uploads/0 Tuttle OS/CasePeer exported reports/"
files = {"clients": "ClientsReport-8.csv", "open_cases": "OpenCasesReport-4.csv", "notes": "NotesReport.csv"}
def colname(h, i):
    if not h.strip(): return f"col_{i}"
    c = re.sub(r'[^a-z0-9]+', '_', h.strip().lower()).strip('_')
    return '"%s"' % c if c else f"col_{i}"
for tbl, fn in files.items():
    with open(base + fn, newline='', encoding='utf-8-sig') as f:
        rdr = csv.reader(f)
        hdr = next(rdr)
        cols = [colname(h, i) for i, h in enumerate(hdr)]
        cur.execute(f"CREATE TABLE staging.{tbl} ({', '.join(c + ' text' for c in cols)}, src_row int)")
        rows = [(tuple(r) + (n,)) for n, r in enumerate(rdr, 2)]
        ph = ','.join(['%s'] * (len(cols) + 1))
        cur.executemany(f"INSERT INTO staging.{tbl} VALUES ({ph})", rows)
        print(tbl, len(rows), "rows,", len(cols), "cols")
conn.commit()
