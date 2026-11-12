"""make data (part 1): download the open datasets Keel uses, exactly as surveyed in docs/DATA.md.

Nothing here needs an account.  Files land in data/raw/<dataset>/ and are skipped when present.
The two large archives are not downloaded whole: single members are read with HTTP range
requests (the zip central directory first, then only the members listed in data/manifests/).

  stanford_covid_wearables_phase1   full zip (382 MB) + supplementary table
  stanford_covid_wearables_phase2   408 members of a 5.5 GB zip (652 MB) + source-data table
  lifesnaps                         one CSV (daily table) out of a 615 MB zip
  nasa_lsda_nlsp_public             daily vitals CSVs of the public bed-rest campaigns (optional)
"""
import csv
import gzip
import io
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
MAN = ROOT / "data" / "manifests"
UA = {"User-Agent": "Mozilla/5.0 (research data fetch)"}

P1_ZIP = "https://storage.googleapis.com/gbsc-gcp-project-ipop_public/COVID-19/COVID-19-Wearables.zip"
P1_XLSX = "https://static-content.springer.com/esm/art%3A10.1038%2Fs41551-020-00640-6/MediaObjects/41551_2020_640_MOESM3_ESM.xlsx"
P2_ZIP = "https://storage.googleapis.com/gbsc-gcp-project-ipop_public/COVID-19-Phase2/COVID-19-Phase2-Wearables.zip"
P2_XLSX = "https://static-content.springer.com/esm/art%3A10.1038%2Fs41591-021-01593-2/MediaObjects/41591_2021_1593_MOESM3_ESM.xlsx"
LS_ZIP = "https://zenodo.org/api/records/7229547/files/rais_anonymized.zip/content"
LS_MEMBER = "daily_fitbit_sema_df_unprocessed.csv"


class HttpFile(io.RawIOBase):
    """A read-only, seekable view of a remote file using HTTP range requests, so zipfile can
    read one member without downloading the archive."""

    def __init__(self, url: str, block: int = 8 << 20, ua: dict | None = None):
        self.url, self.block, self.pos, self.ua = url, block, 0, ua or UA
        req = urllib.request.Request(url, method="HEAD", headers=self.ua)
        with urllib.request.urlopen(req) as r:
            self.size = int(r.headers["Content-Length"])
        self.cache: dict[int, bytes] = {}

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def _block(self, i: int) -> bytes:
        if i not in self.cache:
            lo, hi = i * self.block, min(self.size, (i + 1) * self.block) - 1
            req = urllib.request.Request(self.url, headers={**self.ua, "Range": f"bytes={lo}-{hi}"})
            with urllib.request.urlopen(req) as r:
                self.cache[i] = r.read()
            if len(self.cache) > 6:
                self.cache.pop(next(iter(self.cache)))
        return self.cache[i]

    def read(self, n=-1):
        if n < 0:
            n = self.size - self.pos
        out = bytearray()
        while n > 0 and self.pos < self.size:
            i, o = divmod(self.pos, self.block)
            chunk = self._block(i)[o:o + n]
            out += chunk
            self.pos += len(chunk)
            n -= len(chunk)
        return bytes(out)

    def readinto(self, b):
        d = self.read(len(b))
        b[:len(d)] = d
        return len(d)


def download(url: str, dest: Path, ua: dict | None = None) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        print("have", dest.relative_to(ROOT))
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    print("get ", url)
    req = urllib.request.Request(url, headers=ua or UA)
    with urllib.request.urlopen(req) as r, open(dest.with_suffix(dest.suffix + ".part"), "wb") as f:
        shutil.copyfileobj(r, f, 1 << 20)
    dest.with_suffix(dest.suffix + ".part").rename(dest)


def phase1():
    d = RAW / "stanford_covid_wearables_phase1"
    download(P1_ZIP, d / "COVID-19-Wearables.zip")
    download(P1_XLSX, d / "41551_2020_640_MOESM3_ESM.xlsx")


def phase2():
    d = RAW / "stanford_covid_wearables_phase2"
    download(P2_XLSX, d / "41591_2021_1593_MOESM3_ESM.xlsx")
    rows = list(csv.DictReader(open(MAN / "stanford_phase2_subset.tsv"), delimiter="\t"))
    todo = [r for r in rows if not (d / r["group"] / r["participant"] / (Path(r["zip_member"]).name + ".gz")).exists()]
    print(f"phase 2: {len(rows) - len(todo)} of {len(rows)} members present")
    if not todo:
        return
    z = zipfile.ZipFile(io.BufferedReader(HttpFile(P2_ZIP), buffer_size=1 << 20))
    for k, r in enumerate(todo):
        dest = d / r["group"] / r["participant"] / (Path(r["zip_member"]).name + ".gz")
        dest.parent.mkdir(parents=True, exist_ok=True)
        with z.open(r["zip_member"]) as src, gzip.open(dest, "wb", compresslevel=6) as out:
            shutil.copyfileobj(src, out, 1 << 20)
        if k % 20 == 0:
            print(f"  {k + 1}/{len(todo)} {r['participant']}", flush=True)
    shutil.copy(MAN / "stanford_phase2_subset.tsv", d / "EXTRACT_MANIFEST.tsv")


def lifesnaps():
    dest = RAW / "lifesnaps" / "extracted" / LS_MEMBER
    if dest.exists():
        print("have", dest.relative_to(ROOT))
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    ua = {"User-Agent": "curl/8.7.1"}   # Zenodo rejects the bare Mozilla agent
    z = zipfile.ZipFile(io.BufferedReader(HttpFile(LS_ZIP, ua=ua), buffer_size=1 << 20))
    member = next(n for n in z.namelist() if n.endswith(LS_MEMBER))
    with z.open(member) as src, open(dest, "wb") as out:
        shutil.copyfileobj(src, out, 1 << 20)
    print("got ", dest.relative_to(ROOT))


def lsda():
    """Public bed-rest daily vitals from the NASA Life Sciences Portal (small CSV files)."""
    rows = [r for r in csv.reader(open(MAN / "nasa_lsda_public.tsv"), delimiter="\t") if len(r) >= 5 and ("Daily_Vitals" in r[2] or "VITALS_DATA" in r[2])]
    n = 0
    for r in rows:
        dest = RAW / "nasa_lsda_nlsp_public" / r[2]
        if not dest.exists():
            download(r[3], dest)
            n += 1
    print(f"LSDA bed-rest vitals: {len(rows)} files ({n} downloaded)")


def main():
    which = sys.argv[1:] or ["phase1", "phase2", "lifesnaps", "lsda"]
    for w in which:
        {"phase1": phase1, "phase2": phase2, "lifesnaps": lifesnaps, "lsda": lsda}[w]()


if __name__ == "__main__":
    main()
