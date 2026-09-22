"""Package student-facing offline exercises, without publishing or source PDF."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys

root = Path(__file__).resolve().parents[1]
destination = Path(sys.argv[1]).resolve()
destination.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
    for file in sorted((root/'public/english/round2').rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(root/'public/english/round2'))
    archive.write(root/'docs/english-round2/SPLIT-RELEASE.md', '使用说明.md')
    assert archive.testzip() is None
print(f'{destination}: {destination.stat().st_size} bytes')
