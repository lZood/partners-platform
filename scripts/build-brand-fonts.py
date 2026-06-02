"""
Build static TTF instances of the BoxBuild brand fonts (Sora + Anek Latin)
for embedding in server-side PDF generation (pdfkit / fontkit).

Source: Google Fonts (OFL-1.1). The repo ships variable fonts only; pdfkit
cannot select a named instance from a variable font, so we pin the weight
(and width) axes here to produce plain static TTFs.

Run once to (re)generate files under public/brand/fonts/. Network required.
"""
import sys
import urllib.request
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

OUT = Path(__file__).resolve().parent.parent / "public" / "brand" / "fonts"
OUT.mkdir(parents=True, exist_ok=True)

# Variable source fonts on the Google Fonts GitHub mirror.
SORA_URL = "https://github.com/google/fonts/raw/main/ofl/sora/Sora%5Bwght%5D.ttf"
ANEK_URL = "https://github.com/google/fonts/raw/main/ofl/aneklatin/AnekLatin%5Bwdth%2Cwght%5D.ttf"

CACHE = OUT / "_src"
CACHE.mkdir(exist_ok=True)


def fetch(url: str, dest: Path) -> Path:
    if dest.exists() and dest.stat().st_size > 50_000:
        print(f"  cached {dest.name} ({dest.stat().st_size} bytes)")
        return dest
    print(f"  downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    dest.write_bytes(data)
    print(f"  saved {dest.name} ({len(data)} bytes)")
    return dest


def make_instance(src: Path, axes: dict, out_name: str):
    font = TTFont(str(src))
    instantiateVariableFont(font, axes, inplace=True)
    out = OUT / out_name
    font.save(str(out))
    # Validate: must be a real TTF (sfnt 0x00010000) of a sane size.
    size = out.stat().st_size
    with open(out, "rb") as fh:
        magic = fh.read(4)
    ok = size > 20_000 and magic in (b"\x00\x01\x00\x00", b"true", b"OTTO")
    print(f"  {'OK ' if ok else 'BAD'} {out_name}  axes={axes}  {size} bytes  magic={magic!r}")
    if not ok:
        raise SystemExit(f"Instance {out_name} failed validation")


def main():
    print("Sora:")
    sora = fetch(SORA_URL, CACHE / "Sora-VF.ttf")
    make_instance(sora, {"wght": 400}, "Sora-Regular.ttf")
    make_instance(sora, {"wght": 600}, "Sora-SemiBold.ttf")

    print("Anek Latin:")
    anek = fetch(ANEK_URL, CACHE / "AnekLatin-VF.ttf")
    make_instance(anek, {"wght": 600, "wdth": 100}, "AnekLatin-SemiBold.ttf")
    make_instance(anek, {"wght": 700, "wdth": 100}, "AnekLatin-Bold.ttf")

    print("\nDone. Files in", OUT)


if __name__ == "__main__":
    main()
